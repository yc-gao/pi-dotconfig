---
name: first-principles
description: >
   Rebuild a decision from verified constraints instead of reasoning by analogy.
   Use whenever the user asks to analyze from first principles ("第一性原理", "从根本分析", "从零开始思考", "拆解一下", "思考本质", "think from scratch"), questions whether a design is actually right ("这个设计合理吗", "这真的必要吗", "为什么要这样做", "why are we doing it this way", "is this the right approach"), pushes back on a convention ("挑战假设", "challenge assumptions", "行业都这么做", "best practice 说"), asks for a better option ("有没有更好的方案", "is there a better solution", "值不值得"), or faces a technology/architecture/product direction choice, design review, cost challenge, or "should we build or buy" question — even when they never use the phrase "first principles". Also use when an answer is drifting toward "Company X does it this way".
   Do not use for routine implementation, bug fixing, API/doc lookup, or work the user has already decided on and simply wants executed. Analysis only: this skill never writes, edits, or executes anything.
version: 0.4.0
---

# First Principles Thinking

A method for taking a decision apart into constraints that can be checked, then rebuilding a solution only from those. Its value is not the report it produces — it is the moment an assumption that everyone was relying on turns out to be false.

The failure mode to avoid is **analysis theater**: a tidy five-section document full of confident "ground truths" that were never verified, ending in the same recommendation the user started with. Every rule below exists to prevent that.

## Scope: analysis only — do not execute

This skill is **thinking only**. It produces analysis, a recommendation, and the ledger behind it. It does **not** authorize action.

**Forbidden while applying this skill:**
- Writing, editing, deleting, or generating code or config files
- Running builds, migrations, deploys, scripts, or any state-changing command
- Creating branches, commits, PRs, tickets, or documents outside the analysis reply
- Making purchases, provisioning infrastructure, or changing settings in any system

**Allowed:** reading files and code, searching, inspecting config, and reporting findings — read-only investigation needed to label a ground truth `[verified]`.

**Handoff rule:** end the analysis with a recommendation. If the user then wants it implemented, that is a *separate* request handled outside this skill — restate it and treat it as a new task. "Do the analysis" is never permission to also do the change.

When in doubt, stop at the recommendation and ask.

## Step 0: Size the decision first

Do not run the full process on every question. Pick the tier, say which tier you chose in one line, and move.

| Tier | Fits | Effort | Output |
|------|------|--------|--------|
| **0** | Reversible, cheap, single owner | One question in the reply | 1–3 sentences |
| **1** | Costly or awkward to reverse, one team | 3 questions, ~5 min of reasoning | ≤10 lines |
| **2** | Irreversible, expensive, or cross-team; or the user asked for a full analysis | Ground truth ledger + reasoning chain | Full template |

Default to Tier 1. Escalate to Tier 2 when you cannot verify a load-bearing assumption, when the default solution traces back to an assumption that looks false, or when the user explicitly wants the reasoning laid out. Drop to Tier 0 when the analysis would cost more than being wrong.

**Tier 0 question:** "Is this solving the real problem, or a symptom of it?"

**Tier 1 questions:**
1. What is the problem in terms of outcome, not solution?
2. Which single assumption is load-bearing — if it's false, the whole plan collapses?
3. What breaks if we remove half of this?

## Step 1: State the problem's essence

1. **Name the problem as an outcome.** "Uploads must not lose data" — not "we need a queue".
2. **Separate symptom from cause.** Slow page → is it the query, the network, or the rendering?
3. **Define success measurably.** What number moves, by how much, checked how?

If the user's request is already a solution ("should we adopt Kafka?"), restate the underlying need before evaluating it. This alone often reframes the question.

## Step 2: Audit the assumptions

List what the proposal takes as given, then try to break each one.

| Category | Question |
|----------|----------|
| Technical | Must we use this technology or pattern? |
| Economic | Is this cost (money, latency, headcount) real, or vendor marketing? |
| Organizational | Does anyone actually own this constraint, and would they say no? |
| Historical | Why was this decided originally, and do those conditions still hold? |

**Red flags that mark an unexamined assumption:**
- "We've always done it this way" → *Legacy trap*: find the original reason; if it's gone, so is the constraint.
- "Industry standard / Company X does it this way" → *Analogy trap*: what problem were they solving, under what constraints, with what scale? Name the dimension where you differ.
- "Everyone uses X" → popularity is a signal about support and hiring, not about fit.
- "That's too simple to work" → complexity is a cost, not evidence of rigor.

## Step 3: Build a ground truth ledger

A ground truth is something you could defend to a skeptic. Label every entry, because unlabeled claims are where this method quietly turns into rationalization.

| Label | Meaning | Requirement |
|-------|---------|-------------|
| `[verified]` | Measured, quoted from a primary source, or read in the code/config | Say where it came from |
| `[derived]` | Follows by reasoning from `[verified]` facts | Show the step |
| `[assumed]` | Plausible but unconfirmed | State how to verify and what verification costs |
| `[blocked]` | Cannot be settled without information you don't have | Name what you'd need and from whom |

Two rules that do most of the work:

- **A claim that costs more than ~30 minutes to verify is an assumption, not a ground truth.** Label it and move on; do not dress a guess as a fact.
- **Never invent a precise number to make the argument feel rigorous.** "Roughly an order of magnitude" is honest; "$2.1M" without a source is fabrication. If the analysis only works because of a number nobody checked, the analysis doesn't work.

## Step 4: Reason upward

Start from the ledger, not from the available solutions.

