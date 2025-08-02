# AWS S3 Setup Guide

This guide will help you set up AWS S3 for the product image upload functionality.

## Prerequisites

1. AWS Account
2. AWS CLI (optional but recommended)
3. Node.js application with the updated dependencies

## Step 1: Create an S3 Bucket

### Option A: Using AWS Console

1. **Sign in to AWS Console**
   - Go to https://console.aws.amazon.com/
   - Sign in with your AWS account

2. **Create S3 Bucket**
   - Navigate to S3 service
   - Click "Create bucket"
   - Choose a unique bucket name (e.g., `my-pharmacy-product-images`)
   - Select your preferred region (e.g., `us-east-1`)
   - **Important**: Uncheck "Block all public access" (we need public read access for images)
   - Click "Create bucket"

3. **Configure Bucket for Public Read Access**
   - Select your bucket
   - Go to "Permissions" tab
   - Click "Edit" under "Block public access"
   - Uncheck all options
   - Save changes
   - Confirm by typing "confirm"

4. **Add Bucket Policy for Public Read**
   - In the "Permissions" tab, click "Bucket policy"
   - Add this policy (replace `your-bucket-name` with your actual bucket name):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

### Option B: Using AWS CLI

```bash
# Create bucket
aws s3 mb s3://my-pharmacy-product-images --region us-east-1

# Configure bucket for public read access
aws s3api put-public-access-block --bucket my-pharmacy-product-images --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Add bucket policy
aws s3api put-bucket-policy --bucket my-pharmacy-product-images --policy '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::my-pharmacy-product-images/*"
        }
    ]
}'
```

## Step 2: Create IAM User for Application

1. **Create IAM User**
   - Go to IAM service in AWS Console
   - Click "Users" → "Create user"
   - Enter username (e.g., `pharmacy-app-s3-user`)
   - Select "Programmatic access"
   - Click "Next"

2. **Attach Permissions**
   - Click "Attach existing policies directly"
   - Search for and select "AmazonS3FullAccess"
   - Click "Next" → "Create user"

3. **Get Access Keys**
   - Click on the created user
   - Go to "Security credentials" tab
   - Click "Create access key"
   - Select "Application running outside AWS"
   - Click "Next" → "Create access key"
   - **Important**: Download the CSV file or copy the Access Key ID and Secret Access Key

## Step 3: Configure CORS (Cross-Origin Resource Sharing)

1. **Go to your S3 bucket**
2. **Click "Permissions" tab**
3. **Scroll down to "Cross-origin resource sharing (CORS)"**
4. **Click "Edit" and add this configuration:**

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag"
        ]
    }
]
```

## Step 4: Update Environment Variables

Update your `.env` file with the actual values:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=my-pharmacy-product-images
```

**Replace with your actual values:**
- `AWS_ACCESS_KEY_ID`: Your IAM user's access key ID
- `AWS_SECRET_ACCESS_KEY`: Your IAM user's secret access key
- `AWS_REGION`: The region where you created your S3 bucket
- `AWS_S3_BUCKET_NAME`: Your actual bucket name

## Step 5: Test the Configuration

1. **Install dependencies** (if not already done):
```bash
npm install
```

2. **Start your application**:
```bash
npm run dev
```

3. **Test image upload** using the API endpoint:
```bash
curl -X POST \
  -H "Authorization: Bearer your-token" \
  -F "image=@test-image.jpg" \
  http://localhost:3000/products/1/images/upload
```

## Security Best Practices

### 1. IAM Policy (More Restrictive)
Instead of using `AmazonS3FullAccess`, create a custom policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::your-bucket-name"
        }
    ]
}
```

### 2. Environment Security
- Never commit `.env` files to version control
- Use AWS Secrets Manager for production environments
- Rotate access keys regularly

### 3. Bucket Security
- Enable versioning for backup
- Set up lifecycle policies for cost management
- Monitor access logs

## Troubleshooting

### Common Issues:

1. **"Access Denied" errors**
   - Check IAM user permissions
   - Verify bucket policy
   - Ensure CORS is configured

2. **"NoSuchBucket" errors**
   - Verify bucket name in environment variables
   - Check bucket region matches AWS_REGION

3. **"InvalidAccessKeyId" errors**
   - Verify AWS_ACCESS_KEY_ID is correct
   - Check if IAM user exists and is active

4. **CORS errors in browser**
   - Verify CORS configuration in S3 bucket
   - Check allowed origins match your domain

### Testing Commands:

```bash
# Test S3 connection
aws s3 ls s3://your-bucket-name

# Test file upload
aws s3 cp test-file.txt s3://your-bucket-name/

# Test file download
aws s3 cp s3://your-bucket-name/test-file.txt ./
```

## Cost Considerations

- S3 storage: ~$0.023 per GB per month
- Data transfer: ~$0.09 per GB (outbound)
- PUT/POST requests: ~$0.0005 per 1,000 requests
- GET requests: ~$0.0004 per 10,000 requests

For a typical pharmacy application, costs should be minimal (< $10/month for moderate usage).

## Next Steps

1. Test the image upload functionality
2. Monitor S3 usage and costs
3. Set up CloudWatch alarms for monitoring
4. Consider implementing image optimization/resizing
5. Set up backup strategies for important images 