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
- `POST /api/public/opportunity-scan`
- `GET /api/public/opportunity-scan/:scanId/result`
- `GET /api/public/opportunity-scan/:scanId?offset=`
- `POST /api/public/supplier-connection`

## Opportunity Finder

`https://opportunity.eanrunner.com/se` lets a retailer select Sweden, Denmark, or Finland, submit a public webshop URL, review suggested catalogue products from EU suppliers only, and request an introduction to the relevant suppliers. Country-specific entry points use `/se`, `/dk`, and `/fi`. Each completed scan gets a shareable country-aware result URL such as `/se/:scanId`, which reloads the same stored product suggestions. It is free for retailers and does not sell products, take payment, or arrange delivery. On `eanrunner.com`, `/opportunity` serves the finder and the legacy `/opportunity-finder` URL redirects there.

### Local setup

1. Configure the public catalogue variables in `api/.env` as described above.
2. Set `EANRUNNER_OPPORTUNITY_API_URL` and `EANRUNNER_OPPORTUNITY_API_TOKEN` to the authenticated private EANrunner introduction endpoint. Do not expose either value in the web app.
3. Run `npm --prefix api run dev` and `npm --prefix web run dev`, then visit `/opportunity-finder`.

### Scan and privacy boundaries

Scans run only on the API. The scanner accepts public `http`/`https` URLs, resolves and pins public DNS addresses for every request and redirect, and rejects local, private, reserved, and cloud-metadata address ranges. It uses a small budget: up to eight public pages, three redirects, 5 MB for the initial page, 512 KB per additional HTML/sitemap response, seven seconds per request, and twenty seconds in total. It observes accessible public pages only; it does not bypass robots restrictions, authentication, CAPTCHAs, or bot protection.

The finder extracts public structured data, EAN/GTIN values, category/brand labels, and locale/currency hints. The selected country controls whether DK, SE, or FI market data is used. It prioritizes repeated product-category signals and retailer navigation categories, and maps the strongest matching category to `dbo.showcase_product` first. It excludes detected EANs, then adds one lower-priority category at a time only while fewer than ten opportunities have been found. The initial response shows up to ten in-stock products; when available, **Load more** retrieves up to ten further stored results from the same scan. Results rotate across brands and use at most two products per brand when enough distinct brands are available. It requires in-stock products and deterministically prefers margin grades A/B (using grade C only when few stronger matches exist). The displayed expected margin is an estimate derived from the public market price and margin grade, not a supplier quote. Responses contain only public-safe catalogue fields; they never expose supplier identities, costs, exact margins, or private matching data.

### Private handoff contract

The API sends a server-to-server JSON request to `EANRUNNER_OPPORTUNITY_API_URL` with a Bearer token and `Idempotency-Key`. The payload includes `scanId`, normalized shop URL, inferred market, selected EANs, contact details, and a consent timestamp. The private EANrunner service must resolve selected EANs to suppliers and accept `POST` requests with those fields. A missing, rejected, or timed-out private handoff returns a truthful error to the retailer; the browser never receives the private URL, token, or supplier information.

Known MVP limits: scans are intentionally partial, a result is not a full assortment audit, market/category signals are estimates, and the retailer must configure the private handoff before introduction requests can succeed.

## Notes

- The daily snapshot is owned by the EANRunner Function App; this repo only
  reads the result.
- Deployment cutover notes: `AZURE_CUTOVER.md`, `CLOUD_RUN_CUTOVER.md` (these
  predate the showcase split and reference the old prod DB — update env values
  to the showcase DB when re-hosting the API).
