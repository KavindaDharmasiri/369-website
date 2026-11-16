# Checkout safety contract

This records intentional behavior changes; existing success/encryption envelopes remain unchanged.
The current cart contract supersedes the historical per-line import section below:
see `cart-import-contract.md` for durable atomic batches. Cart add/patch/delete/merge
and checkout use a shared per-owner transaction lock. Database revisions advance on
every cart update, and checkout clears only matching submitted rows at their captured
revision, not the entire owner's bag. NULL SKU identities are unique in PostgreSQL.
The first batch does not claim durable order idempotency, session revocation, a new tax policy,
complete decimal accounting, full SEO, or live PostgreSQL concurrency verification.

## Orders

- `POST /api/orders` and `GET /api/orders` require a valid bearer token; missing/invalid tokens return 401.
- POST requires a JSON object with 1–100 items, delivery/contact strings, a valid email shape,
  and `paymentMethod` of `cash` or `card` (both remain payment-at-delivery choices).
- Each item requires a positive integer product ID and integer quantity 1–1000.
  The optional SKU ID must be a positive integer. Safety limits are application limits, not stock guarantees.
- Invalid JSON/input returns 400 before transaction work. Client-supplied names, prices, totals,
  and specifications do not define stored order values.
- Only published, active, nondeleted, in-stock products under active matching categories may be ordered.
  Products with any SKUs require a valid active SKU belonging to that product. A SKU-less product
  retains its existing stock-status semantics; it does not gain an invented numerical inventory.
- Repeated product/SKU lines are combined, bounded by the per-item limit, and checked together.
- Stock deduction is conditional on remaining quantity inside the order transaction. Lost stock
  races and exhausted coupon redemptions return 409; transactions must roll back all related changes.
- Names and variant snapshots come from product/SKU records. Zero tax remains zero. Existing
  subtotal-before-coupon tax treatment is retained pending business approval.
- Finite coupon usage is incremented conditionally, not by an unconditional last-use update.
- Order creation now requires an `Idempotency-Key` header (see the third-batch contract below).

## Cart and discounts

- Cart POST/PATCH quantities are bounded positive integers; omitted POST quantity defaults to one.
- Discounts and coupons are validated against the effective merged record for both create/update:
  finite positive value, percentage at most 100, valid type, valid optional dates and ordered windows.
- Discount scope must identify one valid positive target; changing scope clears unrelated target IDs.
  Target-only PATCH is supported. Existing product > subcategory > category discount priority is retained.
- Coupon optional money limits are nonnegative; usage limits are nonnegative integers (zero means
  no redemptions). Empty optional form values clear the value; omitted PATCH values are preserved.
- Invalid legacy coupon/discount records cannot generate negative prices, surcharges, or NaN totals.
- Invalid requests return 400; nonexistent targets/records return 404 where explicitly checked.

## Settings and profiles

- All settings values are validated before starting writes; related settings use one transaction.
  Zero tax and low-stock threshold are preserved. Rate/threshold values must be finite and nonnegative;
  thresholds must be integers. Existing response envelopes are preserved.
- Profile PUT only returns explicit public profile fields. Password hashes are never part of the
  update response, including after client-side decryption.

## Verification

`npm test` runs offline Node regression tests against the actual TypeScript handlers/helpers.
Database/auth/encryption substitutes are explicit and no real credentials/database are loaded.
These checks establish validation, query intent, response shape, and simulated rollback behavior;
they do not establish real PostgreSQL isolation, deployment compatibility, browser UX, or upstream reliability.

`GET /api/health` is now dynamic and noncached. It returns only `{ "status": "ok" }`
with 200 or `{ "status": "unavailable" }` with 503. The prior public secret-configuration
and database-error diagnostics were intentionally removed. Readiness now has a
2-second coalesced HTTP deadline; `/api/health/live` is independent liveness. Driver
query cancellation/connection budgets and deployed monitoring remain separate concerns.

## Second batch: guest-cart recovery and checkout state

- Signing in does not discard a device bag because the account bag is already nonempty.
  Saved lines are sent to the existing cart API and checkpointed one at a time only after
  a successful, matching cart-item acknowledgement. Server validation still applies.
- A rejected line and unprocessed lines remain local. Invalid saved JSON is left intact.
  The UI distinguishes pending saved items from the account lines actually being ordered.
- A persisted in-flight receipt pauses automatic replay after a lost response, crash,
  uncertain 5xx result, malformed acknowledgement, or failed storage checkpoint. An explicit
  user review is required before retrying an uncertain import. This is conservative recovery,
  not durable server-side idempotency or an atomic batch merge; manually retrying an uncertain
  success can still add quantities again. R31 stays open until that server feature is verified.
