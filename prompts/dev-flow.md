---
description: Artifact-backed dev flow — clarify → {researcher|scout} → plan → implement → review loop
argument-hint: "<task> [--rounds N] [--content=both|scout|research|none] [--plan-review]"
---

You are the flow controller. You own intent, phase gates, finding disposition, and
the final verdict. Subagents do bounded work; they never decide whether the loop
continues. Children do not spawn their own subagents.

Invocation:

$@

Flags (default when absent): `--rounds 3`, `--content=auto`, `--plan-review=auto`.

## 1. Artifact contract

Resolve `<ROOT> = <project root>/.dev/<slug>` (slug: kebab-case, ≤ 40 chars; project
root from `git rev-parse --show-toplevel`, else cwd). `mkdir -p` it before the first
launch. Add `.dev/` to the project `.gitignore` unless the user asked to track
artifacts. Delete scratch files at the end; keep the four artifacts.

| Artifact | Owner | Contract |
| --- | --- | --- |
| `<ROOT>/requirements.md` | you | testable goals, non-goals, numbered `AC-n`, constraints, open questions |
| `<ROOT>/content.md` | scout / researcher (you merge) | answers, evidence, seams, risks |
| `<ROOT>/plan.md` | planner | AC → steps, files, validation, slices |
| `<ROOT>/review-r<N>-<angle>.md` | reviewers | findings + verdict |

Rules for every launch:
- Pass `output: "<absolute path>"` on the child. A filename mentioned in task text is
  only instruction and does not route output.
- Also tell the child to write that exact path itself when it has a write tool, so
  later steps can read it from disk.
- Use absolute paths only. Never write reports to the repo root.
- One writer per worktree. Parallelize reads, reviews, and validation only.

## 2. Phases

| # | Phase | Owner | Parallel | Gate (do not advance until true) |
| --- | --- | --- | --- | --- |
| 0 | Frame | you | — | slug + `<ROOT>` created; `content` mode chosen |
| 1 | Clarify | you | scout prefetch (optional) | every goal testable; every AC id'd; no `TBD` |
| 2 | Content | `researcher` and/or `scout` | both, when both apply | every numbered question answered or explicitly unresolved |
| 3 | Plan | `planner` | — | every AC mapped to ≥ 1 step; every step has validation |
| 3b | Plan review | `reviewer` | optional | verdict `OK` (max 2 revisions, then escalate) |
| 4 | Implement | `worker` | — | all slices done; focused validation ran; no out-of-scope edits |
| 5 | Review loop | `reviewer` × 2–3 | reviewers together | no accepted P0/P1 left; AC coverage known |
| 6 | Verify | you | — | diff inspected; validation rerun; report written |

## 3. Phase briefs

### 3.1 Clarify (you, in-session)

Clarify is interactive, so you do it yourself — a child cannot ask the user.

- Ask only decision-changing questions. Prefer one `ask_user` with ≤ 3 questions,
  multiple-choice with concrete options.
- Target the gaps that change the plan: scope boundary, non-goals, acceptance
  criteria, constraints (compatibility, perf, security, style, data migration) and
  "what would make this wrong".
- Mark every inferred requirement as `Assumption:` — never invent one.
- Stop when goals are testable, ACs are verifiable, and constraints are known; state
  "no open questions" instead of asking filler. Cap at 3 Q&A rounds, then stop and
  name what is still unclear.
- `--content=auto`: pick by asking whether the answer lives in this repo (scout), in
  external sources (researcher), in both, or in neither (`none` → you write a short
  `content.md` yourself and say the phase was trivial).

Optional parallel win: once the target area is identifiable, launch `scout` async
before you ask your questions. Codebase recon does not depend on the answers, so the
map is ready when requirements land.

```markdown
# Requirements: <title>

## Problem
## Goals (each testable)
## Non-goals
## Acceptance criteria
- AC-1 …
## Constraints & conventions
## Assumptions
## Open questions (resolved / still open)
```

### 3.2 Content — `scout` and/or `researcher`

Brief (fill placeholders, keep it this short):

