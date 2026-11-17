# Next.js Design Guide (App Router)

Design guidance for full-stack web apps on **Next.js 15/16 App Router + TypeScript**. Read this during planning: it decides the **rendering topology** (what runs on the server vs the client), route and data boundaries, write paths, and the cache/invalidation model.

> This is a **design** guide (read before writing code). For reviewing existing Next.js / React code, use the `code-review` skill's [React Guide](../../code-review/reference/react.md).
> Code inside client components follows the [React Design Guide](react.md); this document only governs "where the boundary is and how data flows".

## Contents

- [Questions to answer before designing](#questions-to-answer-before-designing)
- [First principle: server by default](#first-principle-server-by-default)
- [The serialization boundary](#the-serialization-boundary)
- [Route and layout design](#route-and-layout-design)
- [Data fetching design](#data-fetching-design)
- [Write paths: Server Actions and Route Handlers](#write-paths-server-actions-and-route-handlers)
- [Caching and freshness](#caching-and-freshness)
- [Streaming and Suspense](#streaming-and-suspense)
- [Authentication and authorization](#authentication-and-authorization)
- [Metadata, images, and fonts](#metadata-images-and-fonts)
- [Runtime and environment variables](#runtime-and-environment-variables)
- [Directory structure and module boundaries](#directory-structure-and-module-boundaries)
- [Test design](#test-design)
- [Anti-pattern quick reference](#anti-pattern-quick-reference)
- [Design review checklist](#design-review-checklist)

---

## Questions to answer before designing

Almost all of Next.js's complexity comes from **these answers constraining each other**. Fill in both tables below before writing code.

| Question | What it drives |
| --- | --- |
| Is each route static, dynamic, or mixed? | Whether it reads `cookies`/`headers`/`searchParams`, whether it needs `use cache` |
| How fresh must the data be? | Cache tier, `revalidate` / `cacheLife`, whether it must be real-time |
| How heavy is the interaction? | Client-component share, which client islands exist |
| Where do writes come from? | Server Action vs Route Handler |
| How is the session read and where is authorization checked? | Session read in RSC, authorization at every data access point |
| What is the deployment runtime? | Whether node-only dependencies are allowed, `runtime` segment config |
| Does first render need SEO / straight HTML? | Whether content may be fetched on the client (usually not) |

**Design output:** one row per route stating the render mode, data source, cache policy, and invalidation trigger.

| Route | Render mode | Data source | Cache | Invalidation |
| --- | --- | --- | --- | --- |
| `/invoices` | Static shell + dynamic list | DB (wrapped in `cache()`) | List cached 60s by tag | `createInvoice` → `revalidateTag('invoices')` |
| `/invoices/[id]` | Dynamic | DB + session | Not cached (user data) | — |
| `/settings` | Dynamic | Session + DB | Not cached | `revalidatePath('/settings')` after action |

Without this table, every page re-guesses its cache semantics later.

---

## First principle: server by default

In the App Router only modules marked `'use client'` run on the client. **Write server components by default and push `'use client'` down to the leaves.**

```tsx
// ❌ The whole page becomes a client component: extra JS, no straight HTML, no DB access
'use client';
export default function Page() {
  const [rows, setRows] = useState([]);
  useEffect(() => { fetch('/api/invoices').then(r => r.json()).then(setRows); }, []);
  return <><CreateButton /><Table rows={rows} /></>;
}

// ✅ Page fetches on the server; only the interactive button is a client island
export default async function Page() {
  const rows = await listInvoices();      // call the DB / internal function directly
  return <><CreateButton /><InvoiceTable rows={rows} /></>;
}
```

### Use a client component only when you need

- `useState` / `useReducer` / `useEffect` / event handlers
- Browser APIs (`window`, `localStorage`, `IntersectionObserver`, `canvas`)
- Custom hooks that depend on client context (theme switching, charting, drag-and-drop)

### Three common shapes

```tsx
// 1. Server page + client island, data passed down as props
export default async function Page() {
  const user = await getCurrentUser();
  return <UserMenu user={user} />;          // UserMenu is 'use client'
}

// 2. Server-side provider wrapper: the provider is client, children stay server-rendered
//    app/providers.tsx -> 'use client' + <ThemeProvider>{children}</ThemeProvider>
//    app/layout.tsx    -> <Providers>{children}</Providers>

// 3. Interaction needs the same data and it changes: let the client component
//    fetch via the query layer, seeded with server-provided initialData
```

- Client components **cannot be async**; data either arrives as server props or is fetched by the client query layer.
- Server components **cannot use hooks** — don't try `useState` and hope.
- `'use client'` is module-scoped and contagious: everything it imports ships to the client bundle. Never let a client component import server utilities.

---

## The serialization boundary

Props crossing the boundary must be **serializable** (with the exception of Server Action functions themselves).

```tsx
// ❌ Passing Date instances, Maps, class instances, DB clients, or non-action functions
<Chart data={rows} client={db} formatter={formatMoney} />

// ✅ Project and format on the server; pass plain data
<Chart points={rows.map(r => ({ label: r.month, value: r.total }))} />
```

Rules:

- Project ORM entities into narrow DTOs one step before the boundary: pass only the fields the UI needs. Shoving whole entities into props also ships sensitive fields to the client.
- Dates, money, and enums are formatted or normalized on the server (ISO strings, minor units, string literals). Don't rely on implicit serialization conversions.
- Functions may only cross as Server Actions (`'use server'`) — and never as a channel for secrets.
- DB connections, `fs`, and secret reads exist only in server modules, protected by `import 'server-only'` so a mistaken import fails at build time.

---

## Route and layout design

### Layouts hold persistent UI and shared data

`layout.tsx` does not re-render on navigation: good for nav, sidebars, current user, i18n providers. **Never put per-route business state in a layout**, and don't over-fetch there — layout data blocks every route beneath it.

```
app/
  layout.tsx                 Root: html/body, Providers, global nav
  (marketing)/               Route group: shared marketing layout, not in the URL
    layout.tsx
    page.tsx
  (app)/
    layout.tsx               Post-login layout: sidebar + session check
    invoices/
      page.tsx               List (reads searchParams for paging/filtering)
      loading.tsx
      error.tsx
      [id]/
        page.tsx             Detail
        not-found.tsx
```

- "Same path, different layout" → route group `(group)`; "stable URL, isolated subtree" → nested layout.
- `params` / `searchParams` / `cookies()` / `headers()` are **async** in Next 15+: `await params`, `await searchParams`, typed as `Promise<...>`.
- `params` expresses resource identity (affects cache keys, feeds `notFound()`); `searchParams` expresses view options (page, filter, sort). Don't bury filters in path segments.
- Every route that can be slow or fail gets `loading.tsx` + `error.tsx`; `error.tsx` must be a client component and offer a `reset()` retry.
- Parallel routes `@modal` and intercepting routes `(.)` only when you genuinely need URL-shareable modals or layered detail views — they add a lot of cognitive load.

### Dynamic APIs in client components

Client components unwrap promise props with `use()`; don't re-parse `window.location` by hand.

---

## Data fetching design

### Fetch where the data is needed, dedupe with `cache()`

```tsx
import { cache } from 'react';
export const getInvoice = cache(async (id: string) => {
  return db.invoice.findUnique({ where: { id } });
});
```

- Multiple `getInvoice(sameId)` calls in one render hit the DB once. `fetch` request dedupe only covers `fetch`; DB access needs `cache()`.
- Fetching functions live in domain modules (`features/invoices/queries.ts`) and are called by both pages and layouts. Don't hand-write SQL everywhere.
- For every read ask: **does this include user-private data?** Private reads must not enter a shared cache.

### Avoid request waterfalls

```tsx
// ❌ Serial: the second query waits on the first for no reason
const user = await getUser(id);
const invoices = await listInvoices(id);

// ✅ Independent reads run in parallel
const [user, invoices] = await Promise.all([getUser(id), listInvoices(id)]);

// ✅ Dependent but streamable: put the slow part in its own component + Suspense
return (
  <>
    <UserHeader id={id} />
    <Suspense fallback={<InvoiceSkeleton />}>
      <InvoicePanel id={id} />
    </Suspense>
  </>
);
```

### Don't fetch during first render on the client

First-paint data must come from the server (straight HTML). The client query layer handles only: refetch after interaction, polling, infinite scroll, and user-specific local data.

- Data needed on first paint that can't be server-rendered → fetch it on the server and pass it as `initialData`.
- List pagination: prefer URL-driven (`?page=2` rendered by the server); client-side infinite scroll is the fallback and owns the SEO and accessibility consequences.

---

## Write paths: Server Actions and Route Handlers

### Selection rule

| Scenario | Choice |
| --- | --- |
| Own form / button triggers the change | **Server Action** |
| External systems, webhooks, mobile API | **Route Handler** |
| Needs a non-HTML response (download, image, stream, CSV) | Route Handler |
| Stable contract for third parties / public API | Route Handler (versioned path) |

### Design constraints for Server Actions

```ts
'use server';

export async function createInvoice(_prev: State, formData: FormData): Promise<State> {
  const session = await requireSession();                          // 1. authenticate
  const parsed = schema.safeParse(Object.fromEntries(formData));   // 2. validate untrusted input
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  await requirePermission(session, 'invoice:create', parsed.data.orgId); // 3. authorize
  const invoice = await db.invoice.create({ data: parsed.data });        // 4. mutate
  revalidateTag('invoices');                                             // 5. invalidate precisely
  return { ok: true, id: invoice.id };                                   // 6. discriminable result
}
```

- **An action is a public endpoint**: anyone who can POST can call it. Authenticate, validate, and authorize — all three. A hidden button is not a control.
- Arguments must be serializable; every `FormData` value is a `string`, so run a schema (zod et al.) before touching business code.
- Return a discriminated union (`{ ok: true } | { ok: false, fieldErrors }`) for business failures; reserve `throw` for genuine exceptions (caught by `error.tsx` or the nearest boundary).
- Don't swallow errors before `redirect()`; validate → mutate → redirect.
- Client feedback via `useActionState` (pending/errors) and `useOptimistic` (with a defined rollback).
- Name the invalidation scope when the action completes, or the user submits successfully and still sees stale data.

### Route Handler conventions

```ts
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Also required: authenticate → validate (request.json() is untrusted) → authorize → handle, with explicit status codes
}
```

- GET Route Handlers are **not cached by default** in Next 15+; declare a policy explicitly if you need one.
- Handle HTTP semantics only: status codes, `Content-Type`, a consistent error body. Business logic lives in domain modules; the handler is an adapter.
- Don't clone internal page logic into `/api/*` endpoints; if a write can be an action, don't also expose a route for it.

---

## Caching and freshness

Caching is where Next most often "looks right but serves stale data". The rule: **choose explicitly, and write down the invalidation point.**

### Defaults to remember today (15/16)

- `fetch` is **not cached by default** (since 15); opt in with `cache: 'force-cache'` or by placing the read in a `use cache` function.
- Reading `cookies()` / `headers()` / `searchParams` opts the route into dynamic rendering (with `cacheComponents`, the dynamic part must be wrapped in `Suspense` instead).
- Page-level `revalidate`, `dynamic`, and `fetchCache` segment configs are superseded by `use cache` + `cacheLife` once `cacheComponents` (16) is enabled. Don't mix both mental models in one project.

### Three tiers — pick one per route and record it

| Tier | Fits | How |
| --- | --- | --- |
| Static / prerendered | Marketing, docs, no user data | Default static; avoid dynamic APIs |
| Time-based revalidation (ISR) | Lists, aggregates, semi-static content | Segment `revalidate`, or `use cache` + `cacheLife` |
| Always dynamic | Session-scoped, permission-scoped, live stock | Read `cookies()`/`headers()` and ensure no parent cache swallows it |

### Invalidation must be precise

- After a write: `revalidatePath('/invoices')` (by path) or `revalidateTag('invoices')` (by data tag).
- Give each data family a tag name during design, and record who is responsible for invalidating it.
- Private data (session, permissions, billing) **never enters a shared cache**; reading `cookies()` inside a cached function is a red flag.

---

## Streaming and Suspense

- Push slow data down into dedicated child components and wrap them in `Suspense` with a skeleton **shaped like the final layout**, so content doesn't cause layout shift as it streams in.
- A page can have multiple `Suspense` levels: shell → main content → secondary panels.
- Streaming does not replace error handling: set `error.tsx` and Suspense boundaries by blast radius.
- Don't `await` a slow query at the top of the page before returning — that forfeits streaming; move the `await` into a child.
- Status-code limit: once the response has started streaming you can't change the status code, so call `notFound()` / `forbidden()` before the expensive work.

---

## Authentication and authorization

- **Authentication:** read the session only on the server (RSC, action, route handler). The session cookie must be `httpOnly`; tokens never live in client-readable storage.
- **Authorization:** check at **every data access point** — reads included, writes especially. "The page didn't render the button" is the classic privilege-escalation bug.
- **Proxy (formerly Middleware, renamed `proxy.ts` in Next 16) performs optimistic checks only**: redirect anonymous users, rewrite paths, add security headers. It is unsuitable for slow lookups and cannot be the sole authorization layer, since direct action calls bypass it.
- Check the session once in `app/(app)/layout.tsx` via `await requireSession()`, but still filter data by user in every query (`where: { userId: session.userId }`).
- Pass only narrow DTOs (name, avatar) to client components; never serialize the whole session object.

---

## Metadata, images, and fonts

- `generateMetadata` and the page share the **same** `cache()`-wrapped fetch, avoiding a second query on detail pages.
- Dynamic OG images via `opengraph-image.tsx`; don't build HTML at request time.
- `next/image`: set explicit `width`/`height` or `fill` plus a sized parent; `priority` on the hero image, lazy for the rest; add remote hosts to `images.remotePatterns`.
- `next/font` self-hosts fonts with `display: 'swap'`; no external font links in CSS.
- Anything that needs SEO must be server-rendered. Client-fetched content is blank for crawlers and for first paint.

---

## Runtime and environment variables

- **Runtimes:** `nodejs` (default, full Node API) vs `edge` (no `fs`, no native modules, fast start). Use edge only when you truly need it (auth at the edge, geo, low latency). One node-only dependency disqualifies the whole route from edge.
- **Environment variables:** `NEXT_PUBLIC_*` is **inlined into the client bundle** and is never a secret. Secrets live in unprefixed variables read only by server modules.
- Add `import 'server-only'` to server-only modules; keep DB, secrets, and internal HTTP clients under `lib/server/` or a domain `server/` folder.
- Build time vs run time: in client modules `process.env.X` is statically inlined — don't expect to change client-visible variables at runtime.

---

## Directory structure and module boundaries

```
src/
  app/                     Routes, layouts, loading/error, route handlers
  features/<domain>/
    queries.ts             Server reads (wrapped in cache())        → server only
    actions.ts             'use server' mutations                   → server only
    schema.ts              zod validation (shared client/server)
    components/            Domain components (mark 'use client' for islands)
  components/ui/           Presentational components, no business knowledge
  lib/server/              db, auth, mailer (import 'server-only')
  lib/                     Pure utilities and formatting (no side effects, shared)
```

- Dependency direction: `app → features → components/lib`. Features don't import each other's internals; hoist shared code to `lib` or export an explicit public surface.
- **Server code must not enter the client graph**: no `db`, `fs`, or secret reads anywhere in the import chain of a `'use client'` module. `server-only` turns the mistake into a build error.
- Shared validation schemas live in their own file and are imported by both sides; never re-implement the rules on the client.
- `app/` only routes and composes; business logic lives in `features/` so it stays unit-testable and portable.

---

## Test design

| Level | Scope | Tooling |
| --- | --- | --- |
| Pure functions / schemas | Validation rules, money math, permission checks | Vitest (no Next runtime) |
| Client components | Interaction, form error display, optimistic updates | RTL + MSW |
| Server Actions | Input validation, authorization denials, invalidation calls | Call the function directly, mock `db` / `revalidateTag` |
| Route-level E2E | Login wall, data change after submit, invalidation observable | Playwright against a real `next build` / `next start` |

- Authentication and authorization need **denial cases**: anonymous and cross-tenant calls must assert 401/403 instead of data.
- Prove cache correctness in E2E (submit, reload, see the new value); unit tests can't demonstrate invalidation.
- Don't simulate the whole Next runtime in unit tests. Extract testable pure logic; leave Next-specific glue to E2E.

---

## Anti-pattern quick reference

| Anti-pattern | Consequence | Instead |
| --- | --- | --- |
| Top-level `'use client'` around the page | Bundle bloat, no straight HTML, no DB access | Keep the page server-side; push interaction into islands |
| `useEffect` fetching on first paint | Empty HTML, poor SEO, double request | Server fetch + `initialData` |
| Action without auth or validation | Privilege escalation and dirty data (it's a public endpoint) | Authenticate → schema validate → authorize → mutate |
| Passing ORM entities to the client | Leaked fields, serialization errors | Project into a narrow DTO |
| No invalidation after a write | Users see stale data and assume it didn't save | `revalidateTag` / `revalidatePath` |
| Private data in a shared cache | Cross-user data leakage | Keep session-reading routes dynamic |
| Proxy/middleware as the only auth check | Direct action calls bypass it | Authorize at every data access point |
| Serial `await` of slow queries at the top | First paint blocked by the slowest call | `Promise.all` + push work under `Suspense` |
| Secrets in `NEXT_PUBLIC_` | Secrets in the client bundle | Server-only variables + `server-only` |
| Mixing segment configs with `use cache` | Unpredictable cache semantics | Pick one cache mental model per project |

---

## Design review checklist

Confirm each item during planning; only start implementing when all hold:

- [ ] Every route's render mode, data source, cache policy, and invalidation point are in the design table
- [ ] `'use client'` appears only on leaves that need interaction or browser APIs
- [ ] All cross-boundary props are serializable and projected into narrow DTOs (no ORM entities, no secrets)
- [ ] Every read has been judged for user-private data; private reads avoid shared caches
- [ ] Shared reads use `cache()`; independent queries run in parallel; slow queries sit under `Suspense`
- [ ] Each write path is chosen (action vs route handler) and lists: authentication, schema validation, authorization, invalidation
- [ ] Each write states its exact `revalidateTag` / `revalidatePath` scope
- [ ] Authorization happens at data access points (reads included); proxy only does optimistic checks
- [ ] Every route segment has `loading.tsx` / `error.tsx` / empty-state design
- [ ] Runtime (node/edge) suits the dependencies; no secrets exposed through `NEXT_PUBLIC_`
- [ ] Metadata and first-paint content come from the server; images and fonts use `next/image` and `next/font`
- [ ] Each acceptance criterion maps to a test level; auth has denial cases; cache correctness is covered by E2E
- [ ] No second data layer, cache model, or styling approach introduced against existing convention
