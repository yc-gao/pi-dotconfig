# Example: Microservices Architecture Review

A first principles analysis of whether to adopt microservices for a SaaS application.

---

## Context

A B2B SaaS company wants to modernize their monolithic application. The CTO proposes microservices because "that's what Netflix and Amazon do."

**Tier:** 2 — hard to reverse, expensive, and it will shape hiring for years.

---

## First Principles Analysis: Should We Adopt Microservices?

### 1. Problem Essence

**Core problem:** Enable faster development velocity and independent scaling

**Success criteria:**
- Deploy features without full system regression testing
- Scale high-traffic components independently
- Enable parallel development across teams

### 2. Assumptions Audited

| Assumption | Challenge | Evidence | Verdict |
|------------|-----------|----------|---------|
| Netflix uses microservices, so should we | Netflix has 2000+ engineers; we have 12 | Public engineering talks; our org chart | **Discard** — different scale by 2 orders of magnitude |
| Need independent deployability | How often do deploy conflicts actually block us? | Deploy log, last 6 months: 2/month | **Discard** — not a current pain point |
| Services need independent scaling | Which components have different load? | Metrics: all components scale together, no hotspots | **Discard** |
| Team autonomy requires service boundaries | How many teams, and how do they coordinate? | 2 teams of 6, high collaboration, shared features | **Keep** — real, but unsolved by splitting |
| Network latency is acceptable | What's the current latency budget? | 200ms budget, 80ms used, already calling external APIs | **Keep** |

### 3. Ground Truth Ledger

- `[verified]` **Team size is 12 engineers across 2 teams** — both teams touch most features
- `[verified]` **Traffic is uniform** — metrics show no component with independent load
- `[verified]` **Deploys happen ~10×/week and conflicts are 2/month** — deploy log
- `[derived]` **Core complexity is in domain logic** — inferred from where defects and PRs concentrate
- `[verified]` **30% of engineering time already goes to infrastructure** — sprint accounting
- `[derived]` **Team reaches ~18 engineers in a year** — stated 50% growth applied to 12
- `[assumed]` **Microservices would raise infra burden to 50%+** — no local measurement; based on comparable teams' reports. Verify by interviewing two teams of similar size who migrated.

### 4. Reasoning Chain

`[verified]` 12 engineers, 2 teams → coordination overhead of service boundaries exceeds the deploy-conflict pain (2/month) they would relieve → independent scaling yields zero benefit given uniform traffic → `[verified]` 30% infra time would rise, since per-service CI/CD, tracing, and gateway become our work → `[derived]` revisit at ~25 engineers.

**Deletion test:** remove the service boundary and keep the module boundary — the core problem (slow, risky feature delivery) is still addressed. Removing the module boundary does break it. The split was never justified; the modules were.

### 5. Decision

**Recommended approach:** Modular monolith with clear internal boundaries

**Structure:**
```
/app
  /modules
    /billing      # Clear interface, could become service
    /auth         # Clear interface, could become service
    /core         # Shared domain logic
    /api          # HTTP handlers
  /shared
    /database     # Shared DB access
    /events       # Internal event bus
```

**Key insight:** The desire for microservices was based on analogy (Netflix does it) rather than actual pain points. The team's stated problems (deploy conflicts, scaling) do not exist yet.

**Confidence:** medium-high — the scale, traffic, and infra-time figures are `[verified]`; the claim that microservices would push infra time to 50% is `[assumed]` from other teams' reports.

**Sensitivity:** If deploy conflicts were actually 10+/month, or if one component carried 10× the traffic of the rest, the coordination argument weakens and extracting that one service becomes justified. Neither holds today.

**Trade-offs acknowledged:**
- Less "modern" architecture may affect recruiting perception
- Will need to refactor later if scaling patterns change
- Internal discipline required to maintain module boundaries

**Revisit trigger:** When any of these change:
- Team size exceeds 25 engineers
- Component traffic patterns diverge significantly
- Deploy conflicts exceed 10/month
- Different components need different tech stacks

---

## What Microservices Would Have Cost

If we had proceeded with microservices without this analysis:

| Investment | Estimate |
|------------|----------|
| Service mesh setup | 2 engineer-months |
| Distributed tracing | 1 engineer-month |
| Service discovery | 0.5 engineer-months |
| API gateway | 1 engineer-month |
| Per-service CI/CD | 2 engineer-months |
| Ongoing maintenance | +20% engineering time |

**Total upfront:** 6.5 engineer-months
**Ongoing:** 20% tax on all engineering work

**Benefit realized:** Near zero (problems don't exist yet)

---

## Checklist Applied

1. ✅ Problem stated as an outcome (delivery speed and safety), not a solution
2. ✅ Tier 2 chosen and stated
3. ✅ Every load-bearing assumption has a verdict and an evidence note
4. ✅ Ground truths carry labels; the one `[assumed]` entry carries a verification plan
5. ✅ Deletion test run — module boundary survives, service boundary does not
6. ✅ Recommendation compared explicitly against the default (stay monolithic)
7. ✅ Sensitivity stated: what would flip the conclusion
8. ✅ Confidence level with its reason
9. ✅ Revisit triggers defined