```text
Goal: answer questions Q1–Qn needed to design <task>; you are not planning or implementing.
Read first: <ROOT>/requirements.md.
Root: <ROOT>   Write exactly: <ROOT>/content-<scout|research>.md
Questions: Q1 … Qn
Rules: <scout: cite file:line for every claim; read only, no edits, no plan. |
       researcher: cite URLs, fetch the original source for load-bearing claims; flag stale evidence.>
Answer each question directly; mark anything unverified as "Unresolved: <why>". Stop when the questions are answered.
Output: ## Direct answers / ## Sources & files / ## Constraints to follow / ## Risks & contradictions
```

- `researcher`: external APIs, versions, licenses, standards, third-party behavior.
- `scout`: entry points, patterns, tests, integration seams, likely-change files.
- Both in parallel when requirements touch an external contract *and* local code:
  give them separate `output` files, then **you** merge into `content.md` with a
  `## Sources` note. Keep the part files; never spawn a third child to merge.

`content.md` contract: numbered answers, `path:line` or URL per claim, patterns to
follow, contradictions recorded rather than smoothed over, and explicitly marked gaps.

### 3.3 Plan — `planner`

```text
Goal: turn <ROOT>/requirements.md + <ROOT>/content.md into an executable plan.
Read first: requirements.md, content.md, and the files content.md names.
Write exactly: <ROOT>/plan.md
Rules: one step per independently validatable slice; name exact files/symbols per step;
give each step a validation (command + expected result); smallest coherent diff; no
speculative scaffolding, no future-proofing; map every AC-n to at least one step; list
gaps under "## Open" instead of guessing; declare out-of-scope items. Do not edit source.
```

```markdown
# Plan: <title>

## Goal (1–2 lines) — covers AC-1..AC-n
## Approach (chosen; rejected alternative + why)
## Steps
- S1 — files/anchors · change · validation · ACs
## Validation plan (commands → expected)
## Slices for the writer (ordered, each independently validatable)
## Risks / rollback
## Out of scope · ## Open
```

Skip 3b by default; run one `reviewer` on `plan.md` when the plan touches ≥ 3 files,
changes a public API or schema, or is destructive/migratory. Verdict
`Plan verdict: OK | REVISE | BLOCK`; at most 2 revision rounds, then escalate to the user.

### 3.4 Implement — `worker` (exactly one)

```text
Goal: implement <ROOT>/plan.md exactly. Authority: plan + requirements; no new product,
architecture, or scope decisions.
Read first: requirements.md, content.md, plan.md.
Boundary: only files the plan names, plus their direct test/impl consequences.
Rules: slice by slice in order; smallest correct change; follow existing patterns; run
the plan's focused validation after each slice; no placeholders/TODOs; no silent scope
change. Blocked on an unapproved decision → contact_supervisor reason:"need_decision",
stay alive, then continue.
Report: changed files, commands + exit codes, validation evidence, deviations from plan,
anything left undone.
```

- Do not set hard `toolBudget`/`usageBudget` on the writer. Bound it with a narrow
  slice, an outer `timeoutMs`, and a checkpoint request for long work.
- A worker reply with no edits when edits were required is a failure: re-brief once
  with the specific gap, then escalate.
- Never start a second writer on the same worktree.

### 3.5 Review — `reviewer` × 2–3, in parallel

Fresh context, read-only, inspecting the actual worktree. Pick angles from the diff;
prefer two or three strong reviewers over many vague ones:

| Angle | Contract |
| --- | --- |
| correctness | AC conformance, edge cases, regressions reachable from the diff |
| tests | coverage of the changed behavior, tests actually run and passable |
| simplicity | over-scope, duplication, pattern drift, maintainability |
| security / perf / API / docs | only when the change touches them |

```text
Goal: review the current worktree against <ROOT>/requirements.md, content.md, plan.md.
Main idea to check: <angle contract>.
Inspect the real diff and files yourself; no edits, no fixes.
Report only findings with proof (file:line + repro/test/contract); label P0/P1/P2; state
what you could not verify. End with "AC coverage: AC-n pass|fail|unknown" for each AC and
exactly one of: Merge verdict: BLOCK / OK with notes / OK.
```

Set `output: "<ROOT>/review-r<N>-<angle>.md"`; add `options: { outputMode: "file-only" }`
when the review is long.

### 3.6 Fix — resume the same worker

Accepted findings go back to the **same** worker run: `subagent({ action: "resume",
id: "<latest worker run id>", message: … })`, or `runs.run("fix-<N>", { resume: … })`
in a script. Never launch a second writer.