1. **Minimal solution.** What is the simplest thing that satisfies every `[verified]` and `[derived]` constraint?
2. **Deletion test (hard check).** Remove a component — does the core problem still get solved? If yes, that component was never justified. Repeat until removal breaks something real. Run this test at least once, out loud, on your own proposal.
3. **Each addition must name the constraint it serves.** "It's good practice" is not a constraint.

Sanity check: if your recommendation needs a component that traces to nothing in the ledger, either the component goes or the ledger is incomplete.

## Step 5: Try to falsify it, then decide

Verification is where this method usually stops too early. Do these three things before writing a recommendation:

1. **Find the weak link.** Which line of the reasoning rests on an `[assumed]` entry? That is the real risk, not the complexity.
2. **State the sensitivity.** "If write volume is actually 10× higher, the recommendation flips from Postgres to X." An analysis that cannot be flipped is a rationalization.
3. **Run the decision gate:**
   - Did the recommendation change relative to the obvious default? If **no**, say so plainly — "the default holds; nothing here justifies changing it" — and stop. That is a successful outcome, not a failed analysis.
   - Do two candidates trace back to the same ground truths? Then the difference is preference. Pick on cost and team familiarity; stop deriving.
   - Set confidence: **high** when the load-bearing facts are `[verified]`, **medium** when one is `[derived]`, **low** when the recommendation hinges on an `[assumed]` entry. Say which.

## Which constraints can actually be challenged

Half of all misuse of this method comes from treating a rule that someone can say no to as if it were physics.

| Kind | Examples | How to treat it |
|------|----------|-----------------|
| **Physical / mathematical** | Speed of light, CAP theorem, memory bandwidth, entropy, 24 hours in a day, quadratic query cost | Boundary conditions. Do not "challenge" them; design around them. |
| **Economic / organizational** | Vendor pricing, on-call burden, headcount, migration effort, hiring market, review latency | Genuinely challengeable — but the cost is real. Put the price in the ledger, not in a footnote. |
| **Normative / compliance / cultural** | Regulations, contracts, security baselines, audit requirements, user habits, team conventions | Challenge only after asking who owns the rule. Changing these is a negotiation or a project, not an insight. Do not recommend skipping a control on the grounds that it seems arbitrary. |

The third row matters most in production. "That's just convention" is correct about *why* the rule exists and wrong about *whether you can ignore it*.

## When this method is the wrong tool

- **The constraint is other people's preferences.** Those are empirical, not derivable — measure or ask, don't reason.
- **The domain is empirical and cheap to test.** Tuning, caching parameters, UX wording: run the experiment. Derivation costs more than a trial.
- **The physics is already satisfied and the real cost is coordination.** Most org-scale engineering decisions are of this kind; the answer is usually "fewer moving parts", which needs no derivation.
- **Time pressure.** If the decision is reversible within a day, deciding beats analyzing.
- **Political conflict disguised as a technical debate.** First principles will produce a technically correct answer that nobody adopts. Name the actual disagreement first.

Read `references/software-examples.md` § *Case Study: When First Principles Reasoning Went Wrong* before applying this to build-vs-buy infrastructure decisions — the method is seductive exactly where the missing constraint is maintenance labor.

## Output formats

Match the format to the tier. Do not use the long template for a Tier 1 question. Write in the language the user used.

**Short form (Tier 1, ≤10 lines):**

```markdown
**Core problem:** [outcome, one sentence]
**Load-bearing assumption:** [the one that matters] — [verified / assumed + how to check]
**Recommendation:** [what to do]
**If this is wrong:** [the fact that would flip it]
```

**Long form (Tier 2):**

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

## Boundaries

- **Analysis, not execution.** This skill stops at the recommendation. No files written, no commands that change state, no side effects. See *Scope: analysis only* above. Analysis is not consent to implement.
- **Budget:** Tier 1 is the default; Tier 2 only for irreversible or cross-team decisions. If the analysis has run longer than the decision is worth, stop and say so.
- **No false precision.** Never invent numbers, benchmarks, or pricing to strengthen a case.
- **No contrarianism for its own sake.** Existing solutions win by default; the burden is on the analysis to show the gap is real (10× wrong, not 1.2×).
- **No unilateral rule-breaking.** Compliance, security, and contractual constraints get flagged, not dismissed.
- **No guaranteed optimum.** This produces a decision you can defend and revise, not a proof.

## Checklist

If a box can't be ticked, lower the stated confidence — don't quietly skip it.

- [ ] Problem stated as an outcome, not a solution
- [ ] Tier chosen and stated
- [ ] Every load-bearing assumption has a verdict and an evidence note
- [ ] Every ground truth carries a label; `[assumed]` entries carry a verification plan
- [ ] Deletion test run on the proposal itself
- [ ] Recommendation compared explicitly against the default
- [ ] Sensitivity stated: what fact would flip the conclusion
- [ ] Confidence level with its reason
- [ ] Analysis only — nothing was executed, written, or changed on the user's behalf

## Additional Resources

Load these only when they're relevant to the case at hand.

- **`references/software-examples.md`** — Five applied software decisions (database, monolith vs microservices, auth, caching, API style), one full failure case, and the anti-over-engineering check. Read when you need a concrete shape for the reasoning, or before a build-vs-buy call.
- **`references/elon-musk-examples.md`** — The SpaceX/Tesla cost breakdowns as historical illustrations. Read for the "materials vs. finished product" move; its numbers are public estimates, not verified figures.
- **`examples/architecture-review.md`** — Long-form (Tier 2) analysis of a microservices decision, with what the rejected path would have cost.
- **`examples/quick-check.md`** — Short-form (Tier 1) analysis in ~10 lines. The right shape for most questions.

`evals/evals.json` holds test prompts for checking whether a change to this skill improves output.
