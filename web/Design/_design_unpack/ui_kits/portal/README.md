# EANrunner Portal · UI Kit

High-fidelity, mainly cosmetic recreation of the **EANrunner customer
portal** SPA. Use this as a starting point for mocks, prototypes, or
slide assets — copy components out, swap in your own copy/data.

## What's here

```
ui_kits/portal/
  README.md                        ← you are here
  index.html                       ← interactive click-thru
  styles.css                       ← portal-specific CSS, pulls in foundations
  app.jsx                          ← screen router + AuthContext stub

  components/
    Primitives.jsx                 ← Button, Card, Input, Label, Select, Switch
    Pills.jsx                      ← MarginPill, StockChip, FeedStatusPill, FilterChip
    Navigation.jsx                 ← fixed 60px nav rail
    FacetPanel.jsx                 ← brand/category/supplier facet (left sidebar)
    ProductRow.jsx                 ← canonical search-results <tr>
    Toast.jsx                      ← bottom-right notification stack
    Icons.jsx                      ← inline lucide SVGs (only the ones the kit uses)

  screens/
    LoginScreen.jsx                ← centered LoginCard on background
    SearchScreen.jsx               ← /  — the main view; sidebar + filters + table
    PricePilotScreen.jsx           ← /pricepilot — the curated feed
    ProductDetailScreen.jsx        ← /product/:ean
    AdminPipelineScreen.jsx        ← /admin/pipeline (amber chrome)

  data/
    products.js                    ← seed of fake products with EANs, brands, margins
```

## How to run

Open `index.html` directly in a browser — everything is loaded from CDN
(React 18, Babel standalone). No build step.

## Click-thru flow

1. Land on the **Login** screen (`/login`). Type anything in email/password
   (or hit "Use demo account") and submit — the demo `AuthContext` accepts
   any credentials.
2. **Search** view (`/`) — 8 seed products, filters on the left. Type in
   the keyword input to filter live. Click `+` on any row to add it to
   the feed → the pill flips to `✓ on` (rose/red on subsequent click =
   off). Top-right nav switches you to Feed, Product detail, Pipeline.
3. **Feed** view (`/pricepilot`) — see what you added. Empty by default.
4. **Product detail** (`/product/:ean`) — click any product title.
   Shows image, supplier breakdown, market pricing.
5. **Admin Pipeline** (`/admin/pipeline`) — amber-chromed admin screen.
   Toggle "View as admin" in the user dropdown bottom-left to enable
   the admin nav items.

## What this kit deliberately does NOT do

- Real backend / persistence. Auth and feed state are in-memory.
- Mobile bottom-tab-bar variant. Desktop only.
- The AI editor, the supplier-onboarding flow, the customer-suppliers
  matrix, or the user-management screen. Those exist in the real
  source but weren't reproduced — the *visual* vocabulary needed for
  them is already covered by Search + Pipeline + the component set.

## Provenance

All components are simplified visual recreations of their counterparts
in <https://github.com/gaggelak/EANRunner/tree/main/client/src/components>.
When in doubt, compare against the source — the goal is "looks identical
in a screenshot", not "behaves identically when poked".
