---
name: code-dev
description: >
  Run a development request through four gated stages — Clarify, Plan, Develop, Review — so code is specified, decomposed, verified, and reviewed instead of produced in one shot. Use when the user asks to implement a feature, fix a bug, refactor, or improve performance in a repository ("add X", "fix this bug", "refactor Y", "make this faster", or equivalents such as "帮我实现 X", "修一下这个 bug", "重构 Y", "优化性能"), asks for a change to be designed or planned before coding, or asks to review a finished change against its goal. Stage gates are explicit user confirmations: confirm the shared understanding, approve the task plan, verify each task as it lands, and sign off the review. Includes divide-and-conquer decomposition with per-task verification goals, minimal in-scope implementation, and parallel read-only review by subagents from multiple angles.
---

# Code Dev

Turns a development request into a reviewed change across four stages:

| Stage | Delivers |
|-------|----------|
| 1. Clarify | One agreed statement of goal, scope, constraints, and acceptance criteria |
| 2. Plan | An ordered set of small tasks, each with a verification goal and an implementation design |
| 3. Develop | The working change, delivered task by task |
| 4. Review | One consolidated verdict on the whole change against the original goal |

Each stage ends with the user's explicit confirmation of its result, and the next stage starts only after that confirmation. What comes out is a change that matches what was agreed, is verified against stated criteria, distinguishes necessary fixes from optional improvements, and has been examined from several independent angles before it is accepted.

## Workflow

### 1. Clarify

Before changing code, establish an outcome that can be implemented and verified.

1. **Use context before asking.** Draw the answer from the request, the conversation, the code, errors, and repo guidance first — and from the code or tests whenever they are more reliable than the user. Do not ask for information already given or discoverable, and do not ask the user to settle details that repo conventions or ordinary judgment decide. When an unknown is low-impact and a safe reversible default exists, state the assumption and continue. Never invent requirements, and never make a consequential choice silently.
2. **Ask only what changes the work.** Ask when different answers would change the implementation, scope, or validation. Keep questions concrete, brief, and in the user's language; offer a few meaningful options with a recommended default. Use `ask_user`, grouping related questions into one form and keeping unrelated decisions apart.
3. **Classify the request.** Name the task type — feature, bug, refactor, performance, explanation, or other — and focus on the uncertainties that type carries:
   - Feature: user-visible behavior, key cases, out of scope.
   - Bug: expected vs actual, a reproduction, environment and errors.
   - Refactor or performance: behavior that must stay equivalent, how success is measured.
4. **Confirm the shared understanding.** End clarification with one consolidated statement of what you understand: task type and goal, scope including what is out of scope, constraints and assumptions, acceptance criteria and how they will be verified, and the intended next step. Wait for explicit confirmation before going further; silence, partial agreement, or an implicit cue is not confirmation. If the user corrects you, revise, return to the relevant step above, and present the full summary again.

    Use this template, translated into the user's language and filled with concrete content rather than restated questions:

    ```markdown
    **What I understand**

    - Task type: <feature | bug | refactor | performance | explanation | other>
    - Goal: <one or two plain sentences>
    - In scope: <the specific changes or behaviors this task covers>
    - Out of scope: <related things you will not touch>
    - Constraints: <conventions, compatibility, files, APIs, or versions to respect>
    - Assumptions: <defaults you are taking, or "none">
    - Acceptance criteria: <observable conditions, each with how it will be verified>
    - Next step: <the first action you intend to take>

    Please confirm, or correct any line above.
    ```

    Keep every line short and concrete; write "none" instead of dropping a line, since an empty section is itself an assumption the user cannot see.

Clarification ends when the task has an actionable outcome, a way to verify it, and the user's explicit confirmation of that understanding. If the request is already specific, skip questions but still present the full summary and wait.

### 2. Plan

Turn the confirmed outcome into small, independently verifiable tasks, then design each task's implementation before writing code. Divide and conquer: each task must be small enough to review and verify on its own, and its verification goal must be observable without later tasks existing.

1. **Decompose into tasks.** Split the confirmed scope along real seams — layers, modules, files, data flow, or dependency order — not by arbitrary size targets. Each task must be:
   - **Single-purpose** — one reason to change, one thing to verify.
   - **Independently verifiable** — it has a check (test, command, reproduction, or diff inspection) that passes or fails on its own.
   - **Ordered** — its dependencies and the tasks it unblocks are explicit, including which tasks can proceed in parallel.
   - **Bounded** — its files, APIs, and surface area are named, so scope creep is visible.

   Split any task that a reviewer cannot hold in their head, or whose verification depends on an unrelated change landing first.