- App-controlled guest writers share a same-tab queue and Web Lock where available. Raw
  snapshot checks avoid overwriting detected concurrent edits. Cross-tab atomicity is not
  guaranteed in browsers without Web Locks; detect-and-review behavior remains necessary.
- Checkout loads independent resources concurrently and waits for all to settle before
  enabling retry. A required cart/shipping/tax failure prevents ordering on fallback totals.
- Cart edits require successful HTTP and mutation envelopes before changing local state.
  They invalidate applied coupons and older preview responses; the customer must apply the
  coupon again after an edit. New orders now use the shared authoritative quote endpoint
  (`docs/checkout-quote-contract.md`): the confirmation dialog displays server totals,
  explicitly reviews changed amounts, and the order route rejects a missing, expired or
  changed quote before committing writes.
- The order submission guard starts before the confirmation dialog. Unknown order outcomes
  direct the customer to order history rather than suggesting an automatic retry. This guard
  does not replace R04's durable server idempotency.
- Confirmation/success dialogs use plain text, never interpolated HTML. Payment display only
  reports `paid` for an explicit PAID status, not for a card method or delivery state. Payment
  and fulfilment remain coupled in the schema pending the approved R09 redesign.
- Coupon preview rejects invalid tokens with 401 and malformed codes/subtotals with 400.
  Existing valid-preview/invalid-coupon encrypted envelopes are retained.
- Order detail GET/PATCH reject invalid tokens and malformed IDs. GET retains customer
  ownership filtering, includes SKU codes, and sends `Cache-Control: private, no-store`.

Second-batch tests simulate storage, transfer acknowledgements, HTTP responses, and database
queries. They do not exercise a real browser, real PostgreSQL, cross-tab Web Locks, or live
network timeouts. No migration or live customer data was changed.

## Third batch: durable order request identity (schema migration required)

- `POST /api/orders` requires `Idempotency-Key`: 16–128 ASCII letters/digits/`._:-`,
  beginning with a letter or digit. Missing/invalid keys return 400 before DB work.
  This is an intentional breaking change for callers that have not supplied a key.
- The key is scoped to the authenticated user and order-creation endpoint. A canonical
  fingerprint includes normalized delivery/contact data, payment method, coupon, and combined,
  deterministically ordered product/SKU quantities. Client prices/names/totals/specs are ignored.
- A durable receipt is inserted FIRST inside the same transaction as stock, coupon, cart,
  order and item writes. A unique `(userId, key)` constraint arbitrates simultaneous first
  requests before either request can deduct inventory. The completed receipt stores the
  initial successful response and order ID. There is no separately committed pending receipt.
- Same user/key/fingerprint replays the stored success without new writes or notifications,
  even after inventory, promotions, order status, or account-cart contents change. A different
  fingerprint returns 409 `IDEMPOTENCY_CONFLICT`. Different users do not share receipts.
- A failed order transaction rolls its new receipt back as well. Typed business rejections
  from that transaction return `ORDER_NOT_CREATED`. Unknown errors retain the client's key.
  Transaction conflicts/timeouts must not cause the client to silently generate another key.
- Responses include `Cache-Control: private, no-store` and `Idempotency-Replayed: true|false`.
  A committed but incomplete/corrupt receipt returns a conflict for review, never a new order.
- The browser persists only the scoped key and SHA-256 input fingerprint, NOT the address,
  phone, email, token, or whole request, in local storage before submitting. Unchanged retries
  reuse that key; a changed checkout cannot replace an unconfirmed attempt automatically.
  Known success or a durable `ORDER_REQUEST_ABANDONED` result clears only the matching attempt.
  `ORDER_NOT_CREATED` describes that failed transaction, not the absence of another concurrent
  retry; the browser conservatively keeps the key until success or resolution. Web Locks coordinate
  preparation where supported; the server guarantee is per key, not across distinct keys.
- Apply reviewed forward migrations BEFORE deploying receipt-dependent code. The configured
  database is not changed by this implementation session. Receipt retention must not delete
  identities while a retry remains possible; no automatic expiry is implemented.
- Guest-cart batch idempotency remains separate/open. These receipts protect order creation,
  not the existing sequential guest-import POSTs.
- `POST /api/orders/requests/{key}` is an authenticated, owner-scoped resolution operation.
  It returns an existing completed order, or commits a permanent `{kind: "abandoned"}` tombstone
  under the same unique identity before reporting `state: "abandoned"`. A late order POST with
  that retired key cannot create an order. If an earlier creation owns the key, the competing
  insert waits for its transaction outcome. This operation never cancels a completed order.
