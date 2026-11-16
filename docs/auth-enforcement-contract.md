# Current-account authorization

Protected order list/create/detail/status/PDF/request-resolution, profile,
cart/cart-item, wishlist, address, coupon-preview, notification, category and
subcategory administration, ads administration, settings/shipping mutation,
review creation, and audit routes now
recheck the account in PostgreSQL after JWT verification. Shared middleware routes
use the same `loadActiveUser` function.

- Missing, invalid, inactive, revoked, or unverifiable sessions: 401 and
  `Cache-Control: private, no-store`, before protected data access or mutation.
- Admin privileges derive from the current database role, not stale JWT claims.
- Legacy JWTs with no session version represent zero; after a database version
  increment they are rejected. Malformed version claims are rejected.
- A database without the pending session-version migration supports activation
  and role checks only. Revocation cannot be claimed until migration/deployment
  and all protected routes enforce versions. Other authentication mechanisms and
  UI session lifecycle still require review. Audit POST keeps its legacy best-effort
  no-op response for rejected telemetry; it must not write for rejected sessions.
- Order PDF retains its existing read-only cookie-token fallback; other listed
  handlers require their existing Authorization header. No cookie mutation path
  is introduced.

Verification is offline handler testing, not live database, browser, or deployment
evidence. A database error fails authentication closed; no fixture-only production
bypass is permitted.

Ads GET without an Authorization header remains public and active-only. Supplying
an Authorization header selects the private admin path, which must validate the
session and current role before querying any banners, and returns no-store data.

## Private catalog DTOs

Cart GET and wishlist GET are owner-scoped but do not confer product-administration
access. Their existing encrypted `data.cartItems` / `data.wishlist` envelopes and
current-price enrichment are preserved. Embedded products use the shared explicit
`publicProductSelect`: internal `createdBy`/`updatedBy` emails and tracking tags are
not selected. Ordinary reads do not select unapplied slug columns or retry database
errors with a broader product projection. Errors remain private/no-store and do
not expose database details. These changes do not delete saved items or establish
publication/availability, uniqueness, or concurrent mutation guarantees.

The browser identity store is display-only. It distinguishes server hydration from
a signed-out browser, subscribes to storage and same-tab token changes, and omits
expired identity snapshots. It does not replace server JWT/current-account checks.
