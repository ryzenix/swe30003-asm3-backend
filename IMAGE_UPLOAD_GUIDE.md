# Product Image Upload Guide

This guide explains how to use the new product image upload functionality with S3 integration.

## Setup

### 1. Install Dependencies

The following new dependencies have been added to `package.json`:

```json
{
  "@aws-sdk/client-s3": "^3.540.0",
  "@aws-sdk/s3-request-presigner": "^3.540.0",
  "multer": "^1.4.5-lts.1"
}
```

Run `npm install` to install the new dependencies.

### 2. Environment Variables

Add the following AWS S3 configuration to your `.env` file:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-s3-bucket-name
```

### 3. Database Schema Update

The products table has been updated to support image arrays:

```sql
-- New fields added to products table
images text[] DEFAULT '{}'::text[],
main_image_index integer DEFAULT 0
```

## API Endpoints

### Upload Image
**POST** `/products/:productId/images/upload`

Upload a new image for a product.

**Headers:**
- `Content-Type: multipart/form-data`
- `Authorization: Bearer <token>` (for authenticated users)

**Body:**
- `image`: Image file (max 5MB, supported formats: jpg, jpeg, png, gif, webp)

**Response:**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "imageUrl": "https://bucket.s3.region.amazonaws.com/products/123/image.jpg",
    "imageKey": "products/123/image.jpg",
    "updatedImages": ["url1", "url2", "url3"]
  }
}
```

### Delete Image
**DELETE** `/products/:productId/images/:imageIndex`

Delete a specific image from a product.

**Headers:**
- `Authorization: Bearer <token>` (for authenticated users)

**Response:**
```json
{
  "success": true,
  "message": "Image deleted successfully",
  "data": {
    "deletedImageUrl": "https://bucket.s3.region.amazonaws.com/products/123/image.jpg",
    "updatedImages": ["url1", "url2"],
    "mainImageIndex": 0
  }
}
```

### Set Main Image
**PUT** `/products/:productId/images/:imageIndex/main`

Set a specific image as the main image for a product.

**Headers:**
- `Authorization: Bearer <token>` (for authenticated users)

**Response:**
```json
{
  "success": true,
  "message": "Main image updated successfully",
  "data": {
    "mainImageIndex": 1,
    "mainImageUrl": "https://bucket.s3.region.amazonaws.com/products/123/image2.jpg"
  }
}
```

## Product Model Changes

The Product model now includes image array support:

### Create Product
When creating a product, you can now include:
- `images`: Array of image URLs
- `mainImageIndex`: Index of the main image (default: 0)

### Update Product
When updating a product, you can modify:
- `images`: Array of image URLs
- `mainImageIndex`: Index of the main image

### Get Product
Product responses now include:
- `images`: Array of image URLs
- `mainImageIndex`: Index of the main image

## File Upload Configuration

- **Max file size**: 5MB
- **Supported formats**: jpg, jpeg, png, gif, webp
- **Storage**: AWS S3 with public read access
- **File naming**: `products/{productId}/{timestamp}-{random}.{extension}`

## Error Handling

The API includes comprehensive error handling for:
- Invalid file types
- File size limits
- S3 upload failures
- Invalid product IDs
- Invalid image indices
- Authentication failures

## Security

- All image upload endpoints require authentication
- Only superusers and pharmacists can upload/delete images
- File type validation prevents malicious uploads
- S3 bucket should be configured with appropriate CORS settings

## Example Usage

### Upload an image:
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "image=@product-image.jpg" \
  http://localhost:3000/products/123/images/upload
```

### Delete an image:
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  http://localhost:3000/products/123/images/0
```

### Set main image:
```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  http://localhost:3000/products/123/images/1/main
``` 