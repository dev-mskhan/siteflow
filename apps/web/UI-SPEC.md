# UI-SPEC.md — SiteFlow Frontend Foundation (Phase 1)

**Design Read:** B2B construction operations OS for contractors and project managers (US and Pakistan markets), engineering-precise language where appropriate, plain-language for onboarding flows. Blueprint Dark aesthetic — ink-dark navy, warm construction orange accent, thin 1px borders, no AI-purple slop.

---

## 1. Design Direction

### Theme: Blueprint Dark

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0B0F17` | 60% — page background |
| `--surface` | `#121826` | Cards, panels, dropdowns |
| `--surface-2` | `#1A2233` | Hover states, raised elements |
| `--border` | `#263046` | 1px borders everywhere |
| `--text` | `#E8ECF4` | Primary body text |
| `--text-muted` | `#8A94A8` | Secondary, labels, placeholders |
| `--accent-1` | `#FF6A2B` | Construction orange (gradient start) |
| `--accent-2` | `#FFB547` | Warm gold (gradient end) |
| `--gradient-brand` | `linear-gradient(135deg, #FF6A2B, #FFB547)` | Primary CTA, hero text |
| `--gradient-cool` | `linear-gradient(135deg, #3B82F6, #22D3EE)` | Charts, secondary stats |
| `--success` | `#22C55E` | On track, confirmed |
| `--warning` | `#F59E0B` | At risk, pending |
| `--danger` | `#EF4444` | Delayed, overdue, destructive |

### Dials (design-taste-frontend)
- `DESIGN_VARIANCE: 7` — B2B SaaS, precise but not sterile
- `MOTION_INTENSITY: 5` — UI feedback + entrance animations, no constant loops
- `VISUAL_DENSITY: 4` — data-aware but not cockpit-dense

### Typography
- **UI font:** Inter (system-fallback chain)
- **Numeric/monospace:** JetBrains Mono for cost figures, BOQ quantities, dates in tables
- **Scale:** text-xs (10px) → text-sm (14px) → text-base (16px) → text-xl (20px) → text-3xl (30px) → text-5xl (48px)
- **Large hero headlines:** font-black, gradient-text on key noun

### Shape System
- Cards: 16px border-radius (`rounded-2xl`)
- Inputs, buttons: 12px (`rounded-xl`)
- Badges, tags: 6px (`rounded-md`)
- All borders: 1px solid `var(--border)`
- Shadows: none on dark — use border + backdrop-blur

---

## 2. State Architecture

### Layer Separation (strict)

| Layer | Tool | Scope |
|---|---|---|
| **Server state** | RTK Query (@reduxjs/toolkit) | API data: users, projects, billing, auth session |
| **UI/client state** | Zustand | Active org, sidebar open/closed, modal states, locale (USD/PKR) |
| **Form state** | react-hook-form + @hookform/resolvers/zod | All forms — zero useState for field values |
| **Routing state** | react-router-dom v7 | URL-driven navigation |
| **Error boundaries** | React ErrorBoundary class | Rendering crashes |

### RTK Query Base API

```
lib/store/
  api.ts          ← createApi(), baseUrl /api/v1, credentials: 'include'
  store.ts        ← configureStore(), Redux DevTools in dev only
  index.ts        ← typed hooks re-export (useAppSelector, useAppDispatch)
```

### Feature API Slices

```
features/auth/api/authApi.ts        ← login, register, logout, me, sessions
```

### Zustand Stores

```
lib/store/appStore.ts     ← activeOrganizationId, sidebarOpen, locale (USD|PKR)
```

---

## 3. Component Architecture

### Forms — react-hook-form Rules

- `useForm({ resolver: zodResolver(schema) })` for every form
- No `useState` for field values — use `register` and `Controller` from RHF
- Field errors from `formState.errors`, not local state
- API/server errors in a banner above submit, not as field errors
- Submit via RTK Query mutation; loading from mutation `.isLoading`

---

## 4. Auth Screens

### Login `/login`
- Fields: email, password (react-hook-form + zodResolver)
- Show/hide password toggle on password field
- "Forgot password?" link
- Google OAuth button
- RTK Query: `useLoginMutation()` — on success navigate to from || /projects
- API error banner below the heading (not per-field)

### Register `/register`
- Fields: firstName, lastName (optional), email, password
- Password strength bar (CSS width driven by score)
- Terms checkbox (required via Zod refine)
- RTK Query: `useRegisterMutation()`
- After success → "Verify your email" banner replaces form

### Forgot Password `/forgot-password`
- Field: email
- RTK Query: `useForgotPasswordMutation()`
- Success state replaces form completely — server-intentionally ambiguous message

### Reset Password `/reset-password?token=...`
- Fields: newPassword, confirmPassword (refine match)
- RTK Query: `useResetPasswordMutation()`
- On success → navigate /login

### Verify Email `/verify-email?token=...`
- Auto-fires mutation on mount (token from URL)
- States: loading → success | already-verified | expired

### Trial Signup `/trial`
- Fields: firstName, email, password, locale preference (USD/PKR)
- RTK Query: register + then start trial
- Prominent "14-day free trial, no credit card required"

---

## 5. Animation Spec

- Only animate `transform` and `opacity`
- Durations: 150ms hover/feedback · 300ms state · 600ms entrance
- Entrance: `opacity: 0 + translateY(24px)` → `opacity: 1 + translateY(0)`
- Hard kill on `prefers-reduced-motion: reduce`

---

## 6. Accessibility

- Focus ring: `outline: 2px solid var(--accent-1); outline-offset: 2px`
- ARIA labels on icon-only buttons
- `label[for]` → `input[id]` association (react-hook-form handles this with `register`)
- Dialog: focus trap + ESC + `aria-modal`
- Don't use color alone for errors

---

## 7. Localization (US + Pakistan)

| Concern | US | Pakistan |
|---|---|---|
| Currency | USD ($) | PKR (₨) |
| Area unit | sq ft | Marla / Kanal |
| Date format | MM/DD/YYYY | DD/MM/YYYY |
| Standards | AIA G702, CSI MasterFormat | FIDIC/NEC3, RICS |

Toggle via Zustand `appStore.locale`.

---

## 8. Performance Budget

| Concern | Limit |
|---|---|
| Initial JS bundle | < 250 kB gzipped |
| RTK Query cache keepUnusedDataFor | 60s |
| Form re-renders | Only dirty fields (RHF subscription model) |
| Hero image | WebP/AVIF < 200 kB |

---

## 9. Security

- `credentials: 'include'` on all RTK Query requests (httpOnly cookies)
- No tokens in localStorage or sessionStorage
- RTK Query mutation errors never expose raw server traces to users
- Google OAuth: server-side state+PKCE only, no frontend token handling
