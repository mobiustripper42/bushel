# bushel — UI Design System Context

Used by @ui-reviewer. Contains the authoritative design system for bushel (Bay Branch Farm ordering system).

## Surfaces

Two surfaces. Different rules for each.

**Customer** — mobile-first, 375px primary. The farmer texted you a link. Big tap targets, plain chrome, one column.
**Admin** — desktop-only, 1440px primary. Annabel's working tool. Dense, table-driven, ink-900 sidebar.

Viewports for screenshots: **375px** (customer pages), **1440px** (admin pages).

---

## Brand Tokens

All bushel colors are defined as CSS custom properties in `src/styles/app.css`. Source of truth: `design/tokens.css`.

| Token | Hex | Tailwind semantic |
|---|---|---|
| `--leaf-600` | `#3B6D11` | `bg-primary` / `text-primary` |
| `--leaf-700` | `#2C5310` | hover states, focus rings |
| `--leaf-500` | `#4F8A1B` | badge-ready fill |
| `--leaf-100` | `#EDF5E5` | badge-new bg, subtle highlight |
| `--leaf-50` | `#F4F8EE` | `bg-secondary`, `bg-muted`, panel wash |
| `--cream` | `#FBFAF5` | `bg-background` — page background |
| `--paper` | `#FFFFFF` | `bg-card` — cards and inputs |
| `--ink-900` | `#1A1A1A` | `text-foreground`, admin sidebar bg |
| `--ink-700` | `#3A3A38` | secondary text |
| `--ink-500` | `#6E6E6A` | `text-muted-foreground` |
| `--ink-200` | `#E4E2DA` | `border-border`, row dividers |
| `--amber-600` | `#E6A817` | `--warning` — needs_reconciliation, caution |
| `--amber-50` | `#FFF7E0` | callout-warn background |
| `--rose-600` | `#B23B2E` | `bg-destructive` — destructive only |

**Never:** pure white or black. Never above leaf-500 saturation. No gradients. Card shadows: `0 1px 0 rgba(0,0,0,0.04)` only.

---

## Typography

- **Body / UI:** Source Sans 3 (loaded via `--font-sans`). 16px base, 1.55 leading. Weights: 300, 400, 600.
- **Customer hero h1 only:** Playfair Display (loaded via `--font-display`). Only on the order page "What's available" title. Nowhere else.
- **Eyebrows / labels:** Source Sans 3 600, uppercase, `letter-spacing: 0.08em`, `0.72rem`, leaf-600.
- **Mono:** JetBrains Mono (loaded via `--font-mono`). Tokens, IDs, prices, tabular numbers.

**Scale:**
- h1 status/admin: `1.85rem` (Source Sans)
- h1 customer hero: `2rem` mobile / `2.5rem` desktop (Playfair)
- body: `1rem`
- small: `0.85rem` — minimum on customer pages
- eyebrow: `0.72rem` — absolute minimum

**Flags:**
- Playfair anywhere except customer order page h1 → High
- Font size below 0.82rem on customer → High
- `font-bold` anywhere → Medium (use `font-semibold`)

---

## Spacing

- 4px scale only. No arbitrary values (`p-[13px]`, `gap-[22px]`, etc.).
- Page padding in layout.tsx only — not on individual pages.
- Section spacing: `space-y-6` between major sections.

---

## Border Radius

`rounded-lg` (6px = `--r-sm`) everywhere. Customer CSS uses `--r-md` (10px) for cards — that's the design-defined exception. No other mixing.

**Never:** `rounded-none`, `rounded-full` on non-pill/badge elements, oversized overrides.

---

## Shadows

- Cards: `var(--hairline)` = `0 1px 0 rgba(0,0,0,0.04)` only.
- Modals/overlays: `shadow-lg`.
- Nothing else.

---

## Components (shadcn — admin/auth pages)

- **Button** variants → semantics:
  - `default`: leaf-600 primary action (one per screen)
  - `secondary`: secondary action
  - `outline`: tertiary
  - `ghost`: nav items, icon-only
  - `destructive`: irreversible, rose-600
- **Badge** variants:
  - New state: leaf-100 bg, leaf-700 text (use `secondary` variant or custom class)
  - Ready state: leaf-500 bg, white text
  - Picked Up / Delivered: ink-200 bg, ink-700 text
  - Needs reconciliation: amber-50 bg + amber-600 left rule (custom — not a standard badge variant)
- **Tables:** `w-full text-sm`, `text-muted-foreground` headers, `border-b` rows, no striping. Reconciliation rows: amber-50 bg, pinned top.
- **Sidebar:** must use `bg-sidebar` token (ink-900) — never `bg-gray-*` or hardcoded dark colors.

---

## Customer pages (plain CSS — no shadcn)

Customer routes (`/c/[token]/*`) use `src/styles/app.css` with the design prototype classes. Do not apply Tailwind utilities or shadcn components to customer pages.

| Check | Rule |
|---|---|
| Touch targets | All interactive elements ≥ 44px height |
| Single column | No multi-column layout on mobile |
| Status art | SVG illustrations only (no generated images) |
| Brand strip | Leaf mark + "Bay Branch Farm" in leaf-700, white background |
| Footer | "Bay Branch Farm · 3612 W 114th St, Cleveland" in ink-500 |
| Phone links | `sms:2162025718` (tap-to-text) — not `tel:` |

---

## Admin layout (desktop-only)

- Sidebar: ink-900 bg (`bg-sidebar`), white text, leaf-600 active accent bar left edge.
- Top bar: cream bg, week label right-aligned, sign-out button outlined.
- Content: fills viewport, 24px padding, no max-width constraint.
- Mobile: no mobile fallback required in V1 (DEC-019).

---

## Accessibility (baseline)

- All interactive elements: visible focus rings (leaf-700, 2px, 2px offset). Never override with bare `outline-none`.
- Color is not the sole state indicator — always pair with icon or text label.
- Form fields: visible `<label>`, not placeholder-only.
- Decorative icons and SVGs: `aria-hidden="true"`.
- Customer status art: `aria-hidden="true"` on the SVG wrapper.

---

## What to Check

1. **Color / tokens** — raw hex in shadcn pages → flag. Customer pages: leaf/ink/cream vars only.
2. **Typography** — Playfair only on customer hero h1; no font-bold; nothing below 0.82rem customer / 0.78rem admin.
3. **Spacing** — 4px scale; no arbitrary values; page padding in layout.
4. **Radius** — `rounded-lg` (shadcn pages); `--r-sm`/`--r-md` (customer pages); no mixing.
5. **Shadows** — hairline on cards only; shadow-lg on modals.
6. **Buttons/badges** — variant semantics correct; one primary per screen.
7. **Customer 375px** — single column; 44px+ targets; no horizontal scroll.
8. **Admin sidebar** — `bg-sidebar` token; not hardcoded.
9. **Reconciliation rows** — amber-50 bg + amber-600 rule; pinned to top.
10. **Accessibility** — focus rings intact; labels visible; aria-hidden on decorative SVGs.
