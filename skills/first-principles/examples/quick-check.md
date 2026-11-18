# Example: Short-Form Analysis (Tier 1)

Most questions deserve this length. Note what is *not* here: no five-section template, no assumption table, no reasoning chain diagram.

---

**User:** "Should we put Redis in front of the product list API? Everyone says caching is the obvious win."

**Tier:** 1 — reversible in a day, one team, cost of being wrong is low.

**Core problem:** Product list endpoint p95 is 900ms and the page feels slow to shoppers.

**Load-bearing assumption:** that the 900ms is spent on repeated identical reads. Checked the access log: 78% of requests are the same 40 queries, and the DB is at 12% CPU — `[verified]`. So the latency is not capacity, it's per-request work (N+1 joins).

**Recommendation:** Fix the N+1 and add a 60s in-process cache on the two heaviest queries. Skip Redis: it adds a network hop, an invalidation path, and a new failure mode, to solve a problem that is currently four joins deep. Re-check after the fix; add Redis only if a single query still dominates and the DB shows real load.

**If this is wrong:** If the 900ms turns out to be dominated by one expensive aggregate that can't be optimized (e.g. a full-catalog facet count), the cache becomes the load-bearing fix and Redis is justified — verify by profiling the endpoint before shipping.

**Confidence:** medium — the N+1 is `[verified]` from the query log, but I have not measured the post-fix latency, and the 60s staleness is `[assumed]` acceptable for this page.

---

## Why this counts as first principles

Three moves, none of them elaborate:

1. **Restated the request as an outcome.** The user asked for a cache; the problem was a slow endpoint. Caching is one solution to a class of slow endpoints, and it happened not to be the right one.
2. **Turned "everyone says" into a measurable claim.** "Caching is the obvious win" implies repeated identical reads dominate. 78% and 12% CPU is a cheap check that could have refuted it — and would have, if the bottleneck were capacity instead.
3. **Priced the added complexity.** Redis isn't free: hop, invalidation, failure mode. Those are economic constraints that belong in the ledger, not in a footnote.

## Where this would have escalated to Tier 2

- If the fix required a schema migration that is hard to reverse.
- If the 78% figure came from a sample too small to trust (`[assumed]` on a load-bearing fact).
- If two teams depended on the endpoint's latency contract.
