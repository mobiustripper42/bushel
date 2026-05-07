# bushel — Brand

Bay Branch Farm's ordering system. One voice, two surfaces.

> **One-line voice:** "We grow food."
>
> Warm. B2B-professional. Unpretentious. The farmer texted you a link.

---

## Voice

Plain words. Short sentences. No hospitality theater.

**Yes**
- "This week's availability — order by Tuesday 9pm."
- "Thanks. I'll text you Wednesday morning with pickup details."
- "Heads up — we ran short on dino kale. I'll text Annabel to sort it out."

**No**
- "You're on the list! 🎉"
- "Your fresh, hand-picked produce journey begins now…"
- "Oops! Something went wrong."

Use lowercase for week labels and eyebrows ("this week", "ready to pick up"). Capitalize properly in body.

---

## Color

| Token | Hex | Use |
|---|---|---|
| `--leaf-900` | `#1F3A08` | strong text on leaf bg |
| `--leaf-700` | `#2C5310` | hover / borders / focus rings |
| `--leaf-600` | `#3B6D11` | **primary** — buttons, links, accent rule |
| `--leaf-500` | `#4F8A1B` | badge fill (Ready) |
| `--leaf-100` | `#EDF5E5` | tag bg, subtle highlight |
| `--leaf-50`  | `#F4F8EE` | row stripe, panel wash |
| `--cream`    | `#FBFAF5` | **page background** |
| `--paper`    | `#FFFFFF` | cards / inputs |
| `--ink-900`  | `#1A1A1A` | primary text, admin sidebar bg |
| `--ink-700`  | `#3A3A38` | secondary text |
| `--ink-500`  | `#6E6E6A` | muted / placeholder |
| `--ink-300`  | `#C8C7C1` | hairlines |
| `--ink-200`  | `#E4E2DA` | row dividers, card borders |
| `--amber-600`| `#E6A817` | **caution** — needs_reconciliation, warnings |
| `--amber-50` | `#FFF7E0` | callout bg for caution |
| `--rose-600` | `#B23B2E` | destructive only |

Never use pure white or pure black. Never saturate above leaf-500. No gradients. No drop shadows beyond `0 1px 0 rgba(0,0,0,0.04)` on cards.

---

## Type

- **Customer hero** — Playfair Display 600. Reserved for the customer order page "What's available" h1 only. Nowhere else in working UI.
- **Body / UI** — Source Sans 3, 300/400/600. 1.5–1.6 leading.
- **Eyebrows / labels** — Source Sans 3 600, `uppercase`, `letter-spacing: 0.08em`, `0.72rem`, leaf-600.
- **Mono** — `ui-monospace, "JetBrains Mono", monospace`. Tokens, IDs, prices in tables.

### Scale

| Role | Size (mobile) | Size (desktop) |
|---|---|---|
| display (customer hero h1) | 2rem | 2.5rem |
| h1 (status/admin) | 1.85rem | 2rem |
| h2 | 1.4rem | 1.6rem |
| body | 1rem | 0.95rem |
| small | 0.85rem | 0.82rem |
| eyebrow | 0.72rem | 0.72rem |

Customer text: never below 14px on mobile. Admin tables: 13px floor.

---

## Spacing & shape

- Scale: **4 8 12 16 24 32 48 64** px.
- Border radius: **6px** standard (`rounded-lg`), **10px** for cards (`--r-md`), **999px** for pill chips.
- Hairlines: 1px `--ink-300` for dividers; 2px `--leaf-600` for section accent rule.
- Focus: 2px `--leaf-700` outline + 2px offset. No custom `outline-none` overrides.

---

## Imagery

Real photos: dirt, hands, harvest crates, cover crop, tunnel plastic in winter sun. Overcast-Cleveland tone, not glossy. Placeholder: leaf-100 fill block with mono caption "produce shot". No decorative vegetable SVGs.

---

## Two surfaces

**Customer (mobile-first).** SMS link → phone browser. 44px+ touch targets, single column, thumb-reachable totals. Plain chrome. Works at 375px in bright sun.

**Admin (desktop-only).** Annabel runs the week from her kitchen laptop once. Dense, table-driven, keyboard-friendly. Single ink-900 sidebar, content fills viewport. No mobile fallback in V1 (DEC-019).

---

## Status vocabulary

| State | Color treatment |
|---|---|
| New | leaf-100 fill, leaf-700 text |
| Ready | leaf-500 fill, white text |
| Picked Up | ink-200 fill, ink-700 text |
| Delivered | ink-200 fill, ink-700 text |
| **Needs reconciliation** | amber-50 fill, amber-600 left rule |

Reconciliation rows always rise to the top regardless of sort or filter.

---

## Design reference

Canonical prototype source lives in `design/`. Do not commit the bundled standalone HTMLs (1.5MB+) — the source JSX and CSS are enough.

| File | Screen |
|---|---|
| `design/tokens.css` | All CSS custom properties |
| `design/status-pages.{css,jsx}` | Customer: closed, confirmed, invalid |
| `design/order-page.{css,jsx}` | Customer: order form |
| `design/admin-shell.{css,jsx}` | Admin layout |
| `design/admin-inventory.{css,jsx}` | Admin: inventory editor |
| `design/admin-orders.{css,jsx}` | Admin: orders list |
| `design/admin-customers.{css,jsx}` | Admin: customer management |
| `design/admin-send.{css,jsx}` | Admin: SMS broadcast |
| `design/admin-settings.{css,jsx}` | Admin: scheduling + pickup windows |

Claude Designer URL: `https://api.anthropic.com/v1/design/h/AkV4MQqicgtDIDIg1U0o3w`
