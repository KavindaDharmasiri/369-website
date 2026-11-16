# Saved bag import safety

Login and signup must not write, clear, or automatically replay the saved guest
bag (`cart`) or its uncertain-transfer receipt (`guestCartMigrationPending`).
The existing cart recovery UI uses `mergeGuestCart` and its persisted pre-send
receipt; an uncertain response requires review, not an automatic retry.

## Durable batch contract (requires cart-integrity migration)

`POST /api/cart/merge` requires a current active session, a 16–128 character
`Idempotency-Key` and `{ items: [...] }` (1–100 validated cart inputs). Product/SKU
identity and summed quantity define canonical input; client price/specification
snapshots cannot alter identity or trusted stored variant information. Duplicate
lines are consolidated, bounded to 1–1000 units, and sorted before hashing.

All validation, cart changes and the durable owner/key/hash/response receipt commit
in one PostgreSQL transaction. A transaction-scoped per-owner advisory lock
serializes cooperating cart writers across processes. Database uniqueness also
covers NULL SKU lines. Existing account quantities plus the whole incoming batch
must fit current saleability/stock/quantity bounds; no partial success or silent
capping is allowed. Same key/payload replays the original acknowledgement even
after restart; same key/different payload returns 409 `IDEMPOTENCY_CONFLICT`.
Receipt retention has no automatic expiry while clients may retry.

Success: `{ success: true, data: { requestKey, mergedLines, quantityAdded } }` plus
`Idempotency-Replayed: true|false`. A definitive transaction validation rejection
returns `CART_NOT_MERGED`; unexpected failures do not claim rollback certainty to
the browser. All responses are private/no-store; authentication rejects before
database mutation. Missing migration fails closed, never reverting to unsafe import.

Login/signup must continue preserving local bags. The legacy per-line recovery
receipt remains uncertain and must not automatically be upgraded/replayed as a
new batch. Only a durable batch acknowledgement permits removing the exact local
snapshot, after verifying unchanged owner/session and saved-bag contents.
New browser batch identities require Web Locks support. Without it, localStorage
cannot atomically arbitrate two tabs creating different keys, so automatic import
is refused and saved items remain. An existing matching durable identity can still
be confirmed safely. This is a deliberate availability tradeoff, not a cross-tab
atomicity claim for the legacy in-tab queue fallback.

The earlier implementation partially committed batches, silently capped quantities,
returned success for skipped items, and cached replay results only in memory
without a payload fingerprint. Login/signup then deleted all local items on HTTP
success. This behavior is removed, not claimed as completed R10.

Verification must include real PostgreSQL concurrent retries, rollback, restart
replay, changed-payload conflicts and NULL-SKU uniqueness. An isolated schema on
the authorized database is used for fixtures; customer rows must not be seeded,
deleted or used for destructive concurrency tests.