2. **State a verification goal per task.** Write the check before the design detail: the command, test, or observation that proves the task is done, and the expected result. If a task has no cheap check, say how it will be verified instead and why. A task without a verification goal is not ready to plan.

3. **Design each task's approach.** For every task, record the design at the level a reviewer needs to judge it: which files and symbols change, the shape of the change (new module, signature change, migration, deleted code path), alternatives considered and why they were rejected, risks, and rollback. Keep designs consistent with task order — a design that only works if a later task changes the contract must say so.

4. **Present the plan for approval.** Present all tasks and designs in one consolidated message, then wait for explicit approval. Silence, partial agreement, or "looks reasonable" without a clear go-ahead is not approval. If the user changes scope, task boundaries, or an approach, revise the affected tasks, re-check ordering and verification goals, and present the full plan again.

    Use this template, translated into the user's language and filled with concrete content:

    ```markdown
    **Plan**

    Tasks are ordered; "verify" is the check that closes each one.

    | # | Task | Depends on | Verification goal |
    |---|------|-----------|-------------------|
    | 1 | <one-line task> | — | <command/test/observation → expected result> |
    | 2 | <one-line task> | 1 | <...> |

    **Task 1 — <title>**
    - Change: <files, symbols, and the shape of the change>
    - Approach: <how it works, in a few lines>
    - Alternatives: <considered and rejected, with the reason; or "none">
    - Risks: <what could break, and rollback; or "none">

    **Task 2 — <title>**
    - Change: ...
    - Approach: ...
    - Alternatives: ...
    - Risks: ...

    Out of scope for this plan: <what stays untouched>

    Approve, or tell me which task or approach to change.
    ```

    Keep the table and per-task blocks short. Name real files and real commands; "add tests" and "refactor as needed" are neither a task nor a verification goal.

Planning ends when every in-scope task has a verification goal and an approved design, and the user has explicitly approved the plan. Then implement one task at a time, in order, verifying each before starting the next.

### 3. Develop

Implement the approved plan one task at a time. The plan is the contract: code follows the approved design, and each task's verification goal is that task's exit condition.

1. **Prepare before editing.** Re-read the task's design, open the files and symbols it names, and confirm the code still matches what the plan assumed — signatures, callers, existing tests. Note the baseline first (run the task's verification command, or the existing suite) so a later pass or fail is attributable to your change.

2. **Change minimally inside the task's bound.** Touch only the files, symbols, and APIs the task names, and follow the repository's existing conventions over personal preference: naming, error handling, module layout, test style, and how similar code already does it. No drive-by refactors, renames, reformatting sweeps, dependency bumps, or unrelated bug fixes — record them as follow-ups. When you replace a code path, delete what it orphaned rather than leaving dead code behind.

3. **Implement the approved design, not a variant.** Choices inside the design — helper extraction, local naming, error messages, small control flow — are yours. The design itself is not: if it cannot work as written (missing API, hidden coupling, absent test infrastructure, contradicting repo constraints), stop, state precisely what broke, offer the smallest options, and get approval before deviating. Never implement the plan's successor task to make this one pass.

4. **Verify each task before starting the next.** Run the task's verification goal exactly as planned, adding the targeted test when the goal is a test. Then check for regressions with the narrowest surrounding checks — related tests, typecheck, lint, build — and read the diff to confirm it contains only intended changes. A failing check blocks progress: fix it, or report and stop. Do not make a check pass by skipping, disabling, loosening assertions, or hardcoding expected values, and do not stack the next task on unverified code.

5. **Report per task and keep state visible.** Report after each task using the template below, then continue unless the user asked to review each task individually. If the outcome changes later tasks — a contract moved, a task became unnecessary, a new task is required — update the plan and confirm with the user before entering the affected tasks. If the repo is a git worktree and the user has not said otherwise, leave one commit per verified task using the repository's message convention.

    Use this template, translated into the user's language and filled with concrete content:

    ```markdown
    **Task <n> — <title>: <done | blocked>**

    - Changed: <files and symbols touched>
    - Verification: `<command>` → <actual result; expected result>
    - Regressions: <surrounding checks run and their result; or "none run, because ...">
    - Follow-ups: <out-of-scope findings; or "none">
    - Next: <task n+1 title>
    ```

    Keep it to the lines above; lead with `blocked` and the failing check rather than a narration of attempts when a task stalls.

Develop ends when every planned task is implemented and its verification goal passes, the diff holds nothing outside the approved plan, and the acceptance criteria agreed in `Clarify` hold on the whole change — not only task by task.

