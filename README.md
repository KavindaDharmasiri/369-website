# 369 Website

Full-stack Next.js (App Router) clothing shop with SSR, MySQL/Prisma, Cloudinary uploads, and admin dashboard.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables — copy `.env.example` to `.env.local` and fill in real values:
```bash
copy .env.example .env.local
```
Required: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_ENCRYPTION_KEY`, and the `CLOUDINARY_*` keys.
`NEXT_PUBLIC_ENCRYPTION_KEY` must equal `ENCRYPTION_KEY`.

3. Sync the database schema:
```bash
npm run prisma:push
```

4. Run development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

- `src/app/` - Frontend pages and layouts
- `src/app/api/` - Backend API routes
- `src/lib/` - Shared utilities (auth, db, encryption)
- `src/components/` - Reusable UI components
- `prisma/` - Database schema and migrations

## Features

- Customer: shop, category pages (women/men), product detail, cart, checkout, order history, address book
- Admin: dashboard, product/SKU/spec management, categories, subcategories, orders
- JWT authentication with signature-verified middleware
- Cloudinary image uploads, PDF invoices, audit trail

## Notes

- `.env` / `.env.local` are gitignored — never commit real secrets. Rotate any secret that has been committed.
- Production builds require the dev server to be stopped first (shared `.next` folder).
