const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const Logger = require('./Logger');

class S3Service {
    constructor() {
        this.logger = new Logger();
        this.s3Client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
        this.bucketName = process.env.AWS_S3_BUCKET_NAME;
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
                ContentType: file.mimetype,
                ACL: 'public-read'
            };

            const command = new PutObjectCommand(uploadParams);
            await this.s3Client.send(command);

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

    async deleteImage(imageKey) {
        try {
            if (!imageKey) {
                throw new Error('Image key is required');
            }

            const deleteParams = {
                Bucket: this.bucketName,
                Key: imageKey
            };

            const command = new DeleteObjectCommand(deleteParams);
            await this.s3Client.send(command);

            this.logger.info(`Image deleted successfully: ${imageKey}`);
            
            return {
                success: true,
                message: 'Image deleted successfully'
            };
        } catch (error) {
            this.logger.error('S3 delete error:', error);
            throw new Error(`Failed to delete image: ${error.message}`);
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
}

module.exports = S3Service; 