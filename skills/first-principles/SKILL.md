---
name: first-principles
description: >
   Rebuild a decision from verified constraints instead of reasoning by analogy.
   Use whenever the user asks to analyze from first principles ("第一性原理", "从根本分析", "从零开始思考", "拆解一下", "思考本质", "think from scratch"), questions whether a design is actually right ("这个设计合理吗", "这真的必要吗", "为什么要这样做", "why are we doing it this way", "is this the right approach"), pushes back on a convention ("挑战假设", "challenge assumptions", "行业都这么做", "best practice 说"), asks for a better option ("有没有更好的方案", "is there a better solution", "值不值得"), or faces a technology/architecture/product direction choice, design review, cost challenge, or "should we build or buy" question — even when they never use the phrase "first principles". Also use when an answer is drifting toward "Company X does it this way".
   Do not use for routine implementation, bug fixing, API/doc lookup, or work the user has already decided on and simply wants executed. Analysis only: this skill never writes, edits, or executes anything.
version: 0.6.0
---

# First Principles Thinking

Break a decision into constraints you can check, then rebuild the answer only from those. The value is not the write-up — it is the moment a load-bearing assumption turns out to be false. The failure mode to avoid is **analysis theater**: a tidy document of confident "ground truths" nobody verified, ending in the recommendation the user already had.

Default to **Tier 1**, keep it short, and stop at the recommendation.

## Iron rules

1. **Analysis only.** No code, edits, builds, deploys, commits, tickets, purchases, or settings changes. Reading files, code, and config is allowed — that is how a claim earns `[verified]`. The skill ends at the recommendation; implementing it is a separate request handled outside this skill.
2. **Label every claim.** `[given]` = supplied by the user or a colleague, not checked (this is where "industry standard" lives — a self-report is not a verification) · `[verified]` = you measured it, read it in the code/config, or quoted a primary source — say which, and who measured · `[derived]` = reasoned from labelled facts, show the step · `[assumed]` = plausible, unchecked · `[blocked]` = needs information you don't have. Unlabeled claims are where this method quietly becomes rationalization.
3. **No invented numbers.** "Roughly an order of magnitude" is honest; an unsourced "$2.1M" is fabrication. A claim that costs more than ~30 minutes to verify is `[assumed]` — name the check, price it, move on. A comparative claim ("cheaper", "faster") is never `[derived]` without the arithmetic shown. "Measure first" ships a closed-form threshold with the variable left unfilled, not a point estimate.
4. **The default wins by default.** Existing solutions hold unless the gap is real — 10× wrong, not 1.2×. "The default holds; nothing here justifies changing it" is a successful outcome.
5. **Flag, never dismiss.** Compliance, security, and contractual constraints get named and given an owner, not reasoned away.
6. **No contrarianism.** If two candidates trace to the same ground truths, the difference is preference: pick on cost and team familiarity and stop deriving. This produces a decision you can defend and revise, not a proof.

## Procedure

### Step 0 — Size the decision

| Tier | Fits | Output |
|------|------|--------|
| **0** | Reversible, cheap, single owner | 1–3 sentences, no template |
| **1** (default) | Costly or awkward to reverse, one team | ≤10 lines, short form below |
| **2** | Irreversible, expensive, cross-team, or the user asked for the full reasoning | Long form in `references/output-templates.md` |

Say which tier you chose in one line, then move. Escalate to Tier 2 when a load-bearing assumption can't be verified or the default solution traces back to an assumption that looks false. Drop to Tier 0 when the analysis would cost more than being wrong.

Tier 1 needs three questions: what outcome is at stake, which single assumption is load-bearing, and what breaks if half of this goes away.

### Step 1 — State the problem as an outcome

- **Outcome, not solution.** "Uploads must not lose data", not "we need a queue".
- **Cause, not symptom.** Slow page — is it the query, the network, or the rendering?
- **Measurable success.** Which number moves, by how much, checked how?
- If the request is already a solution ("should we adopt Kafka?"), restate the underlying need before judging it. This alone often reframes the question.
- **Disambiguate it.** "Put a cache in front", "just split it out", "use a queue" each name two designs with costs an order of magnitude apart. Name the readings in one line and say which you are analysing.

### Step 2 — Audit the assumptions, and name the load-bearing one

List what the proposal takes as given and try to break each. Exactly one is usually load-bearing: if it is false, the whole plan collapses — that is where the effort goes. Watch for "we've always done it this way", "industry standard", "everyone uses X", and "too simple to work".

Categories, trap patterns, and how to tell which constraints are even challengeable: `references/assumption-audit.md`.

### Step 3 — Build the ground truth ledger

One entry per constraint the recommendation will rest on, each labelled per rule 2. A source beats a recollection; a range beats a fake precision. What each label requires, and the 30-minute rule: `references/assumption-audit.md` § *What each label requires*.

### Step 4 — Reason upward from the ledger

- **Minimal solution.** Simplest thing that satisfies every `[verified]` and `[derived]` constraint.
- **Deletion test (hard check).** Remove a component — is the core problem still solved? Then it was never justified. Repeat until removal breaks something real, and run it out loud on your own proposal at least once.
- **Every addition names its constraint.** "It's good practice" is not a constraint.
- If a component traces to nothing in the ledger, either the component goes or the ledger is incomplete.

### Step 5 — Try to falsify it, then decide

- **Weak link.** Which step rests on an `[assumed]` or `[given]` entry — something nobody actually checked? That is the real risk, not the complexity.
- **Sensitivity.** "If write volume is actually 10× higher, this flips from Postgres to X." An analysis that cannot be flipped is a rationalization.
- **Compare against the default and the alternatives the user didn't name.** Unchanged vs. changed, plus the live options between them (modular monolith, a faster pipeline, one extracted service) — say it plainly either way.
- **Ask before prescribing measurement.** What do they already have — a trace, p95 at expected volume, an incident, a load test? Ask before telling them to go measure.
- **Confidence.** High when the load-bearing facts are `[verified]` by you or a named measurement, medium when one is `[derived]` or a solid `[given]`, low when it hinges on an `[assumed]` entry. Name which.

## Output

Tier 1 (the default) uses this shape — write in the language the user used:

```markdown
**Core problem:** [outcome, one sentence]
**Load-bearing assumption:** [the one that matters] — [given / verified / assumed + how to check]
**Recommendation:** [what to do]
**If this is wrong:** [the fact that would flip it]
**Confidence:** high / medium / low — because [which label carries it]
**Need from you:** [data they already have that would settle it — omit only if nothing is missing]
```

Tier 2 uses the long form and the pre-handoff checklist in `references/output-templates.md`. Do not use the long form for a Tier 1 question.

## Load on demand

Read only what the case needs; the procedure above runs without any of these.

| File | Read when |
|------|-----------|
| `references/assumption-audit.md` | an assumption is load-bearing and you're unsure it's real; a "convention", "industry standard", or regulation is standing in the way |
| `references/failure-modes.md` | the analysis is running long, the domain is cheap to test empirically, or the disagreement looks political — also before any build-vs-buy call |
| `references/output-templates.md` | Tier 2, or before handing the analysis off |
| `references/worked-examples.md` | you need a concrete shape: a worked Tier 1, a worked Tier 2, or the "materials vs. finished product" price breakdown |

`evals/evals.json` holds test prompts for checking whether a change to this skill improves its output.