### 4. Review

Review the finished change against the original goal, not against the code's own story. The main agent stays the only writer: it does a first pass itself, fans the deep review out to parallel read-only reviewers via `subagent`, reconciles their findings against the code, and presents the result for the user's confirmation.

1. **Review the diff as a reviewer, not an author.** Read the complete change top to bottom before delegating — every hunk, including ones that felt trivial while writing. Check for: unintended edits, leftover debug output and commented code, dead or unreachable paths, and unrelated changes smuggled in. You need this context to judge what the reviewers send back.
2. **Check goal, not just tests.** Map each acceptance criterion from `Clarify` to the observable evidence that satisfies it. Passing tests that do not address a criterion is a gap, not a pass. Conversely, call out criteria still unverified and why.
3. **Re-run the whole verification set at once.** After the final task, run the full planned checks plus the project's broader gate (full test suite, typecheck, lint, build) rather than trusting per-task runs, since later tasks can invalidate earlier ones. Record the commands and their results verbatim — the reviewers and the user both need them.
4. **Fan the deep review out to parallel reviewers.** Launch independent read-only reviewers in one `subagent` parallel workflow, one per angle, each told to work from the goal, the accepted criteria, the approved plan, and the diff plus recorded check results. Cover at least these angles, dropping one only when it cannot apply and saying so:
   - **Correctness** — logic errors, edge cases, empty or partial input, boundaries, error paths, concurrency and ordering, missing null checks, resource release.
   - **Criteria and coverage** — each acceptance criterion against real evidence, and tests that would have caught the defects this change was supposed to fix.
   - **Compatibility and conventions** — public APIs, persisted formats, callers elsewhere in the repo, and whether the code follows how the surrounding code already does it.
   - **Security and data handling** — untrusted input, injection, secrets and logging, authorization, unsafe defaults.
   - **Performance and operations** — complexity, repeated work, blocking calls, memory growth, failure behavior and observability in production.
   - **Diff hygiene** — scope creep, dead code, debug residue, naming and structure, duplication, stale comments and docs.

   Give every reviewer the same read-only mandate: do not edit, create, or delete files; do not commit or switch branches; do not run destructive or slow commands; report findings as `file:line` with the concrete evidence and a severity of must-fix, should-fix, or noted; write "no findings" explicitly rather than leaving a section empty. Reviewers write nothing — the main agent applies every fix, so parallel reviewers can never race on the working tree.

5. **Reconcile before reporting.** Deduplicate the same issue found by several angles, surface contradictions instead of picking a side silently, and verify every claimed finding against the code yourself — reviewers both miss and invent things, so nothing reaches the user unconfirmed. Then classify: must-fix (breaks a criterion, a regression, a real defect), should-fix (clarity, naming, duplication, missing coverage), noted-but-not-doing (out of scope, tracked as follow-ups). State which criterion each must-fix affects. If a reviewer failed or an angle went uncovered, say so as a coverage gap rather than implying it was cleared, and never present a risk as cleared because tests pass or because no reviewer flagged it.

6. **Get explicit user confirmation.** Present the summary below and wait. Silence, partial agreement, or no objection is not confirmation. If the user requests changes, fix the must-fix items, re-run steps 3 and 4 (or re-run only the affected angles when the fix is small and the diff is unchanged elsewhere), and present the full summary again rather than only the delta.

    Use this template, translated into the user's language and filled with concrete content:

    ```markdown
    **Review**

    - Goal: <the outcome agreed in Clarify, one line>
    - Changed: <files and symbols; the shape of the change in a sentence>
    - Acceptance criteria: <criterion → evidence it holds, one line each>
    - Checks: <command → result, for the full verification set>
    - Review angles: <angles reviewed, and any angle or reviewer that failed or was skipped>
    - Must fix: <defect, gap, and the criterion it breaks; or "none">
    - Should fix: <improvement with its reason; or "none">
    - Not doing: <out-of-scope findings and follow-ups; or "none">
    - Residual risk: <what remains unverified or uncertain, and why acceptable; or "none">

    Confirm to accept this change, or tell me what to fix.
    ```

    Keep every line concrete and short, and keep reviewer wording out of it — reconcile their language into your own. "Tests pass" alone is not evidence for an acceptance criterion; name the test or observation.

Review ends when the diff is understood end to end, every acceptance criterion has named evidence or a stated gap, the full verification set has been run with results reported, every review angle is either reconciled or declared a coverage gap, and the user has explicitly confirmed the result — which is the gate to continuing development work, whether that means the next task queue, the next iteration, or closing the change.
