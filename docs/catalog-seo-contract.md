# Public catalog and SEO contract

## Compatibility period

Public pages/catalog APIs use explicit product/category/subcategory selections
that do not implicitly read pending slug columns or expose internal actor emails.
Numeric product and category-name canonicals remain authoritative until a reviewed
slug cutover. Existing slug lookups may resolve where the schema supports them;
they do not introduce a second canonical. Sitemaps use the same ID/name URLs.

Shared catalog filters require active marketplace products, active categories and
subcategories, and no soft deletion. Stock is separate: sold-out published
products remain useful 200 pages. The legacy BOTH market remains accepted by
product pages but is not yet supported consistently by checkout/catalog lists;
resolve that business rule before release.

## Errors and index policy

- Missing/hidden products and unknown collections: notFound; missing product ID:
  notFound; missing category type: redirect to shop. Category redirect/notFound
  exceptions must never be swallowed by generic catch blocks.
- Infrastructure failures must not be mislabeled as permanent missing products.
  Catalog APIs return a safe no-store 503 on outages; server page failures reach
  the existing 500 error boundary. A dedicated page 503 mechanism remains pending.
- Search via either `search` or `q`: noindex, follow; exclude from sitemap.
- Static sitemap entries omit invented lastModified times; entity entries use
  stored updatedAt. Split sitemap support is required before the 50,000-URL gate.

## Product offers and variant URLs

`?id=PRODUCT_ID&sku=SKU_ID` preselects a real active SKU when its stored variant
keys can be mapped to ordered specifications. Invalid/inactive/unmappable variant
IDs are not advertised in ProductGroup. Parent canonical excludes the selector.
Concrete variant offers use the current SKU price, actual discount and stock.
Unknown SKU availability produces no offer instead of invented InStock claims.
Ratings are emitted only for nonempty valid public aggregates. Script data is
escaped before embedding; unsupported brand/GTIN/MPN/shipping promises are omitted.

No-store catalog API responses trade cache efficiency for current promotion/
publication data while cache invalidation is unfinished. Category listings are
bounded at 200; numbered pagination and global discounted-price sorting across
larger catalogs remain pending.
