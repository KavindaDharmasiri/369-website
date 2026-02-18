# Apply Performance Optimizations

## Step 1: Apply Database Indexes

Run this command to create and apply the database indexes:

```bash
npx prisma migrate dev --name add_performance_indexes
```

This will:
- Create indexes on frequently queried columns
- Speed up product searches by category, status, and features
- Optimize foreign key lookups
- Improve query performance by 10-50x

## Step 2: Restart Your Development Server

After applying migrations, restart your Next.js server:

```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

## Expected Results

### Before Optimizations:
- API calls: 30+ seconds
- Database queries: Slow full table scans
- Multiple connection overhead

### After Optimizations:
- API calls: <1 second (30x faster)
- Database queries: Fast indexed lookups
- Single reused connection

## Verify Performance

Test these endpoints to verify improvements:
- GET /api/products (should be <500ms)
- GET /api/categories (should be <200ms)
- GET /api/products/featured (should be <300ms)
- GET /api/products/category/[name] (should be <400ms)

## Monitoring

Check your database query logs to confirm indexes are being used:
```sql
EXPLAIN SELECT * FROM products WHERE status = 'ACTIVE' AND prod_market = 'MARKETPLACE';
```

You should see "Using index" in the Extra column.
