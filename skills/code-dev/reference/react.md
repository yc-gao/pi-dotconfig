# React Design Guide

Design guidance for **React 19 + TypeScript** component libraries, SPAs, and client-rendered apps. Read this during planning: it decides component boundaries, state ownership, effect placement, and test shape.

> This is a **design** guide (read before writing code). For reviewing existing React code, use the `code-review` skill's [React Guide](../../code-review/reference/react.md).
> On Next.js App Router, start with the [Next.js Design Guide](nextjs.md) — RSC changes the default answers for component boundaries.

## Contents

- [Questions to answer before designing](#questions-to-answer-before-designing)
- [Component boundaries](#component-boundaries)
- [Component API design](#component-api-design)
- [State design](#state-design)
- [Server state](#server-state)
- [Where effects belong](#where-effects-belong)
- [Form design](#form-design)
- [Module structure and dependency direction](#module-structure-and-dependency-direction)
- [Performance design](#performance-design)
- [Loading, error, and empty states](#loading-error-and-empty-states)
- [Accessibility and styling](#accessibility-and-styling)
- [Test design](#test-design)
- [Anti-pattern quick reference](#anti-pattern-quick-reference)
- [Design review checklist](#design-review-checklist)

---

## Questions to answer before designing

These seven questions should have answers before the first component is written. If they don't, the design isn't ready — don't start coding.

| Question | What it drives |
| --- | --- |
| Who owns each piece of state? | Where state lives, whether it lifts, whether it needs Context or an external store |
| What is server state? | Whether to add TanStack Query / SWR, and its cache and invalidation policy |
| What UI state belongs in the URL? | Filter, pagination, tab, and search term: shareable and back-button behavior |
| Is first render on the server? | Whether components may touch `window`, where data is fetched, hydration boundaries |
| How many independent interaction units are there? | Split granularity and props shape |
| What does the user see on failure and while loading? | Error boundary / Suspense / empty-state design |
| How will this be proven correct? | Test levels: pure function, component interaction, E2E |

**Output:** one sentence stating who the single owner of the state is, where data comes from, and how it refreshes on mutation. If you can't write that sentence, go back to requirement clarification.

---

## Component boundaries

Split on **reasons to change** and **state ownership**, not on line count.

### When to split

- One block of UI has two or more independent pieces of state → split into units that each own their state.
- Something will be reused, tested in isolation, or lazily loaded → split.
- One component does fetching, transforming, and rendering → split into at least two layers.
- Props contain `mode`, `isInsideX`, or `variant` signals that mean "I live inside another component" → the hierarchy is wrong; use composition.

### When not to split

- Splitting only to reduce line count, at the cost of 5 levels of prop drilling → don't; use composition instead (pass the subtree as `children`).
- The extracted component has exactly one call site and no independent state → keep it inline.

### Layer convention

```
Page / route component   composes layout, decides which data to read
  └─ Container           owns data access and orchestration (useQuery, useReducer)
      └─ Presentational  pure props → JSX, no effects, no fetching
          └─ Primitives  design-system layer, no business knowledge
```

```tsx
// ❌ One component fetches, orchestrates two state machines, and renders three UIs
function UserPage({ id }: { id: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<'profile' | 'billing'>('profile');
  useEffect(() => { fetch(`/api/users/${id}`).then(r => r.json()).then(setUser); }, [id]);
  if (!user) return <Spinner />;
  return <div>{/* 200 lines of JSX, one branch per tab */}</div>;
}

// ✅ Fetch in the container, tab state owned by the child, presentation is pure
function UserPage({ id }: { id: string }) {
  const { data: user, isPending, error } = useUser(id);
  if (isPending) return <UserSkeleton />;
  if (error) throw error; // handled by an error boundary
  return <UserView user={user} />;
}
```

**Test:** if removing `useEffect`/`useQuery` leaves only thin JSX, the component never needed them. If it holds both fetched data and five interaction states, it must be split.

---

## Component API design

### Props express intent, not implementation

```tsx
// ❌ Boolean + low-level value combinatorics; callers must know the implementation
<Button primary rounded small showIcon />

// ✅ One semantic enum, mapped to styles internally
<Button variant="primary" size="sm" icon={<PlusIcon />} />
```

Rules:

- Same-family variants take one union type (`variant: 'primary' | 'ghost'`), not mutually exclusive booleans.
- Don't expose the entire DOM prop surface as your API (`{...rest}` onto the root node) unless the component is genuinely a wrapper; if you forward `className`/`style`, define the merge policy.
- Defaults go in the function parameter list, not legacy `defaultProps`, and are typed optional.
- Controlled vs uncontrolled: pick one, or decide on `value !== undefined` — and document the precedence. Mixing both with no rule is a future bug.
- React 19: `ref` is a normal prop (`props.ref`); new code does not need `forwardRef`.

### Prefer composition over render props

```tsx
// ✅ children / named slots — the caller owns the structure
<Card>
  <Card.Header actions={<DeleteButton />}>Billing</Card.Header>
  <Card.Body>{children}</Card.Body>
</Card>
```

Compound components (`Tabs` / `Tabs.List` / `Tabs.Panel`) share state through an internal Context so callers don't need to know where it lives. Keep that Context private to the compound component; don't let it become a global store.

### Data flows down, events flow up

- Components don't decide where to fetch; data is fetched at the boundary (container, route, query hook) and passed down.
- Children report what happened (`onSaved(user)`), they don't command the parent ("go refresh", "go navigate").
- Exported components take no implicit dependencies (store singletons, router instances, axios instances) in props — pass them explicitly or inject via Context.

---

## State design

### One rule: don't store what you can compute

```tsx
// ❌ Derived state stored, kept in sync by an effect
const [items, setItems] = useState(props.items);
const [activeCount, setActiveCount] = useState(0);
useEffect(() => setActiveCount(items.filter(i => i.active).length), [items]);

// ✅ Compute during render; memoize only if measured expensive
const activeCount = items.filter(i => i.active).length;
```

Every value in `useState` needs an **independent source of change**. If it has none, it's derived.

### Where state lives

| Shape of state | Where it goes |
| --- | --- |
| Used by one component | Inside that component |
| Shared by siblings | Lifted to the nearest common parent |
| Cross-tree, low frequency (theme, current user, i18n) | Context |
| Cross-tree, high frequency (drag, live input, list selection) | External store (Zustand/Jotai) or split Context, to avoid re-rendering the whole tree |
| Should be shareable / back-navigable (filter, page, tab) | URL (router search params) |
| Server data (lists, entities) | Server-state layer, see below |
| Transient state bound to an entity instance (draft, expanded) | Component state + `key={entityId}` reset |

```tsx
// ✅ Reset by key instead of a pile of effects syncing props back into state
{items.map(item => <Editor key={item.id} initial={item} />)}
```

### State shape

- Use **discriminated unions** instead of parallel booleans: `{ status: 'idle' | 'loading' | 'error' | 'success' }`, not `isLoading && !error && data !== null`.
- Fields that always change together belong in one object updated by a single `setState`.
- Updates must be immutable; spread or use Immer for arrays and nested objects — never mutate in place.
- Reach for `useReducer` when there are ≥ 4 state fields with clear event→state transitions, or when the transition rules deserve their own tests.
- A state machine whose illegal states are unrepresentable beats "add one more flag to cover it".

---

## Server state

Server data is not app state. Don't hand-sync it with `useState + useEffect`.

**Design decision:** whether to add TanStack Query / SWR.

- Need caching, dedupe, background refetch, pagination, optimistic updates, offline retry → add it, and write down the `queryKey` hierarchy and invalidation points in the plan.
- Read once on mount, discarded on navigation → `use()` + Suspense or a framework loader is enough; don't add a library.

Conventions:

- `queryKey` is part of the data's identity: `['user', id]`, `['invoices', { page, status }]`. Sketch the key hierarchy during design — all invalidation depends on it.
- Invalidate precisely after mutations: `invalidateQueries({ queryKey: ['invoices'] })`, not a blanket `invalidateQueries()`.
- Optimistic updates must define a **rollback path**: restore the snapshot and tell the user on failure.
- No side effects inside `select`; no `refetch` during render.

---

## Where effects belong

`useEffect` has exactly one legitimate reason: **syncing with something outside React** (subscriptions, timers, DOM measurement, third-party instances, logging).

```tsx
// ❌ Effect as a data fetcher: no dedupe, no cache, races, no retry
useEffect(() => { fetchUser(id).then(setUser); }, [id]);

// ✅ Fetching belongs to the query layer
const { data: user } = useQuery({ queryKey: ['user', id], queryFn: () => fetchUser(id) });

// ✅ Legitimate effect: subscribe to an external system, always clean up
useEffect(() => {
  const sub = store.subscribe(handleChange);
  return () => sub.unsubscribe();
}, []);
```

- Every effect must answer "which external system does this sync with". "Keep it consistent with props" is not an answer.
- Async work inside an effect needs cancellation or an ignore guard (`AbortController` or a `cancelled` flag); otherwise stale responses overwrite newer state.
- Don't use effects for logic triggered by a user event — that's an event handler.
- Don't notify the parent on mount from an effect; use a callback or lift state.
- Anything with a cleanup obligation (subscriptions, timers, `AbortController`, observers) must have its cleanup point named in the design.

---

## Form design

Default to **uncontrolled** (the browser holds values; read them all at submit) and go per-field controlled only where live coupling or validation needs it.

```tsx
// ✅ React 19: submit via action, fields uncontrolled
function ProfileForm({ save }: { save: (fd: FormData) => Promise<Result> }) {
  const [state, formAction, isPending] = useActionState(save, { ok: true });
  return (
    <form action={formAction}>
      <input name="displayName" defaultValue={initial.displayName} />
      <button disabled={isPending}>Save</button>
      {!state.ok && <FieldErrors errors={state.fieldErrors} />}
    </form>
  );
}
```

- Validate at the **submit boundary** (server or inside the action); the UI only displays errors. Never rely on client validation alone.
- Disable double submits; on success produce a visible outcome (refreshed data, cleared draft, navigation) — never a silent no-op.
- Complex forms (multi-step, dynamic fields, cross-field rules) → pick one solution (React Hook Form et al.) and state in the plan where validation lives and how errors map.
- When initial values come from data, reset via `key`, not by writing each field back through an effect.

---

## Module structure and dependency direction

```
src/
  app/ or routes/   Pages/entry points: composition and data access
  features/<domain>/ Components + hooks + types for one domain (cohesive, deletable)
  components/       Shared presentational components (no business knowledge)
  lib/              Pure utilities, API client, formatting
  stores/           Cross-domain client state
  types/            Shared types
```

- Dependency direction is one-way: `pages → features → components/lib`. `components` must not import `features`.
- One directory per domain, with its components, hooks, types, and tests together; don't flatten everything into a global `components/` and `hooks/`.
- API calls live in one layer (`lib/api` or a domain `api.ts`) returning parsed types; components never assemble URLs.
- Domain logic (money math, status transitions, permission checks) goes into pure, testable functions — not inside JSX.

---

## Performance design

**Optimize nothing by default.** Act on a measured symptom. During design, only settle the structural decisions:

| Structural decision | When it's warranted |
| --- | --- |
| Route-level code splitting (`lazy` / dynamic import) | A heavy page exists (charts, editor, maps) |
| List virtualization | Consistently rendering hundreds of rows |
| `useTransition` for non-urgent updates | Re-renders block typing (large list filtering, search) |
| Hand-written `memo` / `useMemo` / `useCallback` | Only for a measured expensive subtree, or when the value feeds another memo |
| State colocation / splitting | High-frequency state re-renders the whole page (usually split components, don't memo everything) |

- With React Compiler enabled, don't hand-write `useMemo`/`useCallback`/`memo`.
- List `key` must be stable and unique (business id). Index keys are acceptable only for static, never-reordered, stateless lists.
- When a large object prop causes re-renders, split the component boundary rather than memoizing the whole object.
- Writing down "how heavy is this page, how big is its dependency" during planning beats guessing later why it's slow.

---

## Loading, error, and empty states

Every data-driven screen gets four states designed up front:

| State | Design output |
| --- | --- |
| Loading | Skeleton or spinner; whether it uses a Suspense boundary; whether stale data stays visible |
| Empty | Empty-state copy plus the next action ("Create your first X"), never a blank page |
| Error | Error-boundary granularity; retry available; message readable by a human |
| Partial failure | One failing card doesn't kill the page (local boundary) |

```tsx
// ✅ Boundary granularity = blast radius
<ErrorBoundary fallback={<PageError onRetry={reload} />}>
  <Suspense fallback={<InvoicesSkeleton />}>
    <InvoiceList />
  </Suspense>
</ErrorBoundary>
```

- Error boundaries only catch render-time errors; async failures must become error state in the query layer, then throw or render a fallback.
- Don't swallow render errors into blank output, and never `catch {}` — users then see "no data" instead of "it broke".
- The design states what retry actually does (refetch? clear cache?).

---

## Accessibility and styling

- Interactive elements use semantic tags (`button`, `a`, `label`); don't attach `onClick` to a `div`.
- Bake `aria-*`, keyboard interaction (Enter/Space/Tab/Escape), and focus management into the component API and implementation from the start — not as a follow-up.
- Modals and drawers: focus trap, and return focus to the trigger on close.
- Pick the styling approach the project already uses (CSS Modules / Tailwind / CSS-in-JS); don't mix in a second one within a change.
- Colors, spacing, and type scale come from design tokens, not literals. Decide the token layer for dark mode during design instead of sprinkling `dark:` afterwards.

---

## Test design

| Level | Scope | Tooling and convention |
| --- | --- | --- |
| Pure functions | Domain math, formatting, reducer transitions | Vitest/Jest, no DOM |
| Component interaction | User action → visible result | RTL, prefer `getByRole`/`getByLabelText` |
| Integration | Page + query layer + mocked network | RTL + MSW |
| E2E | Critical user paths (login, checkout) | Playwright, few high-value paths only |

- Assert what the user can perceive (text, roles, accessible state); never assert internal state, component names, or implementation details.
- Mock the network with MSW at the request layer; don't mock `fetch` internals or mock your own hooks.
- Express async assertions with `findBy*` / `waitFor` ("eventually shows X"), never `setTimeout` sleeps.
- Control time, randomness, and `Date.now` via injection or fake timers to avoid flaky runs.
- Every acceptance criterion maps to at least one test. "No stated way to verify" means the acceptance criterion is missing.

---

## Anti-pattern quick reference

| Anti-pattern | Consequence | Instead |
| --- | --- | --- |
| Effect syncing derived state | Two sources of truth, flicker, update loops | Compute during render / `useMemo` |
| `useState + useEffect` fetching | No cache, races, duplicate requests | Query layer or framework loader |
| Index as `key` | State misaligned after reorder | Business id |
| One `App` component holding everything | Untestable, whole-tree re-renders | Colocate state + composition |
| High-frequency state in Context | Every consumer re-renders | Split Context / external store |
| Mixing controlled and uncontrolled | Silent desync | Pick one, or branch on `value !== undefined` |
| Side effects during render (storage, requests) | Double execution in Strict Mode, hard to trace | Move into events or effects |
| `catch {}` silent fallback | Failures render as empty data | Explicit error state |
| Components importing store/router singletons | Untestable, implicit coupling | Explicit props or injection |

---

## Design review checklist

Confirm each item during planning; only start implementing when all hold:

- [ ] Every piece of state has a single owner, and no storable derived state exists
- [ ] State that belongs in the URL (filter/page/tab) is in the URL
- [ ] Server data goes through the query layer or a framework loader; no `useEffect` fetching
- [ ] Layers are clean: fetch, orchestration, and presentation don't overlap
- [ ] Props use semantic enums with no mutually exclusive boolean groups; `children` used for composition
- [ ] Effects are enumerated, each with the external system it syncs and a cleanup plan
- [ ] Four states (loading / empty / error / partial failure) are designed with error-boundary granularity
- [ ] Structural performance decisions (code splitting, virtualization) are stated — or explicitly ruled out
- [ ] Every acceptance criterion maps to a test level
- [ ] No second styling approach, state library, or data layer introduced against existing convention
