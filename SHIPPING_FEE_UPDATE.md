# Shipping Fee - Dynamic Implementation

## Changes Made

### Before
- Hardcoded shipping fee: `const shipping = 25`
- Fixed shipping type: "Shipping"

### After
- Dynamic shipping fee fetched from database
- Dynamic shipping type (e.g., "Standard", "Express", "Free")
- Real-time updates from `shipping_fees` table

## Implementation

### 1. Cart Component (`src/components/Cart.tsx`)

**New State Variables:**
```typescript
const [shippingFee, setShippingFee] = useState(0)
const [shippingType, setShippingType] = useState('Standard')
```

**New Function:**
```typescript
const loadShippingFee = async () => {
  try {
    const res = await fetch('/api/shipping')
    const result = await res.json()
    if (result.data) {
      setShippingFee(Number(result.data.value))
      setShippingType(result.data.type)
    }
  } catch (error) {
    console.error('Failed to load shipping fee:', error)
  }
}
```

**Updated Display:**
```jsx
<div className={styles.summaryRow}>
  <span>Shipping ({shippingType})</span>
  <span>LKR {shippingFee.toLocaleString()}</span>
</div>
```

### 2. API Endpoint (Already Exists)

**GET `/api/shipping`**
- Fetches active shipping fee from database
- Returns the first active record from `shipping_fees` table

**POST `/api/shipping`** (Admin only)
- Creates new shipping fee
- Deactivates all previous fees
- Sets new fee as active

## Database Schema

```prisma
model ShippingFee {
  id        Int      @id @default(autoincrement())
  type      String   // e.g., "Standard", "Express", "Free"
  value     Decimal  @db.Decimal(10, 2)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## How It Works

1. **Cart Opens** → Triggers `loadShippingFee()`
2. **API Call** → `GET /api/shipping`
3. **Database Query** → Finds first active shipping fee
4. **State Update** → Sets `shippingFee` and `shippingType`
5. **Display** → Shows dynamic values in cart summary

## Benefits

✅ **Admin Control** - Change shipping fees without code changes
✅ **Multiple Types** - Support different shipping methods
✅ **Real-time** - Updates immediately when changed
✅ **Flexible** - Can add promotions (e.g., "Free Shipping")
✅ **Audit Trail** - Track shipping fee changes over time

## Admin Management

To change shipping fee, admin can:
1. Go to admin panel
2. Update shipping settings
3. POST to `/api/shipping` with new values
4. All carts will show new fee immediately

## Example Shipping Types

- "Standard Shipping" - LKR 250
- "Express Delivery" - LKR 500
- "Free Shipping" - LKR 0
- "Same Day Delivery" - LKR 1000

## Testing

1. Add items to cart
2. Open cart popup
3. Check shipping fee displays correctly
4. Verify it matches database value
5. Change shipping fee in database
6. Reopen cart to see updated value

## Future Enhancements

- [ ] Location-based shipping fees
- [ ] Weight-based calculation
- [ ] Free shipping threshold (e.g., free over LKR 5000)
- [ ] Multiple shipping options for customer to choose
- [ ] Estimated delivery dates
