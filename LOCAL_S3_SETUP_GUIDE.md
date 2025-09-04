# Local S3 Setup Guide for Development

This guide will help you set up a local S3-compatible service for development.

## Option 1: LocalStack (Recommended)

### Install LocalStack

```bash
# Using pip
pip install localstack

# Or using Docker (recommended)
docker run --rm -it -p 4566:4566 -p 4510-4559:4510-4559 localstack/localstack
```

### Start LocalStack

```bash
# Start LocalStack
localstack start

# Or with Docker
docker run --rm -it \
  -p 4566:4566 \
  -p 4510-4559:4510-4559 \
  -e SERVICES=s3 \
  -e DEBUG=1 \
  localstack/localstack
```

### Create Bucket

```bash
# Install AWS CLI if you haven't already
# macOS: brew install awscli
# Ubuntu: sudo apt install awscli

# Configure AWS CLI for LocalStack
aws configure set aws_access_key_id test
aws configure set aws_secret_access_key test
aws configure set region us-east-1
aws configure set output json

# Create bucket
aws --endpoint-url=http://localhost:4566 s3 mb s3://local-bucket

# List buckets to verify
aws --endpoint-url=http://localhost:4566 s3 ls
```

## Option 2: MinIO

### Install MinIO

```bash
# Using Docker
docker run -p 9000:9000 -p 9001:9001 \
  --name minio \
  -e "MINIO_ROOT_USER=admin" \
  -e "MINIO_ROOT_PASSWORD=password123" \
  -v minio_data:/data \
  minio/minio server /data --console-address ":9001"
```

### Access MinIO Console
- Open http://localhost:9001
- Login with admin/password123
- Create a bucket named `local-bucket`

### Configure AWS CLI for MinIO

```bash
aws configure set aws_access_key_id admin
aws configure set aws_secret_access_key password123
aws configure set region us-east-1
aws configure set output json

# Create bucket
aws --endpoint-url=http://localhost:9000 s3 mb s3://local-bucket
```

## Environment Configuration

### Update your `.env` file:

```env
# For LocalStack
LOCAL_S3_ENDPOINT=http://localhost:4566

# For MinIO
LOCAL_S3_ENDPOINT=http://localhost:9000

# Other S3 settings (for local development, these can be dummy values)
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=local-bucket
```

## Testing Local S3

### 1. Test with AWS CLI

```bash
# Upload a test file
echo "Hello Local S3!" > test.txt
aws --endpoint-url=http://localhost:4566 s3 cp test.txt s3://local-bucket/

# List files
aws --endpoint-url=http://localhost:4566 s3 ls s3://local-bucket/

# Download file
aws --endpoint-url=http://localhost:4566 s3 cp s3://local-bucket/test.txt downloaded.txt
```

### 2. Test with your application

```bash
# Start your application
npm run dev

# Test image upload (replace with your actual token)
curl -X POST \
  -H "Authorization: Bearer your-token" \
  -F "image=@test-image.jpg" \
  http://localhost:3000/products/1/images/upload
```

## Docker Compose Setup (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
      - "4510-4559:4510-4559"
    environment:
      - SERVICES=s3
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - "${TMPDIR:-/tmp}/localstack:/tmp/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"

  # Alternative: MinIO
  # minio:
  #   image: minio/minio:latest
  #   ports:
  #     - "9000:9000"
  #     - "9001:9001"
  #   environment:
  #     - MINIO_ROOT_USER=admin
  #     - MINIO_ROOT_PASSWORD=password123
  #   volumes:
  #     - minio_data:/data
  #   command: server /data --console-address ":9001"

volumes:
  minio_data:
```

Start with:
```bash
docker-compose up -d
```

## Environment Detection

The application automatically detects the environment:

- **Development** (`NODE_ENV=development`): Uses local S3 endpoint
- **Production**: Uses AWS S3

### URL Generation

- **Local Development**: `http://localhost:4566/local-bucket/products/1/image.jpg`
- **Production**: `https://bucket-name.s3.region.amazonaws.com/products/1/image.jpg`

## Troubleshooting

### Common Issues:

1. **Connection refused**
   - Check if LocalStack/MinIO is running
   - Verify the endpoint URL in `.env`

2. **Access denied**
   - Verify credentials (use `test/test` for LocalStack)
   - Check bucket permissions

3. **Bucket not found**
   - Create the bucket first
   - Verify bucket name in `.env`

### Testing Commands:

```bash
# Test S3 connection
aws --endpoint-url=http://localhost:4566 s3 ls

# Test bucket creation
aws --endpoint-url=http://localhost:4566 s3 mb s3://local-bucket

# Test file upload
aws --endpoint-url=http://localhost:4566 s3 cp test.txt s3://local-bucket/
```

## Benefits of Local S3

1. **No AWS costs** during development
2. **Faster development** cycle
3. **Offline development** possible
4. **Easy testing** of S3 functionality
5. **Consistent environment** across team

## Next Steps

1. Start your local S3 service
2. Update your `.env` file with local settings
3. Test the image upload functionality
4. Verify URLs are generated correctly for local environment 