# Exact money and customer-approved checkout quotes

This supersedes the old approximate client-preview-only confirmation flow. It does
not introduce a new tax/exemption/stacking/payment policy. Existing behavior remains:
discounts round the unit sale price, line totals multiply that rounded unit price,
tax and percentage shipping use the discounted subtotal before coupon deduction,
and coupon limits/precedence retain their existing meaning. The business owner must
still approve chargeTax allocation, legal tax treatment and payment-state changes.

All monetary calculations use integer minor units (two decimals, LKR) with exact
decimal/rational percentage calculations and nonnegative half-up cent rounding.
No binary floating-point arithmetic determines persisted line totals or order sums.
Amounts outside DECIMAL(10,2) bounds fail before stock/coupon/order writes. JSON
amounts remain numbers for compatibility, but arithmetic converts them to minor units.

## POST /api/orders/quote

Current active bearer authentication required. Body uses the existing canonical
checkout fields (delivery/contact, payment method, 1–100 bounded product/SKU lines,
optional coupon). Client prices/totals/spec snapshots are ignored. A repeatable-read
transaction resolves published products, active matching SKUs, current prices,
promotions, shipping, tax, coupon eligibility and stock. No stock/coupon/cart writes
or reservations occur. Response is private/no-store:

`{ success: true, data: { quoteToken, expiresAt, currency: "LKR", lines, totals } }`.

Totals include subtotal, productDiscount, coupon discount, shippingFee, tax and total.
The signed two-minute token contains only owner/input/pricing hashes and purpose /
expiry metadata, not delivery/contact data. Signing uses a purpose-derived key, so
a quote token cannot be accepted as a login JWT. A quote is not a stock reservation.

## POST /api/orders

New orders require the quoteToken alongside the existing checkout and Idempotency-Key.
The order transaction revalidates the token's purpose/owner/input/expiry and recomputes
the same trusted calculation. Changed prices, SKU unit amounts, coupon identity or
totals return `409 QUOTE_CHANGED`, with no committed stock/coupon/order/cart/receipt
changes. Missing quote: `428 QUOTE_REQUIRED`; expired/invalid/mismatched quotes return
typed errors, never an unapproved order. The browser obtains a fresh quote, displays
its exact amounts, and asks for confirmation before creating an order.

Quote tokens are not part of the durable order fingerprint. A successful existing
owner/key/input receipt replays its original order even after the quote expires or
prices change; it must never become a second order. Failed creations keep the client
identity until success or explicit resolution, because another concurrent retry may
have committed. Renewing a quote never permits silently replacing an uncertain key.

The browser's final confirmation uses the server quote, explicitly flags differences
from its preliminary display, and blocks after another change until the customer
reviews/reconfirms a fresh quote. Existing external order clients must adopt quotes
before making new orders; old keys can still resolve/replay committed orders.

## Verification

- `tests/money-quote.test.cjs` covers exact minor-unit half-up rounding, exponent and
  malformed-input rejection, range bounds, percentage/discount policy, purpose-separated
  signing (a session JWT signed with the root secret never verifies as a quote), owner
  and input binding, expiry, and `QUOTE_CHANGED` for totals/coupon/line/policy changes.
- `tests/checkout-safety.test.cjs` covers `QUOTE_REQUIRED` before any transaction,
  `QUOTE_EXPIRED` for new orders, `QUOTE_CHANGED` after a price change with no writes,
  and a committed replay that succeeds with an expired quote.
- `tests/checkout-state.test.cjs` covers server-quote parsing, exact minor-unit total
  comparison (floating noise ignored, one-cent changes flagged), and the changed-total
  review text.
- `npm run test:postgres` adds the real-PostgreSQL checks listed in
  `docs/postgres-verification.md`; the latest isolated run passed **21/21**.
- Browser re-acceptance of the new quote/review dialog is still pending; the earlier
  browser run predates the quote requirement.