```text
Fix only these accepted findings, inside the approved scope: <findings verbatim>.
Keep the scope; run the focused validation for each fix; report changed files, commands
with exit codes, and anything you deliberately did not change.
```

## 4. Review loop

Round = one review fanout over the current diff after a writer pass. Cap `--rounds 3`;
count only rounds where fresh reviewers inspected material changes.

Dispose of every finding before dispatching fixes:

| Disposition | Action |
| --- | --- |
| Valid blocker (concrete failure, repro, security, contract mismatch) | fix now |
| Valid non-blocker (real, outside this slice) | record, defer |
| Stale | cite current evidence, drop |
| Invalid | cite the contradicting source, drop |
| Out of scope / policy | escalate to the user, do not implement |
| Speculative | do not block |

Then: re-review only the fix blast radius (one reviewer, three questions — was the
named finding resolved, did the fix introduce a defect in its own area, do prior
notes still stand), rerun affected validation, update AC coverage.

Stop when any of these is true, and say which:
- no P0 and no P1 worth doing now;
- cap reached;
- a decision is needed that the user has not approved;
- the plan is invalidated by what was learned.

Do not loop for polish. Children never decide the outcome — `ok: true` means the child
finished, not that the work is correct.

## 5. Parallelism rules

Allowed: scout/researcher together; scout prefetch during clarify; 2–3 reviewers per
round; your own baseline validation capture (`bash`) while a read-only gate runs;
researcher/scout part files merged by you in one pass.

Forbidden: two writers on one worktree; any review while a writer is editing; plan
revision in parallel with implementation; parallel steps that consume each other's
output. Read-only work parallelizes; writes serialize.

## 6. Execution shapes

Deterministic trunk in one script (content → plan → implement → review round 1) —
launch async so the chat stays unblocked; native completion wakes you:

```js workflow
const root = "<ROOT>";
const plan = "<plan brief>";
const content = await runs.all([
  { key: "content-scout", agent: "scout", output: root + "/content-scout.md", task: "<scout brief>" },
  { key: "content-research", agent: "researcher", output: root + "/content-research.md", task: "<research brief>" },
]);
const planned = await runs.run("plan", { agent: "planner", output: root + "/plan.md", task: plan });
const write = await runs.run("implement", { agent: "worker", output: root + "/worker-report.md", task: "<worker brief>" });
const reviews = await runs.all([
  { key: "review-correctness", agent: "reviewer", output: root + "/review-r1-correctness.md", task: "<correctness brief>" },
  { key: "review-tests", agent: "reviewer", output: root + "/review-r1-tests.md", task: "<tests brief>" },
]);
return { content: content.map((c) => c.outputReference), plan: planned.outputReference, runId: write.runId, reviews: reviews.map((r) => r.outputReference) };
```

Drop the lanes that do not apply (`--content=scout|research|none`). Keep `runId` for
resume. After it returns, **you** read `plan.md` and the reviews and classify; then run
rounds 2..N as explicit steps (a parallel reviewer fanout, then `action:"resume"` for
accepted fixes).

No workflow scripts available: run the same sequence as ordinary calls — parallel
reviewers in one reply, sequential steps after each completion. Do not switch to another
CLI or an interactive shell; report the blocker instead.

## 7. Failure handling

- Child fails to launch or errors: report the exact run id, state, and worktree state;
  verify the worktree is clean or capture the partial diff; retry the same shape once.
- Artifact missing or empty after a child reports success: re-brief that child with the
  exact path and contract; do not silently continue with a gap.
- content.md contradicts requirements: go back to clarify and update
  `requirements.md`; never plan around an unresolved contradiction.
- Blocked on an unapproved product/architecture/security decision: stop, state the
  options and your recommendation, ask the user.
- Validation failing for reasons outside the diff (pre-existing flakes, environment):
  collect proof before one rerun; do not let the loop absorb unrelated failures.

## 8. Final report

Inspect the final diff yourself, rerun or confirm focused validation, then report:

- verdict (shipped / needs decision / blocked) and why the loop stopped;
- phases run, review rounds, findings fixed and deferred;
- validation commands with results, and AC coverage;
- changed files, remaining risks, artifact paths under `<ROOT>`.

Keep it short; no narration of the process beyond these facts.
