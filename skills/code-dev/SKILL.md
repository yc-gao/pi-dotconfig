---
name: code-dev
description: >
  Run a development request through four gated stages — Clarify, Plan, Develop, Review — so code is specified, decomposed, verified, and reviewed instead of produced in one shot. Use when the user asks to implement a feature, fix a bug, refactor, or improve performance in a repository ("add X", "fix this bug", "refactor Y", "make this faster", or equivalents such as "帮我实现 X", "修一下这个 bug", "重构 Y", "优化性能"), asks for a change to be designed or planned before coding, or asks to review a finished change against its goal. Stage gates are explicit user confirmations: confirm the shared understanding, approve the task plan, verify each task as it lands, and sign off the review. Includes divide-and-conquer decomposition with per-task verification goals, minimal in-scope implementation, and parallel read-only review by subagents from multiple angles.
---

# Code Dev

A development request moves through four stages, each ending in a gate. The next stage starts only after the gate passes.

| Stage | Delivers | Gate |
|-------|----------|------|
| 1. Clarify | One agreed statement of goal, scope, constraints, and acceptance criteria | the user confirms that understanding |
| 2. Plan | An ordered set of small tasks, each with a verification goal and an implementation design | the user approves the plan |
| 3. Develop | The working change, delivered and verified task by task | each task's verification goal passes |
| 4. Review | One consolidated verdict on the whole change against the original goal | the user signs off |

The result is a change that matches what was agreed, is verified against stated criteria, separates necessary fixes from optional improvements, and has been examined from several independent angles before acceptance.

## Workflow

Two rules hold across every stage:

- **Gates are explicit confirmations.** Silence, partial agreement, "looks reasonable", and no objection are not confirmation. A user correction sends you back to the affected work, not forward: revise it, recheck whatever depended on it (ordering, verification goals, other tasks, the review), and present the full summary again rather than only the delta.
- **Output has a fixed shape.** Each gate message and each per-task report uses its template from `references/output-templates.md`; load that file before writing the first gate message of a session. In every template: translate into the user's language, keep the structure and line order, fill every line with concrete content (real files, real commands, real results), write "none" instead of dropping a line, and use only the lines the template defines.

Each stage below is that gate in order: Enter says what must be true to begin, Exit says what must be true to pass, and the steps say how to get from one to the other.

### 1. Clarify

Enter: a development request. Exit: an outcome that can be implemented and verified, confirmed by the user.

1. **Use context before asking.** Take the answer from the request, the conversation, the code, errors, and repo guidance first — and from the code or tests whenever they are more reliable than the user. Do not ask for what is already given or discoverable, and do not hand the user decisions that repo conventions or ordinary judgment settle. When an unknown is low-impact and a safe reversible default exists, state the assumption and continue. Never invent requirements, and never make a consequential choice silently.
2. **Ask only what changes the work, and read it as its type.** Ask when different answers would change implementation, scope, or validation — concretely, briefly, in the user's language, with a few meaningful options and a recommended default, grouped by related decision via `ask_user`. Name the task type and probe the uncertainties it carries:
   - Feature — user-visible behavior, key cases, out of scope.
   - Bug — expected vs actual, a reproduction, environment and errors.
   - Refactor or performance — behavior that must stay equivalent, how success is measured.
3. **Confirm the shared understanding.** Close with one consolidated statement: task type and goal, scope and out-of-scope, constraints and assumptions, acceptance criteria and how each will be verified, and the next step. Wait for explicit confirmation.

When the request is already specific, skip questions but still present the full summary and wait.

### 2. Plan

Enter: a confirmed outcome. Exit: every in-scope task has a verification goal, a design, and the user's approval of the plan as a whole, plus a `todo` list that mirrors it.

1. **Decompose along real seams.** Split the confirmed scope by layers, modules, files, data flow, or dependency order — not by size targets. Every task must be single-purpose (one reason to change, one thing to verify), independently verifiable (a check that passes or fails on its own, without later tasks existing), ordered (dependencies and unblocked tasks explicit, including which run in parallel), and bounded (its files, APIs, and surface area named, so scope creep is visible). Split any task a reviewer cannot hold in their head, or whose verification depends on an unrelated change landing first.
2. **State the verification goal first.** Before design detail, write the command, test, or observation that proves the task done, plus its expected result. If a task has no cheap check, say how it will be verified instead and why. A task without a verification goal is not ready to plan.
3. **Design the approach.** Record what a reviewer needs to judge it: which files and symbols change, the shape of the change (new module, signature change, migration, deleted code path), alternatives considered and why rejected, risks, and rollback. Disclose any design that only works once a later task changes the contract.
4. **Present the whole plan and wait.** Name real files and real commands — "add tests" and "refactor as needed" are neither a task nor a verification goal. On approval, load the plan into the `todo` tool: `clear` any earlier list, then `add` one item per task in dependency order, each reading `<task title> — verify: <verification goal>`. The list, not memory or the message history, is the record of what Develop still owes.

