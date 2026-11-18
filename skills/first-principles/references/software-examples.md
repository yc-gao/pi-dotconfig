# First Principles in Software Engineering

Real-world examples of applying first principles thinking to common software decisions.

Contents: 1. Database selection · 2. Monolith vs microservices · 3. Authentication · 4. Caching · 5. API design · 6. Case study: when it went wrong · 7. Anti-pattern: over-engineering · 8. Template

## Example 1: Database Selection

### Conventional Thinking
"We need a database. PostgreSQL is popular and reliable. Let's use PostgreSQL."

### First Principles Analysis

**Problem Essence:**
- Store and retrieve data reliably
- Support the access patterns our application needs

**Assumptions Challenged:**

| Assumption | Challenge | Verdict |
|------------|-----------|---------|
| Need a traditional RDBMS | What are our actual access patterns? | Depends on data model |
| Need ACID transactions | Which operations truly need atomicity? | Maybe only subset |
| Need SQL | Do we query relationally? | Check actual queries |

**Ground Truths:**
1. Data must persist across restarts
2. Read latency must be < 50ms for 99th percentile
3. Write volume is ~100 writes/second
4. Data is mostly read, rarely updated
5. Access pattern is key-value lookup 90% of the time

**Reasoning Chain:**
- Ground truth #5 suggests relational model may be overkill
- Ground truths #2 and #4 favor read-optimized storage
- Ground truth #3 shows write volume is modest

**Conclusion:** A key-value store (Redis with persistence, or DynamoDB) might be simpler and more performant than PostgreSQL for this specific use case.

---

## Example 2: Microservices vs Monolith

### Conventional Thinking
"Microservices are the modern best practice. We should split our monolith."

### First Principles Analysis

**Problem Essence:**
- Deploy and scale application components independently
- Enable team autonomy and parallel development

**Assumptions Challenged:**

| Assumption | Challenge | Verdict |
|------------|-----------|---------|
| Microservices = faster development | Do we have multiple teams? | 2 developers - Keep |
| Need independent scaling | Do components have different load? | Uniform load - Discard |
| Network calls are acceptable | What's our latency budget? | 10ms budget - Concern |

**Ground Truths:**
1. Team size is 2 developers
2. All components scale together
3. Strong consistency needed between components
4. Deployment frequency is weekly

**Reasoning Chain:**
- Ground truth #1 means coordination overhead > team autonomy benefit
- Ground truth #2 eliminates scaling benefit
- Ground truth #3 makes distributed transactions complex
- Ground truth #4 means deployment isn't a bottleneck

**Conclusion:** Monolith with modular architecture provides all benefits without distributed system complexity. Revisit when team grows to 8+ or components need independent scaling.

---

## Example 3: Authentication System

### Conventional Thinking
"We need auth. Let's implement OAuth2 with JWT tokens like everyone else."

### First Principles Analysis

**Problem Essence:**
- Verify user identity
- Control access to resources

**Assumptions Challenged:**

| Assumption | Challenge | Verdict |
|------------|-----------|---------|
| Need OAuth2 | Are we federating identity? | No federation - Overkill |
| JWT is necessary | Do we need stateless auth? | Single server - Not needed |
| Need refresh tokens | What's our session duration? | 8-hour workday - Simple session |

**Ground Truths:**
1. Single application, no third-party auth
2. Users are employees (known set)
3. Single deployment (not distributed)
4. Session duration matches workday

**Reasoning Chain:**
- Ground truth #1 eliminates OAuth2 complexity
- Ground truth #3 means server-side sessions are viable
- Ground truth #4 means simple session timeout works

**Conclusion:** Server-side sessions with secure cookies. 100 lines of code vs 1000+ for full OAuth2/JWT implementation.

---

## Example 4: Caching Strategy

### Conventional Thinking
"Add Redis for caching. Cache everything with 5-minute TTL."

### First Principles Analysis

**Problem Essence:**
- Reduce latency for frequent operations
- Reduce load on primary data store

**Assumptions Challenged:**

| Assumption | Challenge | Verdict |
|------------|-----------|---------|
| Need distributed cache | Single server? | Yes - Local cache viable |
| Cache all queries | Which queries are slow/frequent? | Only 3 queries matter |
| 5-minute TTL | What's data freshness requirement? | Varies by data type |

**Ground Truths:**
1. 95% of latency from 3 specific queries
2. Single application server
3. User profile data changes rarely (daily)
4. Inventory data changes frequently (per minute)
5. Available memory: 2GB

**Reasoning Chain:**
- Ground truth #2 means in-process cache sufficient
- Ground truth #1 means cache only those 3 queries
- Ground truths #3 and #4 mean different TTLs needed

**Conclusion:**
- In-memory cache (no Redis needed)
- Cache user profiles for 1 hour
- Cache inventory for 30 seconds
- Cache only the 3 hot queries

