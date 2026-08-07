# Project Structure

## Pages Organization

### Public Pages
- `/` - Landing page
- `/signin` - Login page
- `/signup` - Registration page

### Customer Pages (`/customer/*`)
- `/customer/shop` - Main shop page
- `/customer/women` - Women's category (redirects to category listing)
- `/customer/men` - Men's category (redirects to category listing)
- `/customer/category` - Category listing with filters
- `/customer/product` - Product detail page
- `/customer/cart` - Checkout page
- `/customer/account` - Account overview
- `/customer/account/profile` - Profile page
- `/customer/account/orders` - Order history
- `/customer/account/orders/[id]` - Order detail
- `/customer/account/addresses` - Address management

### Admin Pages (`/admin/*`)
- `/admin` - Admin dashboard
- `/admin/products` - Product management
- `/admin/products/add` - Add product
- `/admin/products/sku` - SKU management
- `/admin/products/specifications` - Specifications management
- `/admin/orders` - Order management
- `/admin/orders/[id]` - Order detail
- `/admin/category` - Category management
- `/admin/subcategory` - Subcategory management
- `/admin/transactions` - Transactions

### API Routes (`/api/*`)
- `/api/register`, `/api/login` - Authentication
- `/api/products` + nested - Product, image, SKU, spec management
- `/api/categories`, `/api/subcategories` - Catalog management
- `/api/cart`, `/api/orders` - Cart and order flow
- `/api/addresses` - Customer addresses
- `/api/shipping` - Shipping fees
- `/api/upload` - Cloudinary image upload
- `/api/audit`, `/api/admin/stats` - Admin tooling

## Authentication Flow
1. User registers → `/api/register` → Redirects to `/customer/shop`
2. User logs in → `/api/login` → Checks userType:
   - `customer` → `/customer/shop`
   - `admin` → `/admin`

## Security
- Middleware verifies the JWT signature (HMAC-SHA256) before granting admin/account access
- Admin-only actions are enforced server-side per route
- Order totals are recomputed server-side from the database
