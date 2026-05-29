# WebVersion (EANcat)

Public, internet-facing product catalog for EANrunner. It reads from an
**isolated showcase database** — never the production EANrunner database.

## Architecture

- The public catalog reads a single denormalized, read-optimized table
  (`dbo.showcase_product`) in a **dedicated** Azure SQL database
  (`eanrunner-catalog-db`), separate from production.
- That table is refreshed **once daily** by a sync job in the EANRunner
  Function App (`functions/sync_showcase.py`, 07:15 UTC), which projects a
  public-safe snapshot from production. See the EANRunner repo for the data
  layer (Bicep module `infra/modules/catalog-sql.bicep`, DDL
  `infra/sql/showcase/showcase_product.sql`).
- The showcase DB holds ONLY public-safe fields: per-market margin grade
  (A–F / N/A), stock status, competitor count, market price, and one market
  (PriceRunner) link. It contains **no** supplier names, cost prices, or margin
  percentages — so none can leak.
- There is **no login/auth**. The site is fully public.

## Scope

The public catalog shows, per market (DK/SE/FI):
- `in stock` / `not in stock`
- margin grade `A`–`F` (`N/A` fallback)
- competitor count + one market link
- Shareable filter URLs (filters are encoded in the query string).

## Folders

- `web/` React + Vite frontend
- `api/` Express + TypeScript backend (reads the showcase DB only)

## Quick Start

1. Copy env templates:
   - `cp web/.env.example web/.env`
   - `cp api/.env.example api/.env`
2. Point `api/.env` at the showcase DB (`eanrunner-catalog-sql` /
   `eanrunner-catalog-db`).
3. Start API: `npm --prefix api run dev`
4. Start web: `npm --prefix web run dev`

## API Endpoints

- `GET /health`
- `GET /api/public/products?query=&limit=&page=&market=&grades=&category=&brand=&inStock=&hasImage=`
- `GET /api/public/products/:ean?market=`
- `GET /api/public/brand-clusters`
- `GET /api/public/categories`
- `GET /api/public/stats`

## Notes

- The daily snapshot is owned by the EANRunner Function App; this repo only
  reads the result.
- Deployment cutover notes: `AZURE_CUTOVER.md`, `CLOUD_RUN_CUTOVER.md` (these
  predate the showcase split and reference the old prod DB — update env values
  to the showcase DB when re-hosting the API).
