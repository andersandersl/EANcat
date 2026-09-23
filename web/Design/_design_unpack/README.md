# EANrunner Design System

> Visual + interaction language for **EANrunner**, a B2B product-feed pipeline
> for Nordic electronics resellers. This folder contains the foundations,
> tokens, brand assets, and a high-fidelity UI kit you can pull from when
> designing screens, mocks, slides, or production code that should "feel
> EANrunner".

---

## 1 · What EANrunner actually is

EANrunner ingests product data from **5 distributors** (Cenor, Difox, DCS,
Dremote, Egenta — ~494,000 unique EANs in total), consolidates them down to
the cheapest supplier per EAN, enriches with content (Icecat API), translates
to Swedish/Danish/Finnish (OpenAI), and serves each customer a curated
"feed" of products that gets pushed hourly to their webshop.

The customer-facing surface is a **single SPA** ("EANrunner customer portal")
where buyers at electronics resellers:

1. **Search the catalog** (`/`) — filter ~half a million products by brand,
   category, supplier, EAN, MPN, margin range, stock, image, with per-market
   margin pills (DK / SE / FI based on PriceRunner data).
2. **Curate a feed** (`/pricepilot`) — see the products they've selected,
   tune pricing rules ("PricePilot"), and manage what gets pushed to their
   webshop.
3. **Inspect a product** (`/product/:ean`) — image gallery, supplier
   breakdown, market pricing, stock, push history.
4. **(Admin)** — pipeline status, customer-supplier wiring, onboarding,
   user management.

There is **one product** here: the SPA. There is no marketing site, no
mobile app, no docs site. Design accordingly: dense, tabular, professional,
opinionated. Customers are operators, not consumers.

### Real customer language

