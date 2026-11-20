# Failure Modes

Read this when the analysis is running long, the domain is cheap to test empirically, the disagreement looks political, or a build-vs-buy decision is on the table.

## Analysis theater

Symptoms: every section filled and confident, every "ground truth" asserted rather than sourced, the ledger containing only facts that support the conclusion, and the recommendation exactly what the user proposed before the analysis started.

The tell is the ledger's shape: if nothing in it is `[assumed]` or `[blocked]`, either the decision was trivial or the audit was not done. Fix: label honestly, find the one entry the recommendation actually rests on, then verify it or write the sensitivity statement.

## The omitted human constraint

First principles is most seductive exactly where the constraint left out is labor. "From first principles, we are paying 12× for a wrapper" is usually right about the arithmetic and wrong about operations: retries, dead-letter queues, dedupe, dashboards, and who gets paged at 2am did not appear in the ledger because they felt like vendor overhead rather than engineering cost.

**The case.** A team of six ran job processing on a managed queue. The arithmetic checked out: ~50k jobs/min, each a row lookup plus an HTTP call, and the underlying Redis cost a fraction of the invoice. So they built an in-house queue on the same Redis. The fatal ledger entry was "queue logic is ~800 lines" — `[assumed]`, and wrong: the 800 lines were the *enqueue* path, while retry, backoff, dead-letter, dedupe, and visibility timeouts lived in the vendor's product. Nobody wrote down the real load-bearing assumption — *we can operate this ourselves*. Seven months, two incidents, a dashboard built from scratch, and a managed queue restored at a higher price.

Two lessons. **Ledger completeness:** on-call rotation, missing dashboards, upgrade paths, and who has ever debugged a stuck consumer are constraints, and they never feel technical. **Exit condition:** the honest version would have been *"if we spend more than 3 engineer-weeks on queue internals this quarter, or paging for job failures rises, revert"* — without that sentence, sunk cost does the arguing.

**Rule:** before replacing something whose cost looks unjustified, ask what the vendor is actually doing that you are not counting. The gap between raw infrastructure cost and invoice is usually labor, correctness edge cases, and observability — real constraints, not markup.

## Over-engineering from first principles

"From first principles we could build a better database/framework/scheduler." Before it survives Step 4: does building it save more time than using it? Is the gain worth the maintenance burden? Can this team maintain it? If the existing solution is within 2× of optimal and the team knows it, use it. The method earns its keep at 10× wrong, not 1.2×.

## When this is the wrong tool

- **The constraint is other people's preferences.** Empirical, not derivable — measure or ask.
- **The domain is empirical and cheap to test.** Tuning, caching parameters, UX wording: run the experiment. Derivation costs more than a trial.
- **The physics is already satisfied and the real cost is coordination.** Usually the answer is "fewer moving parts", which needs no derivation.
- **Time pressure.** If the decision is reversible within a day, deciding beats analyzing.
- **Political conflict disguised as a technical debate.** First principles will produce a technically correct answer nobody adopts. Name the actual disagreement first.

## Scoring artifacts

- **False precision.** Invented numbers, unsourced benchmarks, pricing from memory. Say "roughly an order of magnitude" instead.
- **Contrarianism.** Novelty is not analysis. The burden is on the analysis to show the gap is real.
- **Unilateral rule-breaking.** A compliance, security, or contractual constraint "challenged" into oblivion ends the analysis's usefulness. Flag it, name its owner.
- **No exit condition.** A decision with no falsifier can only be revised by sunk cost. Every Tier 2 recommendation needs the sentence that would reverse it.
