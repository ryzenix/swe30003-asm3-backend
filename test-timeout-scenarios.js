const S3Service = require('./src/core/S3Service');

async function testTimeoutScenarios() {
    console.log('🧪 Testing Timeout Scenarios');
    console.log('============================');
    
    // Set environment variables for testing
    process.env.NODE_ENV = 'development';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_S3_BUCKET_NAME = 'timeout-test-bucket';
    process.env.LOCAL_S3_ENDPOINT = 'http://localhost:4566';
    
    const s3Service = new S3Service();
    
    console.log('\n📋 Test 1: Normal upload (should succeed)');
    try {
        const mockFile = {
            originalname: 'normal-test.jpg',
            buffer: Buffer.from('normal test content'),
            mimetype: 'image/jpeg'
        };
        
        const startTime = Date.now();
        const result = await s3Service.uploadImage(mockFile, 'timeout-test-1');
        const duration = Date.now() - startTime;
        
        console.log(`✅ Normal upload succeeded in ${duration}ms`);
        console.log('📄 Result:', result);
        
        // Clean up
        await s3Service.deleteImage(result.key);
        
    } catch (error) {
        console.error('❌ Normal upload failed:', error.message);
    }
    
    console.log('\n📋 Test 2: Testing with invalid endpoint (should timeout)');
    try {
        // Temporarily change endpoint to simulate network issues
        const originalEndpoint = process.env.LOCAL_S3_ENDPOINT;
        process.env.LOCAL_S3_ENDPOINT = 'http://localhost:9999'; // Non-existent endpoint
        
        const s3ServiceBad = new S3Service();
        const mockFile = {
            originalname: 'timeout-test.jpg',
            buffer: Buffer.from('timeout test content'),
            mimetype: 'image/jpeg'
        };
        
        const startTime = Date.now();
        await s3ServiceBad.uploadImage(mockFile, 'timeout-test-2');
        const duration = Date.now() - startTime;
        
        console.log(`❌ Unexpected success in ${duration}ms - this should have timed out!`);
        
        // Restore original endpoint
        process.env.LOCAL_S3_ENDPOINT = originalEndpoint;
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`✅ Expected timeout occurred in ${duration}ms`);
        console.log('📄 Error:', error.message);
        
        // Restore original endpoint
        process.env.LOCAL_S3_ENDPOINT = 'http://localhost:4566';
    }
    
    console.log('\n📋 Test 3: Large file upload (testing timeout handling)');
    try {
        // Create a larger buffer to test timeout behavior
        const largeBuffer = Buffer.alloc(1024 * 1024); // 1MB
        largeBuffer.fill('A');
        
        const mockLargeFile = {
            originalname: 'large-test.jpg',
            buffer: largeBuffer,
            mimetype: 'image/jpeg'
        };
        
        const startTime = Date.now();
        const result = await s3Service.uploadImage(mockLargeFile, 'timeout-test-3');
        const duration = Date.now() - startTime;
        
        console.log(`✅ Large file upload succeeded in ${duration}ms`);
        console.log('📄 File size:', largeBuffer.length, 'bytes');
        
        // Clean up
        await s3Service.deleteImage(result.key);
        
    } catch (error) {
        console.error('❌ Large file upload failed:', error.message);
    }
    
    console.log('\n📋 Test 4: Bucket creation timeout test');
    try {
        // Test bucket creation with a new bucket name
        process.env.AWS_S3_BUCKET_NAME = 'timeout-bucket-creation-test';
        const s3ServiceNew = new S3Service();
        
        const startTime = Date.now();
        await s3ServiceNew.createBucketIfNotExists();
        const duration = Date.now() - startTime;
        
        console.log(`✅ Bucket creation succeeded in ${duration}ms`);
        
        // Clean up - delete the test bucket
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        await execAsync('curl -X DELETE http://localhost:4566/timeout-bucket-creation-test');
        
    } catch (error) {
        console.error('❌ Bucket creation failed:', error.message);
    }
    
    console.log('\n🎉 Timeout testing completed!');
    console.log('\n📋 Summary:');
    console.log('✓ Normal operations should complete quickly');
    console.log('✓ Network issues should timeout gracefully');
    console.log('✓ Large files should still upload within timeout limits');
    console.log('✓ Bucket operations should have appropriate timeouts');
}

// Run the timeout tests
testTimeoutScenarios().catch(console.error);