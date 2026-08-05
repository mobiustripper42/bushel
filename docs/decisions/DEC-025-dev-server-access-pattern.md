---
id: DEC-025
title: "Dev server access pattern"
topic: "Stack, platform & environments"
---

## DEC-025: Dev server access pattern

**Decision:** Dev server runs on `mill-dev:3001`, bound to `0.0.0.0`, reached over Tailscale only. No public exposure (Hetzner firewall blocks 3001). VS Code's auto-port-forwarding to `localhost` is allowed but not the canonical path — laptop, phone, and iPad all hit `http://mill-dev:3001`.

**Why:**
- **Mobile-first.** Customer-side must work at 375px (DEC-019); phone testing has to be a primary path, not an afterthought. Phone can't use VS Code's `localhost` tunnel — only Tailscale-direct works for it. Committing to one path means we don't keep two configurations healthy.
- **OAuth simplicity.** Google OAuth redirect URIs hardcode host:port. One canonical URL = one redirect URI to maintain (`http://mill-dev:3001/auth/callback`).
- **Same URL everywhere.** Avoids "works on laptop, broken on phone" bugs caused by origin-mismatched configs (sailbook hit this — silent hydration failures when `allowedDevOrigins` was incomplete).
- **Port pinned to 3001** because sailbook holds 3000. Both projects can run their dev servers simultaneously on the same box.

**Operational implications:**
- `package.json` dev script: `next dev -p 3001 -H 0.0.0.0`.
- `next.config.ts` `allowedDevOrigins` + `serverActions.allowedOrigins` include `mill-dev`, `mill-dev:3001`, and the tailnet IP `100.118.147.49:3001` (IP fallback for when MagicDNS hiccups).
- README, OAuth redirect URIs, and Playwright `baseURL` (for local-server runs) all reference `http://mill-dev:3001`.
- If the box gets renamed again (it happens — `sailbook-dev` → `mill-dev` was V1), this decision's references become a single grep target.

**Trade-off accepted:** if Tailscale or MagicDNS breaks, dev access is gone until it's restored. The tailnet IP fallback in `allowedDevOrigins` mitigates partially (IP works even when MagicDNS doesn't). VS Code's port forwarding remains as an undocumented backup for laptop-only debugging.

---