The product is multilingual and casually mixes Danish + English in the UI
("Bestillingsvare — kun fjernlager", "Bruger management", "Add to feed").
Domain terms are **load-bearing**: see [`CONTEXT.md`](https://github.com/gaggelak/EANRunner/blob/main/CONTEXT.md)
in the source repo for the authoritative glossary. Key terms:

| Term | Meaning |
|---|---|
| **EAN** | A 13-digit product barcode. Primary key for everything. |
| **Feed** | The customer's *curated* selection of EANs they've chosen to sell. Persistent. |
| **Feed delivery** | The hourly *transient* payload pushed to the customer's webshop. Built from the feed. |
| **PR margin** | Margin vs PriceRunner price for a target market (DK/SE/FI). The number that decides everything. |
| **Supplier** | One of the 5 distributors. Each EAN may be carried by multiple; the cheapest wins. |
| **PricePilot** | The pricing-rules engine that decides what to charge the end customer. |
| **Gate / cycle / phase** | Hourly orchestrator concepts. Surfaces in the admin pipeline view. |

Don't invent new domain words. Use these.

---

## 2 · Sources used to build this system

This system was assembled by reading the open-source EANrunner repository
end-to-end. **All visual decisions are grounded in code that ships**, not
in screenshots or guesswork.

- **GitHub repo (primary):** <https://github.com/gaggelak/EANRunner> — see
  in particular:
  - `client/src/index.css` — the canonical color tokens
  - `client/tailwind.config.ts` — token → utility mapping
  - `client/src/components/` — all the React components reproduced in our UI kit
  - `client/src/pages/` — `SearchProducts.tsx`, `PricePilot.tsx`, `Login.tsx`
  - `client/src/assets/` — logo files (PNG + SVG)
  - `CONTEXT.md` — product glossary
  - `README.md` — backend architecture overview

The source app is a **Vite + React + TypeScript + shadcn/ui + Tailwind**
project (Lovable.dev). Most components in `ui_kits/portal/` are simplified
cosmetic recreations of their shadcn-based originals — same visual output,
fewer abstractions.

If you want to go deeper than what's documented here, **clone the repo and
read the source** — it's well-commented and self-explanatory.

---

## 3 · Content fundamentals

### Voice & tone

- **Operator-direct.** This is a tool for someone who's going to use it 40
  hours a week. No fluff, no marketing. *"Added to feed."* *"Refresh
  failed."* *"Feed cap reached — remove a product first or contact support
  to raise your cap."*
- **Stating what just happened, not what to feel about it.** Toasts read
  like server log lines, not chat replies. *"Market data refreshed.
  Updated 3/4 markets across 25 products."*
- **Diagnostic precision over politeness.** When something fails the
  message says **what** failed (`Refresh failed`) and the original
  exception message verbatim.
- **Mixed Danish + English in the same UI.** Buttons & headings are
  English (*"Add to feed"*, *"Refresh all margins"*); contextual tooltips
  and inventory status are sometimes Danish (*"Bestillingsvare — kun
  fjernlager"*, *"leveringstid ~4–13 dage"*, *"kl. 03:32"*). This is
  intentional and reflects who customers are. If you're writing new copy,
  match the surrounding context — don't translate Danish to English just
  because you can.
- **"You" vs "I":** mostly *neither*. Copy is impersonal and procedural —
  *"Filters: None"*, *"Search by name, brand, or EAN…"*, *"Feed is full —
  remove a product first."* Use "your" sparingly for ownership ("your
  feed", "your feed cap").

### Casing

- **Buttons & inline actions: Sentence case.** *"Add to feed"*, *"Refresh
  all margins"*, *"Sign out"*. Never Title Case, never ALL CAPS.
- **CardTitle / page headings: Title-ish but mostly Sentence.** *"Search
  Products"*, *"Customer suppliers"*, *"Bruger management"*.
- **Eyebrows / column headers: ALL CAPS** with `tracking-wide`. *FEED*,
  *EAN*, *PR MARGIN*, *SUPPLIER*. Always `text-xs` (12px).
- **Country / market codes: ALL CAPS.** *DK*, *SE*, *FI*. Always.

### Numbers, dates, formatting

- **Currency:** always show currency code or symbol. Prices in **EUR**
  (`en-IE` locale, `Intl.NumberFormat`). Internal/raw fields may carry
  SEK öre or CZK — display as native currency, never mix.
- **Margin:** signed percentage, one decimal. `+24.5%`, `-3.2%`, `—` for
  null. Always tabular-nums.
- **Stock:** integer count, no commas under 1000. `62` / `Out` / `4` (with
  delivery-days tooltip).
- **Counts:** `total.toLocaleString()` — thousands separators on, no
  decimals. *"494,000 products"*, *"25 loaded"*.
- **Times:** Danish-style for log/timeline rows — *"kl. 03:32 · 4.2s"*.
  Full timestamps use `Intl.DateTimeFormat('da-DK')`.
- **Null/missing:** em-dash `—`. Never "N/A", never "null", never blank.
- **EANs and tabular numbers:** always `font-variant-numeric: tabular-nums`
  so they line up across rows.

### What we don't do

- ❌ No emoji in product copy. Anywhere. (Status uses colored dots and
  shaped chips — never 🔴/🟢.)
- ❌ No gradients in copy or branding. (Logo & icon: solid blue or white.)
- ❌ No exclamation points outside error messages — and rarely there.
- ❌ No "we" voice. The product doesn't speak in the first person.
- ❌ No emoji-only error states. (*"No products match your filters."*,
  not *"😢 Nothing found"*.)

### Sample copy snippets to learn from

```
Sign in  /  EANrunner customer portal
EANrunner – Product Feed
EANrunner product feed – access over 100,000 products at competitive
  wholesale prices from reliable European distributors.

Search Products  ·  Source: ip_agency · 494,217 products
Filters: None
Search by name, brand, or EAN…
DK margin ≥ %   /   FI margin ≤ %
In stock only   /   With image
PR margin: high → low (active market)
Refresh all margins
Add all (25)
No products match your filters.

Added to feed — EAN 4013288234186
Removed from feed — EAN 4013288234186
Restored to feed — EAN 4013288234186
Market data refreshed — Updated 3/4 markets across 25 products.
Refresh failed — <verbatim exception>

Bestillingsvare — kun fjernlager
4 stk · leveringstid ~4–13 dage
50 på lager  /  +12 fra fjernlager (~7 dage)
Feed cap reached — remove a product first or contact support to raise your cap.
Feed is full — remove a product first.
```

---

## 4 · Visual foundations

### Color

The system has exactly **two accent colors** plus four status colors. All
HSL, all in `colors_and_type.css`.

| Role | Color | Hex | When |
|---|---|---|---|
| **Primary (Cobalt)** | `hsl(221 92% 55%)` | `#1A5EFF` | Primary buttons, active nav, links, focus rings, the brand. |
| **Admin (Amber)** | `hsl(38 92% 50%)` | `#F59E0B` | **Only** for admin/staff-only nav items and badges. Amber says "you are in operator-tools territory". Never used outside admin scope. |
| Success | `emerald-500/600` | `#10B981` | Margins ≥ 20%, in-stock chips, "added to feed". |
| Warning | `amber-500` | `#F59E0B` | Margins 5–20%, remote-stock chips. (Same hex as admin; context disambiguates.) |
| Destructive | `rose-500` | `#EF4444` | Out-of-stock, negative margins, dismissed feed status, errors. |
| Neutral (no data) | `zinc-300/500` | n/a | `—` cells, disabled. |

**Surface stack — never deviate:**

```
background  #F3F5F9   page chrome (cool tinted off-white)
card        #FFFFFF   the actual content surface (pure white)
muted       #EAECF1   inactive form chips, progress-bar track
```

**Pill / chip recipe** (margin, stock, feed-status — see `MarginPill.tsx`):

```
bg: <color>-500/15     ←  the wash
text: <color>-700      ←  body text
ring: 1px <color>-500/30..40   ←  the soft outline
active variant: bg-color-200, text-color-900, ring-2 color-500/60
inactive variant: bg-color-50, text-color-700/70, ring-1 color-200/60
```

Color **never** appears as a solid 100% block on a non-data surface
(except the Primary button and the active-nav square). Status color
always reads through the 15% wash.

### Typography

- **Primary face:** Inter. Fallback stack: `"Inter", "Segoe UI", "Roboto",
  -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`.
- **Mono:** JetBrains Mono. Used for EANs, raw IDs, code snippets in admin
  views. *(The source repo does not specify a mono face — JetBrains Mono
  is our substitution. Flagging this so you can swap if you have a
  preference.)*
- **Base size: 14px** (`html { font-size: 14px }`). EANrunner is dense.
  Don't bump this up "for readability" — the whole layout is designed
  around a 14px floor.
- **Sizes:** display 28 / h1 22 / h2 18 / h3 16 / body 14 / small 13 /
  xs 12 / micro 11. Full token list in `colors_and_type.css`.
- **Weights:** 400, 500 (table headers, body strong), 600 (titles, pills,
  buttons), 700 (display only).
- **Tabular numerals everywhere there's a number in a table column.**
  `font-variant-numeric: tabular-nums` is on every price, margin, stock,
  EAN, count, ID. Non-negotiable.

### Spacing & layout

- **4px base unit.** Tailwind canonical scale: 1, 1.5, 2, 3, 4, 6, 8, 12.
- **Nav rail is 60px wide on desktop, fixed left.** Bottom tab bar on
  mobile (<768px). The page main applies `md:pl-15` to clear the rail.
- **Page gutter:** `px-4` (16px) mobile, `md:px-6` (24px) desktop,
  `md:px-8` for the header strip.
- **Page max-width:** 1560px (`max-w-[1560px]`). It's a wide tabular UI
  and that's intentional.
- **Layout pattern:** sidebar + main, `grid lg:grid-cols-[260px_1fr]`,
  gap-4. Sidebar always cards-on-background, main always cards-on-background.
- **Inside a card:** `p-6` for headers and content, sometimes `py-3 px-4`
  on dense card variants. Card → header → content uses `border-b
  border-border/40 pb-3` to delineate without shouting.

### Borders, radius, shadows

- **Radius:** 8px (`--radius`) is the default for Card, Input, Button,
  Select trigger. 6px for nested chrome (`--radius-md`). 4px for table
  chips (`--radius-sm`). Pills are pill-shape (`rounded-full`). Nothing is
  square. Nothing is rounder than 8px (except pills).
- **Borders:** 1px hairlines, `hsl(var(--border))` (#DDE0E7). On muted
  contexts use `border-border/40` — half-strength.
- **Shadows:** very subtle. `--shadow-card` = `0 1px 3px 0 rgb(0 0 0 /
  0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)`. Popovers get a slightly
  stronger `--shadow-pop`. Nothing else casts shadow.
- **No inset shadows. No glow. No colored shadows.**

### Backgrounds & imagery

- **No background images. No gradients. No textures.** The product is a
  data tool — solid color surfaces, period. The only "imagery" is product
  photos pulled from Icecat / supplier feeds, which appear as 40×40 or
  80×80 thumbnails with `object-cover` and a `placeholder.svg` fallback.
- **No hero illustrations.** The login screen is a centered card on the
  background color. That's it.
- **Logo on dark.** When the logo appears on a dark surface (it does in
  the nav rail with `class="invert"`), the white variant is used.

### Animation

- **Functional, fast, restrained.** Tailwind defaults (~150ms ease-out).
- **Loading:** spinner via `Loader2` from lucide-react, `animate-spin`.
- **Skeleton / overlay loading:** absolute-positioned `bg-card/60
  backdrop-blur-[2px]` with a small pill chip "Searching…" centered up
  top. `animate-in fade-in` keyframes from `tailwindcss-animate`.
- **Accordion:** Radix accordion plugin (`accordion-down`, `accordion-up`
  at 200ms `ease-out`).
- **No bounces, no springs, no parallax, no scroll-jacking.** Framer
  Motion is installed but used minimally — anything more than a fade or a
  height transition is out of bounds.

### Hover / press states

- **Buttons (`Button variant="default"`):** primary stays primary on
  hover with `hover:bg-primary/90` — gets ~10% darker. No translate, no
  shadow change.
- **Buttons `variant="outline"`:** `bg-card` → `hover:bg-accent/40
  hover:text-accent-foreground`. Subtle blue tint wash.
- **Buttons `variant="ghost"`:** transparent → `hover:bg-accent/40`.
- **Buttons `variant="destructive"`:** `bg-destructive` → `hover:bg-destructive/90`.
- **Nav icons:** `hover:bg-accent hover:text-accent-foreground`
  (cobalt-tint background). Admin nav uses amber tints instead.
- **Table rows:** `hover:bg-accent/30` — a very subtle blue wash. No
  border change.
- **Press / active:** rare; mostly we let the click "land" via state
  change. Toggle group items get `data-[state=on]:bg-primary
  data-[state=on]:text-primary-foreground` — saturated blue.

### Transparency & blur

- Used for **overlay loading states only.** `bg-card/60` + `backdrop-blur-[2px]`.
- Tooltips, popovers, dropdowns: solid `bg-popover` (white). Never
  translucent.
- **No glassmorphism.** It's not that kind of product.

### Focus

- **Always visible.** `focus:ring-2 focus:ring-ring focus:ring-offset-2
  focus:ring-offset-background`. Ring color matches primary by default;
  pill components use status-color rings.

### Density

- This is an **information-dense** tool. Defaults are tight: `py-2 pr-3`
  on table cells, `h-8` on Selects and toggle groups, `h-7` on small
  buttons, `h-6` on chips. Don't loosen this in pursuit of "modern
  whitespace" — long-time users will hate you.

---

## 5 · Iconography

- **Source:** [`lucide-react`](https://lucide.dev/) — every icon in the
  app is a lucide icon. Stroke-based, 1.5px stroke, 24×24 viewBox.
- **Sizes:** mostly `h-4 w-4` (16px) for inline and nav, `h-3.5 w-3.5`
  (14px) for buttons inside cells, `h-3 w-3` (12px) for chip glyphs.
- **Color:** inherits from text (`currentColor`). Icons in muted contexts
  use `text-muted-foreground`; active states use the surrounding color
  (primary, destructive, etc).
- **Common lucide icons in the codebase:** `Search`, `Tags`, `Truck`,
  `User`, `Users`, `UserPlus`, `Activity`, `LogOut`, `Plus`, `X`,
  `RotateCw`, `Loader2`, `ChevronDown`, `ChevronUp`, `Loader2`.

**Production code:** `import { Search, Loader2, X } from "lucide-react"`.

**In static HTML / slides / mocks:** load lucide from CDN — the same
glyphs, no React:

```html
<!-- Modern icon font, ~1.1 MB total but tree-shakes well -->
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
<i data-lucide="search"></i>
<script>lucide.createIcons();</script>
```

For a single-icon need without the runtime, copy the SVG directly from
<https://lucide.dev/icons/>.

### Logo (the EANrunner mark)

The mark is **three offset, slightly-tilted bars** stacked vertically,
suggesting motion — like speed lines on a moving object, fitting the
"runner" name. Always either:

- **Dark mark on light backgrounds** (`assets/eanrunner-logo-light.png`,
  `assets/logo-icon.svg`).
- **White mark on dark backgrounds** (`assets/eanrunner-logo-white.png`).
  In the SPA nav rail, the dark mark is rendered with `class="invert"`
  over a white sidebar — both approaches are fine.

The wordmark is set in a bold italic sans (looks custom; close to Inter
Italic Bold). Do **not** typeset the wordmark in a different font for
mocks — use the supplied PNG/SVG.

### Emoji & unicode-as-icons

- **No emoji in the UI.** None.
- **Unicode glyphs that *are* used:** `✓` (check mark — feed-status
  "on" pill), `—` (em-dash for null/missing), `←` `→` (pagination),
  `·` (interpunct for inline meta — *"kl. 03:32 · 4.2s"*).

---

## 6 · Index — what's in this folder

```
README.md                      ← you are here
SKILL.md                       ← cross-compatible skill manifest (Claude Code)
colors_and_type.css            ← canonical tokens; @import this anywhere

assets/                        ← logos & favicon (copied from EANrunner repo)
  eanrunner-logo.png           ← full wordmark on dark
  eanrunner-logo-white.png     ← full wordmark, white, on dark
  eanrunner-logo-light.png     ← full wordmark, dark, on light
  eanrunner-logo-blue.png      ← cobalt-tinted variant (generated)
  logo-icon.png                ← icon mark only (dark)
  logo-icon.svg                ← icon mark only, SVG, transparent
  favicon.png                  ← 32×32 favicon

fonts/                         ← Google Fonts loaded via CDN; no local files
                                  Substitutions are flagged below.

preview/                       ← cards that populate the Design System tab
                                  (tokens, swatches, type, component states)

ui_kits/
  portal/                      ← the EANrunner customer SPA
    README.md
    index.html                 ← interactive click-thru of the portal
    *.jsx                      ← Nav, ProductRow, FeedStatusCell, MarginPill,
                                  StockChip, LoginCard, Toolbar, etc.
```

There are no `slides/` — the user did not supply any decks. There is no
mobile UI kit — the SPA is desktop-first (only the nav rail collapses to
a bottom tab bar). There is no marketing site — none exists.

### Font substitutions (flag for review)

- **Inter** — used by the source app, available on Google Fonts. ✅ no
  substitution needed.
- **JetBrains Mono** — the source repo doesn't specify a mono face; we
  picked JetBrains Mono. **Flag this** if you have a preference.

If you have the original Inter `.woff2` files or a brand mono, drop them
into `fonts/` and update the `@import` in `colors_and_type.css` to a
local `@font-face`.

---

## 7 · How to use this system

- **Building a mock / slide / throwaway prototype?** Pull
  `colors_and_type.css` in, paste from `ui_kits/portal/`, use real assets
  from `assets/`. Make the mock look like the actual product.
- **Building production code in the real EANrunner repo?** This is a
  reference — the canonical tokens live in `client/src/index.css` in
  the source repo. Don't fork token values; bring this folder's *patterns*
  back into the real Tailwind setup.
- **Adding a new component?** Check `ui_kits/portal/` first to see if it
  exists. Match the existing density, radius, shadow, status-color
  vocabulary. Don't introduce a new accent or a new shadow style without
  a reason.

If you have screenshots of screens that *aren't* covered here (PricePilot
detail, ProductDetail, AdminOnboarding), share them — we can add them to
the UI kit. The current kit covers Search, Login, and Pipeline.
