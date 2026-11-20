# Worked Examples

Two shapes of output, plus the one technique that is not in the procedure: pricing a finished product component by component.

## Tier 1 — the short form (most questions)

Note what is *not* here: no five-section template, no assumption table, no reasoning-chain diagram.

**User:** "Should we put Redis in front of the product list API? Everyone says caching is the obvious win."

**Tier:** 1 — reversible in a day, one team, cheap to be wrong.

**Core problem:** Product list endpoint p95 is 900ms and the page feels slow to shoppers.

**Load-bearing assumption:** that the 900ms is spent on repeated identical reads. Access log: 78% of requests are the same 40 queries, DB at 12% CPU — `[verified]`. So the latency is not capacity, it is per-request work (N+1 joins).

**Recommendation:** Fix the N+1 and add a 60s in-process cache on the two heaviest queries. Skip Redis: a network hop, an invalidation path, and a new failure mode, to solve a problem currently four joins deep. Re-check after the fix; add Redis only if one query still dominates and the DB shows real load.

**If this is wrong:** If the 900ms is dominated by one aggregate that cannot be optimized (a full-catalog facet count), the cache becomes the load-bearing fix and Redis is justified — verify by profiling before shipping.

**Confidence:** medium — the N+1 is `[verified]`, but post-fix latency is unmeasured and the 60s staleness is `[assumed]` acceptable here.

Why this counts: the request was restated as an outcome (slow endpoint, not missing cache); "everyone says" became a measurable claim (78% and 12% could have refuted it); and the added complexity got a price.

Escalate to Tier 2 if the fix needs a hard-to-reverse migration, if the 78% came from too small a sample, or if two teams depend on the latency contract.

## Tier 2 — an architecture review

**Context:** a B2B SaaS with a monolith; the CTO proposes microservices "because that's what Netflix does". Tier 2 — hard to reverse, expensive, shapes hiring for years.

**1. Problem essence.** Core problem: feature delivery is slow and risky. Success: deploy without full regression runs, scale hot components independently, parallelize teams.

**2. Assumptions audited.**

| Assumption | Challenge | Evidence | Verdict |
|------------|-----------|----------|---------|
| Netflix does it, so should we | Netflix has 2000+ engineers; we have 12 | Public talks; our org chart | **Discard** — 2 orders of magnitude off |
| Need independent deployability | How often do deploy conflicts actually block us? | Deploy log, 6 months: 2/month | **Discard** — not a current pain point |
| Need independent scaling | Do components have different load? | Metrics: uniform, no hotspots | **Discard** |
| Team autonomy needs service boundaries | How many teams, how do they coordinate? | 2 teams of 6, shared features | **Keep** — real, but splitting doesn't solve it |
| Network latency is acceptable | Current budget? | 200ms budget, 80ms used | **Keep** |

**3. Ledger.** `[verified]` 12 engineers in 2 teams, both touching most features · `[verified]` uniform traffic · `[verified]` ~10 deploys/week, 2 conflicts/month · `[verified]` 30% of engineering time already on infrastructure · `[derived]` core complexity is domain logic, not infrastructure · `[derived]` ~18 engineers within a year · `[assumed]` microservices push infra to 50%+ (other teams' reports; verify by interviewing two comparable teams that migrated).

**4. Reasoning chain.** 12 engineers → coordination cost of service boundaries exceeds the 2/month conflict pain they relieve → uniform traffic means independent scaling yields nothing → 30% infra time rises once per-service CI/CD, tracing, and a gateway are ours → revisit at ~25 engineers.

*Deletion test:* remove the service boundary, keep the module boundary — the core problem is still addressed. Removing the module boundary breaks it. The split was never justified; the modules were.

**5. Decision.** Modular monolith with enforced internal boundaries (`/modules/billing`, `/modules/auth`, `/modules/core`, `/api`, plus `shared/{database,events}`), each module a candidate service later.

Confidence: medium-high — scale, traffic, and infra time are `[verified]`; the 50% figure is `[assumed]`. Sensitivity: if conflicts were 10+/month or one component carried 10× the traffic, extracting that one service becomes justified — neither holds. Trade-offs: less "modern" optics for recruiting, future refactor if scaling changes. Revisit when team > 25, traffic diverges, conflicts > 10/month, or components need different stacks.

## Pricing a finished product component by component

Use when the user asks why something costs what it costs, or proposes building a replacement. Break the price into raw components, price each at market, then ask what justifies every multiplier above materials.

SpaceX and Tesla are the canonical illustrations — materials are a few percent of a rocket's sticker price, raw battery materials a fraction of a pack. **Read them as shape, not evidence:** the multiples are public estimates assembled from press coverage, contested, and unaudited. The transferable move is the question, not the figures.

Software parallel: open-source components are free, so why is the enterprise equivalent expensive? Computing is cheap, so why is the cloud bill high? The answers — integration, support, correctness edge cases, observability, someone to call at 2am, egress, idle capacity — are exactly the entries that go missing when you price only the raw materials. Which of them are real in *your* case is the analysis; the multiple alone proves nothing. See `references/failure-modes.md` § *The omitted human constraint*.
