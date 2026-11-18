# Output Templates

Load for Step 0 tier selection detail, Tier 2 output, and the pre-handoff checklist. Write in the language the user used.

## Tier 0

No template. One to three sentences, usually ending in the question that decides it:

> Is this solving the real problem, or a symptom of it?

## Tier 1 (default, ≤10 lines)

```markdown
**Core problem:** [outcome, one sentence]
**Load-bearing assumption:** [the one that matters] — [verified / assumed + how to check]
**Recommendation:** [what to do]
**If this is wrong:** [the fact that would flip it]
```

Worked example: `examples/quick-check.md`.

## Tier 2

```markdown
## First Principles Analysis: [Topic]

### 1. Problem Essence
**Core problem:** [one sentence, outcome-shaped]
**Success criteria:** [measurable]

### 2. Assumptions Audited
| Assumption | Challenge | Evidence | Verdict |
|------------|-----------|----------|---------|
| [assumption] | [why it might not hold] | [source / "none"] | Keep / Discard / Modify |

### 3. Ground Truth Ledger
- `[verified]` [fact] — [source]
- `[derived]` [fact] — [from what]
- `[assumed]` [fact] — verify by [method], cost [time]

### 4. Reasoning Chain
`[verified]` fact → step → step → recommendation
*(Deletion test: removing [component] leaves the core problem solved / unsolved)*

### 5. Decision
**Recommendation:** [what, and how it differs from the default]
**Confidence:** high / medium / low — because [which label is load-bearing]
**Sensitivity:** if [assumption] is false, this flips to [alternative]
**Trade-offs accepted:** [what we're giving up, and why that's acceptable]
**Not verified:** [what we'd need to check before committing real money]
```

Worked example: `examples/architecture-review.md`.

## Checklist before handoff

If a box cannot be ticked, lower the stated confidence — do not quietly skip it.

- [ ] Problem stated as an outcome, not a solution
- [ ] Tier chosen and stated
- [ ] Every load-bearing assumption has a verdict and an evidence note
- [ ] Every ground truth carries a label; `[assumed]` entries carry a verification plan
- [ ] Deletion test run on the proposal itself
- [ ] Recommendation compared explicitly against the default
- [ ] Sensitivity stated: what fact would flip the conclusion
- [ ] Confidence level with its reason
- [ ] Analysis only — nothing was executed, written, or changed on the user's behalf
