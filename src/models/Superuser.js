const Database = require('../core/Database');
const Logger = require('../core/Logger');
const Validator = require('../core/Validator');
const base64url = require('base64url');
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require('@simplewebauthn/server');

class Superuser {
    constructor() {
        this.db = new Database();
        this.logger = new Logger();
        this.validator = new Validator();
        
        // WebAuthn configuration
        this.rpID = 'localhost';
        this.rpName = 'My WebAuthn App';
        this.expectedOrigin = 'http://localhost:4000';
    }

    async checkEmail(email) {
        try {
            if (!email) {
                throw new Error('Email is required');
            }

            const { rows: existingUsers } = await this.db.query(
                'SELECT COUNT(*) AS count FROM superusers WHERE email = $1',
                [email]
            );

            return {
                exists: existingUsers[0].count > 0
            };
        } catch (error) {
            this.logger.error('Email check error:', error);
            throw error;
        }
    }

    async getSessionInfo(userId) {
        try {
            const { rows: users } = await this.db.query(
                'SELECT user_id, email, full_name FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                [userId]
            );

            if (users.length === 0) {
                return { authenticated: false };
            }

            return {
                authenticated: true,
                user: {
                    id: users[0].user_id,
                    email: users[0].email,
                    fullName: users[0].full_name
                }
            };
        } catch (error) {
            this.logger.error('Session check error:', error);
            throw error;
        }
    }

    async generateRegistrationChallenge(email, fullName) {
        try {
            this.validator.clearErrors();

            if (!email || !fullName) {
                throw new Error('Email and fullName are required');
            }

            // Validate email
            if (!this.validator.validateEmail('email', email)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Check for existing email
            const { rows: existingUsers } = await this.db.query(
                'SELECT COUNT(*) AS count FROM superusers WHERE email = $1',
                [email]
            );

            if (existingUsers[0].count > 0) {
                throw new Error('Email already registered');
            }

            // Generate user ID
            const userIdBuffer = require('crypto').randomBytes(32);
            const userId = base64url.encode(userIdBuffer);

            const options = await generateRegistrationOptions({
                rpName: this.rpName,
                rpID: this.rpID,
                userID: userIdBuffer,
                userName: email,
                userDisplayName: fullName,
                attestationType: 'none',
                authenticatorSelection: {
                    userVerification: 'required'
                }
            });

            return {
                challenge: options.challenge,
                rp: {
                    name: this.rpName,
                    id: this.rpID
                },
                user: {
                    id: userId,
                    name: email,
                    displayName: fullName
                },
                pubKeyCredParams: options.pubKeyCredParams,
                timeout: 60000,
                attestation: 'none'
            };
        } catch (error) {
            this.logger.error('Registration challenge error:', error);
            throw error;
        }
    }

    async verifyRegistration(registrationData, challenge) {
        try {
            const { id, rawId, response, userInfo } = registrationData;

            if (!id || !rawId || !response || !userInfo || !challenge) {
                throw new Error('Missing required registration data or challenge');
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
                expectedChallenge: challenge,
                expectedOrigin: this.expectedOrigin,
                expectedRPID: this.rpID,
                requireUserVerification: true
            });

            if (!verification.verified) {
                throw new Error('Registration verification failed');
            }

            const { email, fullName } = userInfo;
            const userId = base64url.encode(verification.registrationInfo.userID);

            // Check for existing credential
            const { rows: existingCredentials } = await this.db.query(
                'SELECT COUNT(*) AS count FROM superuser_credentials WHERE credential_id = $1',
                [id]
            );

            if (existingCredentials[0].count > 0) {
                throw new Error('This passkey is already registered');
            }

            // Insert superuser
            await this.db.query(
                'INSERT INTO superusers (user_id, email, full_name, is_active) VALUES ($1, $2, $3, TRUE)',
                [userId, email, fullName]
            );

            // Store credential
            await this.db.query(
                'INSERT INTO superuser_credentials (credential_id, user_id, public_key, is_active, sign_count) VALUES ($1, $2, $3, TRUE, $4)',
                [id, userId, base64url.encode(verification.registrationInfo.credential.publicKey), verification.registrationInfo.counter]
            );

            this.logger.info(`Superuser registered: ${email} (ID: ${userId})`);

            return {
                success: true,
                message: 'Registration successful',
                user: {
                    id: userId,
                    email,
                    fullName
                }
            };
        } catch (error) {
            this.logger.error('Registration error:', error);
            throw error;
        }
    }

    async generateAuthenticationChallenge() {
        try {
            const options = await generateAuthenticationOptions({
                rpID: this.rpID,
                allowCredentials: [], // Will be populated based on user
                userVerification: 'required'
            });

            return options;
        } catch (error) {
            this.logger.error('Login challenge error:', error);
            throw error;
        }
    }

    async verifyAuthentication(authenticationData, challenge) {
        try {
            const { id, response } = authenticationData;
            const userHandle = response.userHandle;

            if (!id || !response || !challenge) {
                throw new Error('Missing required authentication data or challenge');
            }

            // Fetch credential
            const { rows: credentials } = await this.db.query(
                `SELECT sc.credential_id, sc.user_id, sc.public_key, sc.last_used, sc.sign_count, s.email, s.full_name
                 FROM superuser_credentials sc
                 JOIN superusers s ON sc.user_id = s.user_id
                 WHERE sc.credential_id = $1 AND sc.is_active = TRUE AND s.is_active = TRUE`,
                [id]
            );

            if (credentials.length === 0) {
                throw new Error('Credential not found or inactive');
            }

            const credential = credentials[0];

            // Verify userHandle
            if (userHandle && userHandle !== credential.user_id) {
                throw new Error('User handle mismatch');
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
                expectedChallenge: challenge,
                expectedOrigin: this.expectedOrigin,
                expectedRPID: this.rpID,
                credential: {
                    id: credential.credential_id,
                    publicKey: Buffer.from(credential.public_key, 'base64url'),
                    signCount: credential.sign_count || 0
                },
                requireUserVerification: true
            });

            if (!verification.verified) {
                throw new Error('Authentication verification failed');
            }

            // Update last_used and sign_count
            await this.db.query(
                'UPDATE superuser_credentials SET last_used = NOW(), sign_count = $1 WHERE credential_id = $2',
                [verification.authenticationInfo.newCounter, id]
            );

            this.logger.info(`Superuser authenticated: ${credential.email} (ID: ${credential.user_id})`);

            return {
                success: true,
                message: 'Authentication successful',
                user: {
                    id: credential.user_id,
                    email: credential.email,
                    fullName: credential.full_name
                },
                credentialId: id
            };
        } catch (error) {
            this.logger.error('Authentication error:', error);
            throw error;
        }
    }
}

module.exports = Superuser; 