# Frontend Migration Guide: Base64 to S3 Image Upload

## Overview
The backend has been updated to support S3 image uploads instead of storing base64 images directly in PostgreSQL. This guide will help you update the frontend to work with the new system.

## Key Changes Made to Backend

### 1. Database Schema
- `images` field is now an array of S3 URLs: `text[]`
- `main_image_index` field to specify which image is the main one: `integer`
- Removed old `image` field (single base64 string)

### 2. API Endpoints Updated

#### Product Creation/Update
- **Endpoint**: `POST /products/create` and `PUT /products/update/:id`
- **Change**: Now accepts base64 images in the `images` array and automatically converts them to S3 URLs
- **Backward Compatibility**: ✅ Still accepts base64 images, but converts them to S3

#### New Image Management Endpoints
- `POST /products/:productId/images/upload` - Upload images via multipart form
- `DELETE /products/:productId/images/:imageIndex` - Delete specific image
- `PUT /products/:productId/images/main/:imageIndex` - Set main image

## Frontend Migration Steps

### Step 1: Update Data Models

```typescript
// Before
interface Product {
  id: number;
  title: string;
  sku: string;
  // ... other fields
  image?: string; // Single base64 image
}

// After
interface Product {
  id: number;
  title: string;
  sku: string;
  // ... other fields
  images: string[]; // Array of S3 URLs
  mainImageIndex: number; // Index of main image in the array
}
```

### Step 2: Update Product Creation Form

#### Option A: Continue Using Base64 (Recommended for minimal changes)
```typescript
// No changes needed to existing forms!
// Backend automatically converts base64 to S3 URLs

const createProduct = async (productData: {
  title: string;
  sku: string;
  images: string[]; // Can still be base64 strings
  mainImageIndex?: number;
  // ... other fields
}) => {
  const response = await fetch('/api/products/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(productData)
  });
  
  return response.json();
};
```

#### Option B: Use New Multipart Upload (Better for large images)
```typescript
const createProductWithFiles = async (
  productData: Omit<Product, 'images' | 'id'>,
  imageFiles: File[]
) => {
  // 1. Create product first
  const product = await createProduct(productData);
  
  // 2. Upload images separately
  if (imageFiles.length > 0) {
    const formData = new FormData();
    imageFiles.forEach((file, index) => {
      formData.append('images', file);
    });
    
    await fetch(`/api/products/${product.data.id}/images/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
  }
  
  return product;
};
```

### Step 3: Update Product Display Components

```tsx
// Before
const ProductImage = ({ product }: { product: Product }) => {
  return (
    <img 
      src={product.image || '/placeholder.jpg'} 
      alt={product.title}
    />
  );
};

// After
const ProductImage = ({ product }: { product: Product }) => {
  const mainImage = product.images?.[product.mainImageIndex || 0];
  
  return (
    <img 
      src={mainImage || '/placeholder.jpg'} 
      alt={product.title}
    />
  );
};

