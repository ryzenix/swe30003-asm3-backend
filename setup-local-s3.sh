#!/bin/bash

echo "🚀 Setting up Local S3 for Development"
echo "======================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

echo "✅ Docker and docker-compose are available"

# Start LocalStack
echo "📦 Starting LocalStack..."
docker-compose up -d localstack

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to be ready..."
sleep 10

# Check if LocalStack is running
if curl -s http://localhost:4566/_localstack/health > /dev/null; then
    echo "✅ LocalStack is running on http://localhost:4566"
else
    echo "❌ LocalStack failed to start. Check the logs with: docker-compose logs localstack"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI is not installed. You can install it with:"
    echo "   macOS: brew install awscli"
    echo "   Ubuntu: sudo apt install awscli"
    echo "   Or download from: https://aws.amazon.com/cli/"
    echo ""
    echo "📝 You can still test the application, but you won't be able to use AWS CLI commands."
else
    echo "✅ AWS CLI is available"
    
    # Configure AWS CLI for LocalStack
    echo "🔧 Configuring AWS CLI for LocalStack..."
    aws configure set aws_access_key_id test --profile localstack
    aws configure set aws_secret_access_key test --profile localstack
    aws configure set region us-east-1 --profile localstack
    aws configure set output json --profile localstack
    
    # Create bucket
    echo "🪣 Creating S3 bucket..."
    aws --endpoint-url=http://localhost:4566 --profile localstack s3 mb s3://local-bucket 2>/dev/null || echo "Bucket might already exist"
    
    # Test upload
    echo "🧪 Testing S3 functionality..."
    echo "Hello Local S3!" > test-s3.txt
    aws --endpoint-url=http://localhost:4566 --profile localstack s3 cp test-s3.txt s3://local-bucket/ 2>/dev/null
    rm test-s3.txt
    
    echo "✅ Local S3 is ready!"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update your .env file with local S3 settings:"
echo "   AWS_ACCESS_KEY_ID=test"
echo "   AWS_SECRET_ACCESS_KEY=test"
echo "   AWS_S3_BUCKET_NAME=local-bucket"
echo "   LOCAL_S3_ENDPOINT=http://localhost:4566"
echo ""
echo "2. Start your application:"
echo "   npm run dev"
echo ""
echo "3. Test image upload:"
echo "   curl -X POST -H 'Authorization: Bearer your-token' -F 'image=@test-image.jpg' http://localhost:3000/products/1/images/upload"
echo ""
echo "🔧 Useful commands:"
echo "   - Stop LocalStack: docker-compose down"
echo "   - View logs: docker-compose logs localstack"
echo "   - List buckets: aws --endpoint-url=http://localhost:4566 --profile localstack s3 ls"
echo "" 