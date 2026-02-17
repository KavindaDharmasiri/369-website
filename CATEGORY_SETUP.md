# Category Feature Setup Instructions

## 1. Generate Prisma Client and Push Schema to Database

Run these commands in your terminal:

```bash
npm run prisma:generate
npm run prisma:push
```

Or manually:

```bash
npx prisma generate
npx prisma db push
```

## 2. Features Implemented

### Prisma Model
- Category model with name, description, isActive status, and timestamps
- Unique constraint on category name

### API Endpoints
- POST /api/categories - Create new category
- GET /api/categories - Fetch categories with filters

### Validations
- Name: Required, minimum 2 characters
- Description: Optional, but if provided minimum 10 characters
- Duplicate name check (unique constraint)

### UI Features
- Inline validation with error messages
- Toast notifications for success/error
- Real-time category fetching
- Filter by name, description, and active status
- Loading states

## 3. Test the Feature

1. Start your dev server: `npm run dev`
2. Navigate to the category management page
3. Click "Add New Category"
4. Try adding a category with:
   - Empty name (should show error)
   - Short name (< 2 chars, should show error)
   - Short description (< 10 chars, should show error)
   - Valid data (should show success toast)
   - Duplicate name (should show error toast)
