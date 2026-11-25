# Output Templates

One template per stage. Each gate message and each per-task report uses the matching template, translated into the user's language and filled with concrete content.

Rules for all templates:

- Translate the headings, labels, and fixed phrases; keep the structure and the line order.
- Fill every line with real content — real files, real commands, real results. Never ship an angle-bracket placeholder, and never restate the user's question as the answer.
- Write "none" instead of dropping a line. An empty section is an assumption the user cannot see.
- Keep lines short. One sentence per line; no narration of your own process.
- Use only the lines the template defines. Extra sections dilute the gate and slow the user's confirmation.

## 1. Clarify — shared understanding

Ends clarification and requests explicit confirmation of the understanding.

````markdown
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
````

Notes:

- Answer each line from context first; do not restate open questions here.
- Every acceptance criterion names both the condition and how it will be verified.
- The closing line asks for the full confirmation, not for a specific field.

## 2. Plan — tasks and designs

Presents the whole task list and every task design in one message, and requests approval of the plan as a whole.

````markdown
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
````

Notes:

- One row per task, in dependency order; state parallelizable tasks explicitly in the "Depends on" column.
- Name real files and real commands. "Add tests" and "refactor as needed" are neither a task nor a verification goal.
- A per-task block without a verification goal is not ready to present.

## 3. Develop — per-task report

Reports each finished task, then continues unless the user asked to review tasks individually.

````markdown
**Task <n> — <title>: <done | blocked>**

- Changed: <files and symbols touched>
- Verification: `<command>` → <actual result; expected result>
- Regressions: <surrounding checks run and their result; or "none run, because ...">
- Follow-ups: <out-of-scope findings; or "none">
- Next: <task n+1 title>
````

Notes:

- Paste the actual command and its actual result; a report that omits the result is not a verification.
- When a task stalls, lead with `blocked` and the failing check rather than a narration of attempts.
- "Next" names the next task, or states that the plan is complete and review follows.

## 4. Review — consolidated verdict

Closes the change and requests the user's sign-off.

````markdown
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
````

Notes:

- Reconcile reviewer language into your own; do not paste reviewer wording.
- "Tests pass" alone is not evidence for an acceptance criterion — name the test or observation.
- A skipped or failed reviewer appears in "Review angles" as a coverage gap, never as cleared.