### 3. Develop

Enter: an approved plan and its `todo` list. Exit: every item implemented, verified, and ticked; the diff holding nothing outside the plan; the acceptance criteria holding on the whole change, not only item by item.

Work the list, not the narrative: take the first unticked item, finish it, tick it, read the list again. If the list disagrees with your sense of progress, the list is right.

1. **Prepare.** Re-read the item's design, open the files and symbols it names, and confirm the code still matches what the plan assumed — signatures, callers, existing tests. Record the baseline (the item's verification command, or the existing suite) so a later pass or fail is attributable to your change.
2. **Stay inside the item's bound.** Touch only the files, symbols, and APIs it names, and follow repository conventions over personal preference — naming, error handling, module layout, test style. No drive-by refactors, renames, reformatting, dependency bumps, or unrelated fixes; record them as follow-ups. Delete the code path you orphaned instead of leaving it dead.
3. **Implement the approved design, not a variant.** Helper extraction, naming, error messages, small control flow are yours; the design is not. If it cannot work as written — missing API, hidden coupling, no test infrastructure, conflicting repo constraints — stop, state precisely what broke, offer the smallest options, and get approval before deviating. Never implement the next item to make this one pass.
4. **Verify.** Run the item's verification goal exactly as planned, adding the targeted test when the goal is a test; then the narrowest regression checks (related tests, typecheck, lint, build) and a read of the diff for unintended changes. A failing check blocks progress: fix it, or report and stop. Never pass a check by skipping it, disabling it, loosening assertions, or hardcoding expected values — and never stack the next item on unverified code.
5. **Record and continue.** Tick the item, report with the Develop template, and continue unless the user asked to review items individually. If an outcome shifts later items — a contract moved, one became unnecessary, a new one appeared — update the plan, confirm, and rewrite the `todo` list to match (`clear`, then re-`add` in the new order); never leave a stale item for an item the plan dropped. In a git worktree, and unless the user said otherwise, leave one commit per verified item using the repository's message convention.

### 4. Review

Enter: a developed change with every `todo` item ticked. Exit: every angle audited, every criterion backed by named evidence or a stated gap, the full verification set run and reported, all findings reconciled, and the user's explicit sign-off.

1. **Fan the audit out immediately.** In one `subagent` parallel workflow, launch independent read-only reviewers, one per angle, each working from the goal, the accepted criteria from `Clarify`, the approved plan, and the change. Cover these angles, dropping one only when it cannot apply and saying so:
   - **Correctness** — logic errors, edge cases, empty or partial input, boundaries, error paths, concurrency and ordering, null checks, resource release.
   - **Criteria and coverage** — each acceptance criterion against real evidence, and missing tests that would have caught the defects this change was meant to fix.
   - **Compatibility and conventions** — public APIs, persisted formats, callers elsewhere in the repo, and whether the code follows how the surrounding code already does it.
   - **Security and data handling** — untrusted input, injection, secrets and logging, authorization, unsafe defaults.
   - **Performance and operations** — complexity, repeated work, blocking calls, memory growth, failure behavior and observability.
   - **Diff hygiene** — unintended edits, scope creep, dead code, debug residue, commented-out code, naming and structure, duplication, stale comments and docs.

   Every reviewer gets the same mandate: read-only, no editing, creating, deleting, committing, or branch switching, and no destructive commands; findings as `file:line` with concrete evidence and a severity of must-fix, should-fix, or noted; "no findings" written explicitly rather than left empty. At least the criteria reviewer also runs the full verification set — the planned checks plus the project's broader gate (full suite, typecheck, lint, build) — since later items can invalidate earlier runs, and reports the commands and results verbatim. Reviewers write nothing, so parallel reviewers cannot race on the working tree.
2. **Reconcile into your own verdict.** Deduplicate what several angles found, surface contradictions instead of silently picking a side, and spot-check each claimed finding against the code before it reaches the user — reviewers both miss and invent. Classify as must-fix (breaks a criterion, a regression, a real defect), should-fix (clarity, naming, duplication, missing coverage), or noted-but-not-doing (out of scope, tracked as follow-ups), naming the criterion each must-fix affects. A failed reviewer or uncovered angle is a coverage gap, never cleared; passing tests or a silent reviewer never clear a risk.
3. **Present and get sign-off.** Keep reviewer wording out of the summary and name the test or observation behind each criterion. If the user asks for changes, fix the must-fix items, re-run the audit (or only the affected angles when the fix is small and the rest of the change is untouched), and present the full summary again. Sign-off is the gate to further work: the next task queue, the next iteration, or closing the change.
