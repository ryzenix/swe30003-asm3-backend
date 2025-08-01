const express = require('express');
const router = express.Router();
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const pool = require('../../config/db');
const base64url = require('base64url');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

router.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Configuration
const rpID = 'localhost'; // Relying Party ID
const rpName = 'My WebAuthn App';
const expectedOrigin = 'http://localhost:4000'; // Adjust for your frontend port

// Check if email exists
router.post('/check-email', async (req, res) => {
    try {
        const {
            email
        } = req.body;
        if (!email) {
            return res.status(400).json({
                error: 'Missing email'
            });
        }

        const {
            rows: existingUsers
        } = await pool.query('SELECT COUNT(*) AS count FROM superusers WHERE email = $1', [email]);
        res.json({
            exists: existingUsers[0].count > 0
        });
    } catch (error) {
        console.error('Email check error:', error);
        res.status(500).json({
            error: 'Failed to check email: ' + error.message
        });
    }
});

// Check session status
router.get('/session', async (req, res) => {
    try {
        if (req.session.authenticated && req.session.userId) {
            const {
                rows: users
            } = await pool.query(
                'SELECT user_id, email, full_name FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );
            if (users.length === 0) {
                return res.json({
                    authenticated: false
                });
            }
            res.json({
                authenticated: true,
                user: {
                    id: users[0].user_id,
                    email: users[0].email,
                    fullName: users[0].full_name,
                    authTime: req.session.authTime ? new Date(req.session.authTime).toISOString() : null
                }
            });
        } else {
            res.json({
                authenticated: false
            });
        }
    } catch (error) {
        console.error('Session check error:', error);
        res.status(500).json({
            error: 'Failed to check session: ' + error.message
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json({
                    error: 'Failed to logout'
                });
            }
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Failed to logout: ' + error.message
        });
    }
});

// Generate registration challenge
router.post('/register-challenge', async (req, res) => {
    try {
        const {
            email,
            fullName
        } = req.body;
        if (!email || !fullName) {
            return res.status(400).json({
                error: 'Missing email or fullName'
            });
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Invalid email address'
            });
        }

        // Check for existing email
        const [existingUsers] = await pool.query('SELECT COUNT(*) AS count FROM superusers WHERE email = ?', [email]);
        if (existingUsers[0].count > 0) {
            return res.status(400).json({
                error: 'Email already registered'
            });
        }

        // Generate user ID
        const userIdBuffer = require('crypto').randomBytes(32); // 32-byte buffer
        const userId = base64url.encode(userIdBuffer); // store as string in session
        req.session.pendingUserId = userId;

        req.session.challengeTimestamp = Date.now();

        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: userIdBuffer,
            userName: email,
            userDisplayName: fullName,
            attestationType: 'none',
            authenticatorSelection: {
                userVerification: 'required'
            }
        });

        req.session.registrationChallenge = options.challenge;

        res.json({
            challenge: options.challenge,
            rp: {
                name: rpName,
                id: rpID
            },
            user: {
                id: userId,
                name: email,
                displayName: fullName
            },
            pubKeyCredParams: options.pubKeyCredParams,
            timeout: 60000,
            attestation: 'none'
        });
    } catch (error) {
        console.error('Registration challenge error:', error);
        res.status(500).json({
            error: 'Failed to generate registration challenge: ' + error.message
        });
    }
});

