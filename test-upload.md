# File Upload Test Guide

## ✅ Fixed Issues

The `PayloadTooLargeError: request entity too large` error has been resolved by:

1. **Increased Express body parser limits**:
   - `express.json({ limit: '10mb' })`
   - `express.urlencoded({ extended: true, limit: '10mb' })`

2. **Enhanced multer configuration**:
   - Added `fieldSize: 10 * 1024 * 1024` for other fields
   - Improved error messages

3. **Added comprehensive error handling**:
   - Multer-specific error handling
   - File type validation errors
   - File size limit errors

## 🧪 Testing the Upload Functionality

### 1. Test with curl (without authentication first)

```bash
# Test basic server response
curl -X GET http://localhost:3000/products/list

# Test file upload (this will fail without auth, but should not give payload error)
curl -X POST \
  -F "image=@test-image.jpg" \
  http://localhost:3000/products/1/images/upload
```

### 2. Test with proper authentication

```bash
# First, get a valid token (you'll need to implement this based on your auth system)
# Then test upload with authentication:
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "image=@test-image.jpg" \
  http://localhost:3000/products/1/images/upload
```

### 3. Test error scenarios

```bash
# Test with non-image file (should fail with proper error)
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "image=@test-file.txt" \
  http://localhost:3000/products/1/images/upload

# Test with very large file (should fail with size limit error)
# Create a large file first:
dd if=/dev/zero of=large-file.jpg bs=1M count=10
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "image=@large-file.jpg" \
  http://localhost:3000/products/1/images/upload
```

## 📋 Expected Responses

### Successful Upload:
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "imageUrl": "https://bucket.s3.region.amazonaws.com/products/1/image.jpg",
    "imageKey": "products/1/image.jpg",
    "updatedImages": ["https://bucket.s3.region.amazonaws.com/products/1/image.jpg"]
  }
}
```

### File Too Large Error:
```json
{
  "error": "File too large",
  "message": "Maximum file size is 5MB"
}
```

### Invalid File Type Error:
```json
{
  "error": "Invalid file type",
  "message": "Only image files are allowed. Supported formats: jpg, jpeg, png, gif, webp"
}
```

### Authentication Error:
```json
{
  "error": "Authentication required"
}
```

## 🔧 Configuration Summary

### Express Configuration (App.js):
- JSON body parser: 10MB limit
- URL-encoded parser: 10MB limit
- Added error handling middleware

### Multer Configuration (ProductRoutes.js):
- File size limit: 5MB
- Field size limit: 10MB
- File type validation: image/* only
- Memory storage for processing

### Error Handling:
- Multer-specific errors
- File type validation errors
- File size limit errors
- General upload errors

## 🚀 Next Steps

1. **Configure AWS S3** (follow AWS_S3_SETUP_GUIDE.md)
2. **Test with real images** using the endpoints
3. **Monitor server logs** for any remaining issues
4. **Test with your frontend application**

The payload size error should now be resolved, and you should be able to upload images up to 5MB in size. 