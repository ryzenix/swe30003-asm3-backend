#!/usr/bin/env node

/**
 * Rate Limiting Test Script
 * This script tests the rate limiting functionality by making multiple requests to different endpoints.
 * 
 * Usage: node test-rate-limiting.js
 * 
 * Make sure your server is running before executing this script.
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Test function for read-only endpoints
async function testReadOnlyRateLimit() {
    console.log('\n🔍 Testing Read-Only Rate Limiting (200 requests per 15 minutes)');
    console.log('Making 5 requests to /products/list...\n');

    for (let i = 1; i <= 5; i++) {
        try {
            const response = await makeRequest('/products/list');
            console.log(`Request ${i}: Status ${response.statusCode} | Remaining: ${response.headers['ratelimit-remaining'] || 'N/A'}`);
        } catch (error) {
            console.log(`Request ${i}: Error - ${error.message}`);
        }
    }
}

// Test function for authentication endpoints
async function testAuthRateLimit() {
    console.log('\n🔐 Testing Authentication Rate Limiting (5 requests per 15 minutes)');
    console.log('Making 7 requests to /auth/user/login (should fail after 5)...\n');

    const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
    };

    for (let i = 1; i <= 7; i++) {
        try {
            const response = await makeRequest('/auth/user/login', 'POST', loginData);
            const remaining = response.headers['ratelimit-remaining'] || 'N/A';
            
            if (response.statusCode === 429) {
                console.log(`❌ Request ${i}: Rate limited! Status ${response.statusCode}`);
                const body = JSON.parse(response.body);
                console.log(`   Message: ${body.message}`);
            } else {
                console.log(`✅ Request ${i}: Status ${response.statusCode} | Remaining: ${remaining}`);
            }
        } catch (error) {
            console.log(`❌ Request ${i}: Error - ${error.message}`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// Test function for global rate limiting
async function testGlobalRateLimit() {
    console.log('\n🌍 Testing Global Rate Limiting (500 requests per hour)');
    console.log('Making 10 requests to different endpoints...\n');

    const endpoints = [
        '/products/list',
        '/auth/session',
        '/products/list',
        '/auth/session',
        '/products/list'
    ];

    for (let i = 1; i <= 5; i++) {
        try {
            const endpoint = endpoints[(i - 1) % endpoints.length];
            const response = await makeRequest(endpoint);
            const remaining = response.headers['ratelimit-remaining'] || 'N/A';
            console.log(`Request ${i} (${endpoint}): Status ${response.statusCode} | Global Remaining: ${remaining}`);
        } catch (error) {
            console.log(`Request ${i}: Error - ${error.message}`);
        }
    }
}

// Check rate limit headers
async function checkRateLimitHeaders() {
    console.log('\n📊 Checking Rate Limit Headers');
    console.log('Making a request to check rate limit headers...\n');

    try {
        const response = await makeRequest('/products/list');
        
        console.log('Rate Limit Headers:');
        console.log(`  RateLimit-Limit: ${response.headers['ratelimit-limit'] || 'Not set'}`);
        console.log(`  RateLimit-Remaining: ${response.headers['ratelimit-remaining'] || 'Not set'}`);
        console.log(`  RateLimit-Reset: ${response.headers['ratelimit-reset'] || 'Not set'}`);
        
        if (response.headers['ratelimit-reset']) {
            const resetTime = new Date(parseInt(response.headers['ratelimit-reset']) * 1000);
            console.log(`  Reset Time: ${resetTime.toLocaleString()}`);
        }
    } catch (error) {
        console.log(`Error checking headers: ${error.message}`);
    }
}

// Main test function
async function runTests() {
    console.log('🚀 Rate Limiting Test Suite');
    console.log('===========================');
    
    // Check if server is running
    try {
        await makeRequest('/products/list');
        console.log('✅ Server is running and accessible');
    } catch (error) {
        console.log('❌ Server is not accessible. Please start the server first.');
        console.log('   Run: npm start or npm run dev');
        process.exit(1);
    }

    await checkRateLimitHeaders();
    await testReadOnlyRateLimit();
    await testAuthRateLimit();
    await testGlobalRateLimit();

    console.log('\n✅ Rate limiting tests completed!');
    console.log('\nNote: This script tests basic functionality. In a real attack scenario,');
    console.log('rate limits would be reached much faster with concurrent requests.');
    console.log('\nTo reset rate limits, restart the server or wait for the time windows to expire.');
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Test interrupted by user');
    process.exit(0);
});

// Run the tests
runTests().catch(error => {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
});