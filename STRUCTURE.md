# Project Structure

## Pages Organization

### Public Pages
- `/` - Landing page
- `/signin` - Login page
- `/signup` - Registration page

### Customer Pages (`/customer/*`)
- `/customer/shop` - Main shop page
- `/customer/women` - Women's category
- `/customer/men` - Men's category (to be created)
- `/customer/product` - Product detail page

### Admin Pages (`/admin/*`)
- `/admin` - Admin dashboard
- `/admin/products` - Product management (to be created)
- `/admin/orders` - Order management (to be created)
- `/admin/users` - User management (to be created)

### API Routes (`/api/*`)
- `/api/register` - User registration
- `/api/login` - User login
- `/api/data` - Sample data endpoint
- `/api/init-db` - Database initialization

## Authentication Flow
1. User registers → `/api/register` → Redirects to `/customer/shop`
2. User logs in → `/api/login` → Checks userType:
   - `customer` → `/customer/shop`
   - `admin` → `/admin`
