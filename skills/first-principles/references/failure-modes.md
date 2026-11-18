# Failure Modes

The method fails in recognizable ways. Read this when the analysis is running long, the domain is cheap to test empirically, or the disagreement looks political.

## Analysis theater

Symptoms: every section is filled and confident, every "ground truth" is asserted rather than sourced, the ledger only contains facts that support the conclusion, and the recommendation is exactly what the user proposed before the analysis started.

The tell is the ledger's shape: if nothing in it is `[assumed]` or `[blocked]`, either the decision was trivial or the audit was not done.

Fix: label honestly, then find the one entry the recommendation actually rests on and either verify it or write the sensitivity statement.

## The omitted human constraint

First principles is most seductive exactly where the constraint left out is labor. "From first principles, we are paying 12× for a wrapper" is usually right about the arithmetic and wrong about operations: retries, dead-letter queues, dedupe, dashboards, and who gets paged at 2am did not appear in the ledger because they felt like vendor overhead rather than engineering cost.

Before replacing something whose cost looks unjustified, ask: **what is this vendor actually doing that I am not counting?** Worked example and postmortem: `references/software-examples.md` § *Case Study: When First Principles Reasoning Went Wrong*.

## Over-engineering from first principles

"From first principles we could build a better database/framework/scheduler."

Check before it survives Step 4: does building it save more time than using it? Is the gain worth the maintenance burden? Can this team maintain it? Rule of thumb: if the existing solution is within 2× of optimal and the team knows it, use it. The method earns its keep at 10× wrong, not 1.2×. See `references/software-examples.md` § *Anti-Pattern: Over-Engineering from First Principles*.

## When this is the wrong tool

- **The constraint is other people's preferences.** Those are empirical, not derivable — measure or ask, don't reason.
- **The domain is empirical and cheap to test.** Tuning, caching parameters, UX wording: run the experiment. Derivation costs more than a trial.
- **The physics is already satisfied and the real cost is coordination.** Most org-scale engineering decisions are of this kind; the answer is usually "fewer moving parts", which needs no derivation.
- **Time pressure.** If the decision is reversible within a day, deciding beats analyzing.
- **Political conflict disguised as a technical debate.** First principles will produce a technically correct answer nobody adopts. Name the actual disagreement first.

## Scoring artifacts

- **False precision.** Invented numbers, unsourced benchmarks, pricing from memory. Say "roughly an order of magnitude" instead.
- **Contrarianism.** Novelty is not analysis. The burden is on the analysis to show the gap is real.
- **Unilateral rule-breaking.** A compliance, security, or contractual constraint that gets "challenged" into oblivion ends the analysis's usefulness. Flag it, name its owner.
- **No exit condition.** A decision with no falsifier has no way to be revised except by sunk cost. Every Tier 2 recommendation needs the sentence that would reverse it.