// Product Gallery Component
const ProductGallery = ({ product }: { product: Product }) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(product.mainImageIndex || 0);
  
  return (
    <div className="product-gallery">
      {/* Main Image */}
      <div className="main-image">
        <img 
          src={product.images?.[selectedImageIndex] || '/placeholder.jpg'} 
          alt={product.title}
          className="w-full h-64 object-cover"
        />
      </div>
      
      {/* Thumbnail Navigation */}
      {product.images && product.images.length > 1 && (
        <div className="thumbnails flex gap-2 mt-4">
          {product.images.map((imageUrl, index) => (
            <button
              key={index}
              onClick={() => setSelectedImageIndex(index)}
              className={`w-16 h-16 border-2 ${
                index === selectedImageIndex ? 'border-blue-500' : 'border-gray-300'
              }`}
            >
              <img 
                src={imageUrl} 
                alt={`${product.title} ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Step 4: Update Image Upload Components

```tsx
const ImageUploadComponent = ({ 
  onImagesChange 
}: { 
  onImagesChange: (images: string[]) => void 
}) => {
  const [images, setImages] = useState<string[]>([]);
  
  const handleFileSelect = async (files: FileList) => {
    const newImages: string[] = [];
    
    for (let file of Array.from(files)) {
      // Option A: Convert to base64 (backend handles S3 upload)
      const base64 = await fileToBase64(file);
      newImages.push(base64);
      
      // Option B: Upload directly to backend (if you want immediate feedback)
      // const formData = new FormData();
      // formData.append('image', file);
      // const response = await uploadImage(formData);
      // newImages.push(response.url);
    }
    
    const updatedImages = [...images, ...newImages];
    setImages(updatedImages);
    onImagesChange(updatedImages);
  };
  
  const removeImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);
    onImagesChange(updatedImages);
  };
  
  return (
    <div className="image-upload">
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
      />
      
      <div className="image-preview grid grid-cols-3 gap-4 mt-4">
        {images.map((image, index) => (
          <div key={index} className="relative">
            <img 
              src={image} 
              alt={`Upload ${index + 1}`}
              className="w-full h-32 object-cover rounded"
            />
            <button
              onClick={() => removeImage(index)}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
```

### Step 5: Update Product List Components

```tsx
// Before
const ProductCard = ({ product }: { product: Product }) => {
  return (
    <div className="product-card">
      <img src={product.image} alt={product.title} />
      <h3>{product.title}</h3>
    </div>
  );
};

// After
const ProductCard = ({ product }: { product: Product }) => {
  const mainImage = product.images?.[product.mainImageIndex || 0];
  
  return (
    <div className="product-card">
      <img src={mainImage || '/placeholder.jpg'} alt={product.title} />
      <h3>{product.title}</h3>
      {product.images && product.images.length > 1 && (
        <span className="image-count">+{product.images.length - 1} more</span>
      )}
    </div>
  );
};
```

### Step 6: Update Product Edit Forms

```tsx
const ProductEditForm = ({ product }: { product: Product }) => {
  const [formData, setFormData] = useState(product);
  
  const handleMainImageChange = async (newIndex: number) => {
    // Update main image on backend
    await fetch(`/api/products/${product.id}/images/main/${newIndex}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    setFormData({ ...formData, mainImageIndex: newIndex });
  };
  
  const handleImageDelete = async (imageIndex: number) => {
    // Delete image on backend
    await fetch(`/api/products/${product.id}/images/${imageIndex}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Update local state
    const newImages = formData.images.filter((_, index) => index !== imageIndex);
    const newMainIndex = formData.mainImageIndex >= imageIndex 
      ? Math.max(0, formData.mainImageIndex - 1)
      : formData.mainImageIndex;
      
    setFormData({ 
      ...formData, 
      images: newImages, 
      mainImageIndex: newMainIndex 
    });
  };
  
  return (
    <form>
      {/* Other form fields */}
      
      {/* Image Management */}
      <div className="image-management">
        <h3>Product Images</h3>
        <div className="images-grid">
          {formData.images.map((imageUrl, index) => (
            <div key={index} className="image-item">
              <img src={imageUrl} alt={`Product image ${index + 1}`} />
              <div className="image-controls">
                <button
                  type="button"
                  onClick={() => handleMainImageChange(index)}
                  className={index === formData.mainImageIndex ? 'active' : ''}
                >
                  {index === formData.mainImageIndex ? 'Main Image' : 'Set as Main'}
                </button>
                <button
                  type="button"
                  onClick={() => handleImageDelete(index)}
                  className="delete-btn"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
};
```

## API Reference

### Product Object Structure
```json
{
  "id": 1,
  "title": "Product Name",
  "sku": "PROD-001",
  "price": "$19.99",
  "priceValue": 1999,
  "images": [
    "https://s3.amazonaws.com/bucket/product-1/image-1.jpg",
    "https://s3.amazonaws.com/bucket/product-1/image-2.jpg"
  ],
  "mainImageIndex": 0,
  "category": "Electronics",
  "status": "active"
}
```

### Error Handling
```typescript
const handleApiError = (error: any) => {
  if (error.message?.includes('File too large')) {
    alert('Image file is too large. Maximum size is 5MB.');
  } else if (error.message?.includes('Invalid file type')) {
    alert('Only image files are allowed (jpg, png, gif, webp).');
  } else {
    alert('An error occurred while uploading images.');
  }
};
```

## Migration Checklist

- [ ] Update Product interface/type definitions
- [ ] Update product creation forms
- [ ] Update product display components
- [ ] Update product list components
- [ ] Update product edit forms
- [ ] Add image gallery component
- [ ] Update API calls
- [ ] Add error handling for new image endpoints
- [ ] Test with existing products
- [ ] Test image upload functionality
- [ ] Test image deletion functionality
- [ ] Test main image selection

## Backward Compatibility

✅ **The migration is backward compatible!**

- Existing frontend code that sends base64 images will continue to work
- Backend automatically converts base64 to S3 URLs
- You can migrate components gradually
- Old products with single images are handled gracefully

## Performance Recommendations

1. **Use the multipart upload endpoints** for better performance with large images
2. **Implement image compression** on the frontend before upload
3. **Add loading states** during image uploads
4. **Consider lazy loading** for product galleries
5. **Implement image caching** for better user experience

## Testing

Test these scenarios:
1. Create product with no images
2. Create product with single image (base64)
3. Create product with multiple images (base64)
4. Upload images using multipart form
5. Delete images from existing products
6. Change main image
7. View products with different image configurations