// Handle registration response
router.post('/register', async (req, res) => {
    try {
        const {
            id,
            rawId,
            response,
            userInfo
        } = req.body;
        if (!id || !rawId || !response || !userInfo || !req.session.registrationChallenge || !req.session.pendingUserId) {
            return res.status(400).json({
                error: 'Missing required data or session challenge'
            });
        }

        if (Date.now() - req.session.challengeTimestamp > 300000) {
            delete req.session.registrationChallenge;
            delete req.session.challengeTimestamp;
            return res.status(400).json({
                error: 'Challenge expired'
            });
        }

        const verification = await verifyRegistrationResponse({
            response: {
                id,
                rawId,
                response: {
                    clientDataJSON: response.clientDataJSON,
                    attestationObject: response.attestationObject
                },
                type: 'public-key'
            },
            expectedChallenge: req.session.registrationChallenge,
            expectedOrigin,
            expectedRPID: rpID,
            requireUserVerification: true
        });

        if (!verification.verified) {
            return res.status(400).json({
                error: 'Registration verification failed'
            });
        }

        const {
            email,
            fullName
        } = userInfo;
        const userId = req.session.pendingUserId;

        // Check for existing credential
        const {
            rows: existingCredentials
        } = await pool.query(
            'SELECT COUNT(*) AS count FROM superuser_credentials WHERE credential_id = $1',
            [id]
        );
        if (existingCredentials[0].count > 0) {
            return res.status(400).json({
                error: 'This passkey is already registered'
            });
        }
        await pool.query(
            'INSERT INTO superusers (user_id, email, full_name, is_active) VALUES ($1, $2, $3, TRUE)',
            [userId, email, fullName]
        );

        // Store credential
        await pool.query(
            'INSERT INTO superuser_credentials (credential_id, user_id, public_key, is_active, sign_count) VALUES ($1, $2, $3, TRUE, $4)',
            [id, userId, base64url.encode(verification.registrationInfo.credential.publicKey), verification.registrationInfo.counter]
        );

        // Clear session data
        delete req.session.registrationChallenge;
        delete req.session.pendingUserId;
        delete req.session.challengeTimestamp;
        req.session.authenticated = true;
        req.session.userId = userId;

        console.log(`Superuser registered: ${email} (ID: ${userId})`);
        res.json({
            success: true,
            message: 'Registration successful',
            user: {
                id: userId,
                email,
                fullName
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Registration failed: ' + error.message
        });
    }
});

// Generate authentication challenge
router.post('/login-challenge', async (req, res) => {
    try {
        // const {
        //     email
        // } = req.body;
        // if (!email) {
        //     return res.status(400).json({
        //         error: 'Missing email'
        //     });
        // }

        // // Fetch credentials for the user
        // const [credentials] = await pool.query(
        //     `SELECT sc.credential_id
        //      FROM superuser_credentials sc
        //      JOIN superusers s ON sc.user_id = s.user_id
        //      WHERE s.email = ? AND sc.is_active = TRUE AND s.is_active = TRUE`,
        //     [email]
        // );

        // if (credentials.length === 0) {
        //     return res.status(404).json({
        //         error: 'No credentials found for this email'
        //     });
        // }

        // const allowCredentials = credentials.map(cred => ({
        //     id: cred.credential_id,
        //     type: 'public-key'
        // }));

        const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials: [], // use your actual array here
            userVerification: 'required'
        });

        // Store challenge for verification later
        req.session.authChallenge = options.challenge;
        req.session.challengeTimestamp = Date.now();

        // Send the entire options object back to the client
        res.json(options);
    } catch (error) {
        console.error('Login challenge error:', error);
        res.status(500).json({
            error: 'Failed to generate login challenge: ' + error.message
        });
    }
});

// Handle authentication response
router.post('/login', async (req, res) => {
    try {
        const {
            id,
            response,
        } = req.body;

        const userHandle = response.userHandle;

        console.log('Login attempt with ID:', id, 'and userHandle:', userHandle);
        console.log('Response:', response);
        console.log('Session:', req.session);
        if (!id || !response || !req.session.authChallenge) {
            return res.status(400).json({
                error: 'Missing required data or session challenge'
            });
        }

        if (Date.now() - req.session.challengeTimestamp > 300000) {
            delete req.session.authChallenge;
            delete req.session.challengeTimestamp;
            return res.status(400).json({
                error: 'Challenge expired'
            });
        }

        // Fetch credential
        const {
            rows: credentials
        } = await pool.query(
            `SELECT sc.credential_id, sc.user_id, sc.public_key, sc.last_used, sc.sign_count, s.email, s.full_name
   FROM superuser_credentials sc
   JOIN superusers s ON sc.user_id = s.user_id
   WHERE sc.credential_id = $1 AND sc.is_active = TRUE AND s.is_active = TRUE`,
            [id]
        );

        if (credentials.length === 0) {
            return res.status(404).json({
                error: 'Credential not found or inactive'
            });
        }

        const credential = credentials[0];



        // Verify userHandle
        if (userHandle && userHandle !== credential.user_id) {
            console.error(`User handle mismatch. Received: ${userHandle}, Expected: ${credential.user_id}`);
            return res.status(400).json({
                error: 'User handle mismatch'
            });
        }

        const verification = await verifyAuthenticationResponse({
            response: {
                id,
                rawId: id,
                response: {
                    clientDataJSON: response.clientDataJSON,
                    authenticatorData: response.authenticatorData,
                    signature: response.signature,
                    userHandle
                },
                type: 'public-key'
            },
            expectedChallenge: req.session.authChallenge,
            expectedOrigin,
            expectedRPID: rpID,
            credential: {
                id: credential.credential_id,
                publicKey: Buffer.from(credential.public_key, 'base64url'),
                signCount: credential.sign_count || 0
            },
            requireUserVerification: true
        });

        if (!verification.verified) {
            return res.status(400).json({
                error: 'Authentication verification failed'
            });
        }

        // Update last_used and sign_count
        await pool.query(
            'UPDATE superuser_credentials SET last_used = NOW(), sign_count = $1 WHERE credential_id = $2',
            [verification.authenticationInfo.newCounter, id]
        );

        // Create session
        req.session.authenticated = true;
        req.session.userId = credential.user_id;
        req.session.authTime = Date.now();

        // Clear challenge
        delete req.session.authChallenge;
        delete req.session.challengeTimestamp;

        console.log(`Superuser authenticated: ${credential.email} (ID: ${credential.user_id})`);
        res.json({
            success: true,
            message: 'Authentication successful',
            user: {
                id: credential.user_id,
                email: credential.email,
                fullName: credential.full_name,
                authTime: new Date(req.session.authTime).toISOString()
            },
            credentialId: id
        });
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({
            error: 'Authentication failed: ' + error.message
        });
    }
});

module.exports = router;