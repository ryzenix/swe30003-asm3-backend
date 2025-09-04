const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const Logger = require('./Logger');

class S3Service {
    constructor() {
        this.logger = new Logger();
        
        // Configure S3 client
        const s3Config = {
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        };

        this.s3Client = new S3Client(s3Config);
        this.bucketName = process.env.AWS_S3_BUCKET_NAME;
        
        if (!this.bucketName) {
            throw new Error('AWS_S3_BUCKET_NAME environment variable is required');
        }
        
        this.logger.info(`S3Service initialized - Bucket: ${this.bucketName}`);
    }

    async uploadImage(file, productId) {
        try {
            if (!file) {
                throw new Error('No file provided');
            }



            const fileExtension = file.originalname.split('.').pop();
            const fileName = `products/${productId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
            
            const uploadParams = {
                Bucket: this.bucketName,
                Key: fileName,
                Body: file.buffer,
                ContentType: file.mimetype
                // Note: ACL removed to support buckets with ACLs disabled
                // For public access, configure bucket policy instead of object ACLs
            };

            const command = new PutObjectCommand(uploadParams);
            
            // Add timeout wrapper to prevent hanging
            const uploadPromise = this.s3Client.send(command);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('S3 upload timeout after 30 seconds'));
                }, 30000); // 30 second timeout
            });
            
            await Promise.race([uploadPromise, timeoutPromise]);

            // Generate AWS S3 URL
            const imageUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileName}`;
            
            this.logger.info(`Image uploaded successfully: ${imageUrl}`);
            
            return {
                success: true,
                url: imageUrl,
                key: fileName
            };
        } catch (error) {
            this.logger.error('S3 upload error:', error);
            throw new Error(`Failed to upload image: ${error.message}`);
        }
    }

    async deleteImage(imageKey, bucketName = null) {
        try {
            if (!imageKey) {
                throw new Error('Image key is required');
            }

            // Use provided bucket name or fall back to current bucket
            const targetBucket = bucketName || this.bucketName;

            const deleteParams = {
                Bucket: targetBucket,
                Key: imageKey
            };

            const command = new DeleteObjectCommand(deleteParams);
            
            // Add timeout to delete operation
            const deletePromise = this.s3Client.send(command);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('S3 delete timeout after 15 seconds'));
                }, 15000);
            });
            
            await Promise.race([deletePromise, timeoutPromise]);

            this.logger.info(`Image deleted successfully: ${imageKey} from bucket: ${targetBucket}`);
            
            return {
                success: true,
                message: 'Image deleted successfully',
                bucket: targetBucket
            };
        } catch (error) {
            this.logger.error(`S3 delete error for key ${imageKey} in bucket ${bucketName || this.bucketName}:`, error);
            throw new Error(`Failed to delete image: ${error.message}`);
        }
    }

    async deleteImageFromUrl(imageUrl) {
        try {
            if (!imageUrl) {
                throw new Error('Image URL is required');
            }

            const imageKey = this.extractKeyFromUrl(imageUrl);
            const bucketName = this.extractBucketFromUrl(imageUrl);

            if (!imageKey) {
                throw new Error('Could not extract image key from URL');
            }

            this.logger.info(`Attempting to delete image: ${imageKey} from bucket: ${bucketName}`);
            
            return await this.deleteImage(imageKey, bucketName);
        } catch (error) {
            this.logger.error('Delete image from URL error:', error);
            throw error;
        }
    }

    async getSignedUrl(key, expiresIn = 3600) {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
            
            return {
                success: true,
                signedUrl
            };
        } catch (error) {
            this.logger.error('S3 signed URL error:', error);
            throw new Error(`Failed to generate signed URL: ${error.message}`);
        }
    }

    extractKeyFromUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname.substring(1); // Remove leading slash
        } catch (error) {
            this.logger.error('URL parsing error:', error);
            return null;
        }
    }

    extractBucketFromUrl(url) {
        try {
            const urlObj = new URL(url);
            
            // Handle different S3 URL formats
            if (urlObj.hostname.includes('s3.amazonaws.com')) {
                // Format: https://bucket-name.s3.region.amazonaws.com/key
                return urlObj.hostname.split('.')[0];
            } else if (urlObj.hostname.includes('amazonaws.com')) {
                // Format: https://s3.region.amazonaws.com/bucket-name/key
                const pathParts = urlObj.pathname.split('/');
                return pathParts[1]; // bucket name is first part after /
            }
            
            // Fallback: assume it's a custom domain or unknown format
            this.logger.warn(`Unknown S3 URL format: ${url}, using current bucket`);
            return this.bucketName;
        } catch (error) {
            this.logger.error('URL parsing error for bucket extraction:', error);
            return this.bucketName; // Fallback to current bucket
        }
    }
}

module.exports = S3Service; 