---

## Example 5: API Design

### Conventional Thinking
"REST is the standard. Everything should be a resource with CRUD operations."

### First Principles Analysis

**Problem Essence:**
- Enable clients to perform operations
- Communicate data between systems

**Assumptions Challenged:**

| Assumption | Challenge | Verdict |
|------------|-----------|---------|
| Must be RESTful | Are operations truly CRUD? | Some are workflows |
| Need JSON | Who are the consumers? | Internal Go services |
| HTTP is required | Any browser clients? | No - Server to server |

**Ground Truths:**
1. All clients are internal Go services
2. Strong typing prevents bugs
3. Operations include workflows (not just CRUD)
4. Latency budget is 5ms

**Reasoning Chain:**
- Ground truth #1 and #2 favor gRPC with protobuf
- Ground truth #3 means RPC fits better than REST
- Ground truth #4 favors binary protocol (gRPC)

**Conclusion:** gRPC with protobuf. Strong typing, efficient serialization, natural RPC semantics for workflows.

---

## Case Study: When First Principles Reasoning Went Wrong

Success stories are easy to find; this one is here so the method doesn't look infallible.

### The Situation
A team of six ran a job-processing system on a managed queue. Monthly bill had grown to a level that felt unjustified, so someone did the arithmetic: the queue moved ~50k jobs/min, each job was a row lookup plus an HTTP call, and the underlying managed Redis cost a fraction of the invoice. "From first principles, we're paying for a wrapper." The conclusion: build a small in-house queue on the same Redis, keep the operational knowledge in-house.

### The Ledger They Built

| Entry | Label at the time | What it actually was |
|-------|-------------------|----------------------|
| 50k jobs/min peak | `verified` (metrics) | Correct |
| Managed cost = 12× raw Redis | `verified` (invoices) | Correct |
| Each job is lookup + HTTP call | `verified` (code) | Correct |
| "Queue logic is ~800 lines" | `assumed` | Wrong — the 800 lines were the *enqueue* path. Retry, backoff, dead-letter, dedupe, and visibility timeouts lived in the vendor's product. |
| "We can operate it ourselves" | never written down | The actual load-bearing assumption |

### Where the Reasoning Broke

**Step 3 (ledger completeness).** The team only entered constraints that felt *technical*. On-call rotation, the absence of a queue dashboard, upgrade paths, and the fact that two of six engineers had ever debugged a stuck consumer were treated as vendor overhead rather than as constraints. They were the most expensive entries in the ledger.

**Step 5 (no falsification).** Nobody wrote down what would prove the decision wrong. The honest version would have been: *"If we spend more than 3 engineer-weeks on queue internals in the first quarter, or if paging volume for job failures rises, revert."* Without that sentence, the rewrite had no exit condition — sunk cost did the arguing.

### What Happened

Seven months, two incidents (one duplicated a batch of billing events, one stalled a consumer group for 40 minutes at 2am), and a dashboard built from scratch. A managed queue with better semantics was restored at a higher price than the original.

### The Transferable Rule

Before replacing something because its cost seems unjustified, ask: **what is this vendor actually doing that I am not counting?** The gap between raw infrastructure cost and invoice is usually labor, correctness edge cases, and observability — and those are real constraints, not markup. First principles is at its most seductive exactly where the omitted constraint is human.

Same caution from the other direction in *Anti-Pattern: Over-Engineering from First Principles* below.

---

## Anti-Pattern: Over-Engineering from First Principles

First principles thinking can also lead to over-engineering if misapplied:

### The Trap
"From first principles, we could build a more efficient database/framework/language..."

### The Check
**Additional Ground Truth:** Development time is finite and expensive.

**Questions:**
- Does building custom save more time than using existing?
- Is the performance gain worth the maintenance burden?
- Will the team be able to maintain custom solutions?

**Rule of Thumb:** If existing solution is within 2x of optimal and team knows it, use it. First principles reveals when existing solutions are 10x wrong.

---

## Template for Your Analysis

```markdown
## First Principles: [Decision]

### Conventional Wisdom
[What everyone assumes]

### Problem Essence
[Core need in one sentence]

### Assumptions Table
| Assumption | Challenge | Verdict |
|------------|-----------|---------|

### Ground Truth Ledger
- `[verified]` [Fact 1] — [source]
- `[derived]` [Fact 2] — [from what]
- `[assumed]` [Fact 3] — verify by [method], cost [time]

### Reasoning Chain
[Truth] → [Inference] → [Conclusion]
*(Deletion test: removing [component] leaves the core problem solved / unsolved)*

### Decision
[What to do, and how it differs from the default]

### Sensitivity
If [assumption] is false, this flips to [alternative]. Confidence: [high/medium/low].
```

Labels matter more than the template. An entry you cannot source is an assumption, and an assumption you did not flag is how this analysis becomes a justification for a decision already made.
