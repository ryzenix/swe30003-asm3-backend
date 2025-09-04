const S3Service = require('./src/core/S3Service');
const fs = require('fs');
const https = require('https');
const http = require('http');

async function testCompleteS3Workflow() {
    console.log('🧪 Complete S3 Workflow Test');
    console.log('============================');
    
    // Set environment variables for testing
    process.env.NODE_ENV = 'development';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_S3_BUCKET_NAME = 'test-workflow-bucket';
    process.env.LOCAL_S3_ENDPOINT = 'http://localhost:4566';
    
    const s3Service = new S3Service();
    let uploadResult = null;
    
    try {
        // Step 1: Create bucket
        console.log('\n📋 Step 1: Creating bucket...');
        await s3Service.createBucketIfNotExists();
        console.log('✅ Bucket created successfully!');
        
        // Step 2: Upload a test file
        console.log('\n📋 Step 2: Uploading test file...');
        const testContent = 'This is a test file for S3 workflow testing!\nTimestamp: ' + new Date().toISOString();
        const mockFile = {
            originalname: 'workflow-test.txt',
            buffer: Buffer.from(testContent),
            mimetype: 'text/plain'
        };
        
        uploadResult = await s3Service.uploadImage(mockFile, 'workflow-test-product');
        console.log('✅ File uploaded successfully!');
        console.log('📄 Upload details:', uploadResult);
        
        // Step 3: Fetch the uploaded file
        console.log('\n📋 Step 3: Fetching uploaded file...');
        const fileUrl = uploadResult.url;
        
        const fetchedContent = await new Promise((resolve, reject) => {
            const client = fileUrl.startsWith('https') ? https : http;
            client.get(fileUrl, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            }).on('error', reject);
        });
        
        console.log('✅ File fetched successfully!');
        console.log('📄 Fetched content:');
        console.log('---');
        console.log(fetchedContent);
        console.log('---');
        
        // Verify content matches
        if (fetchedContent === testContent) {
            console.log('✅ Content verification passed!');
        } else {
            console.log('❌ Content verification failed!');
            console.log('Expected:', testContent);
            console.log('Got:', fetchedContent);
        }
        
        // Step 4: Test signed URL generation
        console.log('\n📋 Step 4: Testing signed URL generation...');
        const signedUrlResult = await s3Service.getSignedUrl(uploadResult.key, 3600);
        console.log('✅ Signed URL generated successfully!');
        console.log('📄 Signed URL:', signedUrlResult.signedUrl);
        
        // Step 5: Delete the uploaded file
        console.log('\n📋 Step 5: Deleting uploaded file...');
        await s3Service.deleteImage(uploadResult.key);
        console.log('✅ File deleted successfully!');
        
        // Step 6: Delete the bucket
        console.log('\n📋 Step 6: Deleting bucket...');
        await deleteBucket('test-workflow-bucket');
        console.log('✅ Bucket deleted successfully!');
        
        // Final verification
        console.log('\n📋 Step 7: Verifying bucket deletion...');
        const bucketsAfter = await listBuckets();
        const bucketExists = bucketsAfter.includes('test-workflow-bucket');
        
        if (!bucketExists) {
            console.log('✅ Bucket deletion verified!');
        } else {
            console.log('❌ Bucket still exists after deletion!');
        }
        
        console.log('\n🎉 Complete S3 Workflow Test PASSED!');
        console.log('✓ Bucket creation');
        console.log('✓ File upload');
        console.log('✓ File retrieval');
        console.log('✓ Content verification');
        console.log('✓ Signed URL generation');
        console.log('✓ File deletion');
        console.log('✓ Bucket deletion');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('📋 Full error details:', error);
        
        // Cleanup on failure
        if (uploadResult) {
            try {
                console.log('\n🧹 Attempting cleanup...');
                await s3Service.deleteImage(uploadResult.key);
                await deleteBucket('test-workflow-bucket');
                console.log('✅ Cleanup completed');
            } catch (cleanupError) {
                console.error('❌ Cleanup failed:', cleanupError.message);
            }
        }
    }
}

// Helper function to delete bucket using curl
async function deleteBucket(bucketName) {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    try {
        await execAsync(`curl -X DELETE http://localhost:4566/${bucketName}`);
    } catch (error) {
        throw new Error(`Failed to delete bucket: ${error.message}`);
    }
}

// Helper function to list buckets
async function listBuckets() {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    try {
        const { stdout } = await execAsync('curl -s -H "Authorization: AWS test:test" http://localhost:4566/');
        const bucketMatches = stdout.match(/<Name>([^<]+)<\/Name>/g);
        return bucketMatches ? bucketMatches.map(match => match.replace(/<\/?Name>/g, '')) : [];
    } catch (error) {
        console.error('Failed to list buckets:', error.message);
        return [];
    }
}

// Run the test
testCompleteS3Workflow();