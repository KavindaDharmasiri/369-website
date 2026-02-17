# Product Flow Implementation - Migration Guide

## Steps to Complete Setup

### 1. Update Environment Variables
Add to `.env.local`:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 2. Run Prisma Migration
```bash
npx prisma migrate dev --name add_product_flow
npx prisma generate
```

### 3. Database Schema Changes
- Updated `Product` model with all fields from Java entity
- Added `ProductImage`, `ProductSpec`, `ProductSpecAttr`, `ProductSku` models
- Added `CommonIndex` model for SKU generation
- Updated `Category` and `SubCategory` relations

### 4. API Endpoints Created
- `POST /api/products` - Create product with auto-generated base SKU
- `GET /api/products` - List all products
- `GET /api/subcategories?categoryId=X` - Get subcategories by category
- `POST /api/upload` - Upload images to Cloudinary

### 5. Base SKU Generation Logic
Format: `{CATEGORY_CODE}/{SUBCATEGORY_CODE}/{PRODUCT_ID}`
Example: `BAB/BAT/000094`

- Uses CommonIndex table to generate unique codes
- First 3 letters of category/subcategory name
- Appends count if code exists
- Product ID padded to 6 digits

### 6. Add Product Flow
1. Fill product details form
2. Upload image to Cloudinary
3. Submit creates product in database
4. Auto-generates base SKU
5. Stores product ID in sessionStorage
6. Redirects to specifications page

## Next Steps
- Implement specifications page functionality
- Implement SKU generation page
- Update products list page to fetch from API
