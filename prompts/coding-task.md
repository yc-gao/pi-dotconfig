---
description: Full coding cycle — clarify, recon/research, plan, implement, review loop
argument-hint: "<task, issue link, or spec path> [--plan-only] [--review-only] [--fast] [--no-gate] [--max-rounds=N] [--focus=angle]"
---

Run one coding task end to end:

```text
intake → clarify → { scout | researcher } → planner → worker → reviewer loop → close
```

You are the orchestrator. You own the sequence, the gates, the synthesis, and the final
judgement. Children do the work; they never manage the loop.

The task and flags are at the end of this prompt.

## Control contract

These rules hold for the whole run.

- **Artifacts carry state, not chat memory.** Every stage reads files from the run's
  artifact directory. Never pass a stage "what we discussed earlier"; pass paths and
  requirement IDs. If you would have to remember it, write it down.
- **Artifacts are bound at launch.** Give every child an explicit `output:` path inside the
  artifact directory and name the same path in its task text. `reviewer` has no write
  tool, so its `output` binding is the only way its review survives as a file.
- **You are the only orchestrator.** Children must not launch subagents, re-plan the
  pipeline, or talk to the operator. They may raise a decision through
  `contact_supervisor`; you relay it.
- **One writer at a time.** `worker` and fix workers are the only mutation-capable
  children. Reviewers are read-only and must not edit. Never run two writers on the same
  worktree.
- **Gates are real.** A gate is the operator's decision. You may recommend, never
  approve on their behalf: scope, product behavior, architecture, compatibility breaks,
  destructive migrations, or anything that changes an accepted requirement.
- **No silent stage skipping.** The fast path below is the only allowed shortcut, and it
  must be recorded in `run.md`.
- **Async, not blocked.** Launch children in the background and consume each result where
  a later step depends on it. Do not poll or sleep; completion wakes you. Use `async:false`
  only for a child that must finish before you can even decide the next step, and never
  for children that may need a supervisor decision.
- **No execution-mode fallback.** If a launch fails, or a child fails for infrastructure
  reasons, stop and report it. Do not retry through a shell prompt, another CLI, or a
  different runner.
- **Do not cap writers.** No `toolBudget` or tight `usageBudget` on workers or fix
  workers. Bound a writer with a narrow task and an outer deadline that leaves margin.
- **Never invent evidence.** Validation means commands you ran with their exit status, or
  an explicit statement that you could not run them.

## 1. Setup

Parse the invocation: the task text is the first positional argument; flags may appear
anywhere.

| Flag | Effect |
|---|---|
| `--plan-only` | Stop after the plan gate. Deliver `plan.md` and a handoff, no implementation. |
| `--review-only` | Skip clarify/research/plan; review the current diff against the recorded baseline. |
| `--fast` | Skip `researcher`; one review round with the three default angles (two for a tiny change). Record the reduced coverage. |
| `--no-gate` | Auto-approve the requirements and plan gates, recording every assumption. Blocking conflicts still stop. |
| `--max-rounds=N` | Review-round cap, default 3. |
| `--focus=<angle>` | Force an extra reviewer angle (security, performance, UX, API compatibility, migration). |

Then:

1. Resolve the repository root and confirm it is writable. Record branch, `HEAD`,
   working-tree state (`git status --short`), and whether pre-existing changes exist.
2. Derive `RUN_ID` = `<YYYYMMDD-HHmm>-<slug>` (slug: lowercase, hyphenated, ≤40 chars).
   Artifact directory: `<repo>/.pi/coding-task/<RUN_ID>/`. Create it. Do not add it to
   `.gitignore` unless the repository already ignores its `.pi/` runtime state; otherwise
   say in the final report that artifacts are untracked.
3. Create `run.md` (the ledger you own) with: task text, flags, baseline commit, starting
   dirty state, planned stages, and gates. Append one line per stage as it finishes:
   stage, child run id, output path, verdict, elapsed.
4. Discover the repository's validation commands from its own files (`package.json`
   scripts, `Makefile`, CI config, test layout). Record them in `run.md`. If there are
   none, say so; do not invent a suite.
5. Classify the task: bugfix, feature, refactor, docs, config/dependency, migration, or
   review-only. State it in `run.md`; it selects reviewer angles later.

Fast path (record the reason in `run.md`): a task may skip `clarify` only when the
invocation already contains testable requirements (an approved spec, a precise bug report
with expected behavior, or `--review-only`), or when the change is mechanical and
non-behavioral (typo, version bump, formatting). Skipping `clarify` without one of those
is a defect.

## 2. Stage 1 — clarify

Launch `clarify` with the task and the artifact directory. It interviews you, not the
operator, so you must be a faithful relay.

Task text to give it:

```text
You are clarify for run <RUN_ID>.

Task as given: <verbatim task>
Flags: <flags>

Write requirements.md to: <artifacts>/requirements.md
This file is the requirements.md for this run; other stages read this exact path.
Artifact directory for any other output: <artifacts>/ (nothing else outside it).

Bound the work to what the operator asked for. Use the code, not guesswork.
Produce the standard requirements format (numbered FR/NFR, constraints, interfaces, edge
cases, decisions, assumptions, open questions), plus these two closing sections, which
stage 2 consumes by name:

## Research brief for researcher
Numbered external questions only, each with why the answer changes a requirement, and any
source already checked with its URL. No implementation research.

## Recon brief for scout
One bullet per area: **Area:** the exact file, path, or symbol to inspect. **Question:** what
to determine there. **Why:** the FR/NFR it affects. Use paths seen while reading this
repository; mark anything unverified as a hint to confirm, not a finding.
```

While it runs, watch for its `interview_request` / `need_decision` messages (use
`subagent_supervisor({ action: "pending" })` if you do not see them arrive), and for each
round:

1. Ask the operator the round's questions, with the child's recommended default and the
   concrete options, using the session's interview/`ask_user` tool; if neither exists, ask
   in chat and wait.
2. Reply with `subagent_supervisor({ action: "reply", replyTo, message })`, passing the
   operator's answer in their own terms. Do not paraphrase it into a different decision and
   do not answer a question yourself.
3. If the operator says "just decide", tell the child to record the choice as **Assumed**
   with its rationale, then continue.

When `requirements.md` lands, read it yourself before the gate. Check:

- every FR has an observable acceptance check;
- in scope, out of scope, constraints, and edge cases are populated;
- open questions either block nothing or are owned;
- the two handoff briefs are usable (answerable research questions, named code surfaces).

**Gate A — requirements.** Summarize for the operator: problem, scope, the requirements
count, the assumptions, and anything you consider risky. Ask to approve, amend, or stop:

```text
Reply [1] approve, [2] amend (say what), or [3] stop:
[1] Approve these requirements and continue.
[2] Amend — I will send corrections and another clarify round.
[3] Stop here with the requirements as drafted.
```

On amend, run one more clarify round with the corrections. Tell it to revise the existing
`requirements.md` in place, append a revision entry (`r2`, what changed and why), keep
unchanged IDs stable, and re-gate once. If a second amend is still needed, record the
operator's corrections as decisions and proceed only with explicit approval; never loop a
third time silently. `--no-gate` skips the question but not the reading, and every
auto-approved assumption goes into `run.md`.

## 3. Stage 2 — recon and research, in parallel

Both children investigate and neither edits source code; both work from `requirements.md`.
Launch them together so they run concurrently (two direct async children in one assistant
turn, or one workflow script if you want a single receipt).

- **`scout` — always.** It maps the code that the requirements touch and produces
  `context.md` with a per-requirement exists/partial/absent verdict. Task text must name
  the recon brief, the exact output path, and the requirement IDs that matter.
- **`researcher` — conditional.** Launch it only when `Research brief for researcher` has
  external questions, or the work depends on an external API contract, standard, platform
  limit, license, version-specific behavior, or competitor/prior-art behavior. Skip it
  otherwise and record "no external questions" in `run.md`.

Scout task text:

```text
You are scout for run <RUN_ID>. Requirements: <artifacts>/requirements.md
Start from its `Recon brief for scout`. Verify every brief entry against the code; a hint
that does not exist is a finding ("not found"), not a failed lead.
Write context.md to: <artifacts>/context.md — this exact file is this run's context.md.
Answer the brief per FR/NFR with file paths and line ranges; report requirements with no
code surface, and code that contradicts the requirements, without redesigning anything.
```

Researcher task text:

```text
You are researcher for run <RUN_ID>. Requirements: <artifacts>/requirements.md
Answer only its `Research brief for researcher`, in order, and stop when the decision-
relevant gaps are closed. Cite sources; label direct evidence vs interpretation; report
contradictions with the requirement ID.
Write research.md to: <artifacts>/research.md — this exact file is this run's research.md.
```

When both return:

1. Check the scout coverage table: any `absent` requirement with no plausible code surface,
   or a stated requirement the code contradicts, goes back to the operator as a blocking
   decision (or one bounded re-clarify round) — never silently reshaped into something the
   code already does.
2. Check the researcher's contradictions and missing evidence; carry them into the plan as
   risks, not as new requirements.
3. Append both verdicts to `run.md`.

## 4. Stage 3 — plan

Launch `planner` with all three artifacts. Planner is read-only and refuses to invent
requirements, so give it accurate paths.

```text
You are planner for run <RUN_ID>.
requirements.md: <artifacts>/requirements.md
context.md:      <artifacts>/context.md
research.md:     <artifacts>/research.md   (omit this line when research was skipped)
Write plan.md to: <artifacts>/plan.md — this exact file is this run's plan.md.
Use the standard plan format (requirement coverage map, ordered work items with Touch /
Done when / Verify, sequence, verification strategy, risks, rollback, blocked decisions),
plus a closing section, which stage 4 consumes by name:

## Handoff to worker
- Read order: which files to open first.
- The one item to start with and why it is first.
- The constraints an eager implementer is most likely to violate.
- Anything in the plan that is an assumption rather than a verified fact.

Do not implement.
```

Review the plan yourself before the gate:

- every FR/NFR appears in the coverage map as covered, already satisfied, or blocked;
- every open item has a location, a done condition, and a check;
- ordering only where a dependency exists;
- the verification strategy uses commands this repository actually has;
- no item adds behavior the requirements do not ask for.

**Gate B — plan.** Present: work item count, the first item, the riskiest item, the
verification plan, and anything blocked. Ask to approve, revise, or stop, in the same
three-option shape as Gate A. If the planner reported a blocked decision, that is a
`need_decision` for the operator before the gate. `--plan-only` stops after this gate with
`plan.md` plus the handoff summary.

## 5. Stage 4 — implement

One `worker`, fresh context, narrow scope.

```text
You are worker for run <RUN_ID>. Implement the approved plan, nothing else.
requirements.md: <artifacts>/requirements.md
context.md:      <artifacts>/context.md
plan.md:         <artifacts>/plan.md
Start from the plan's `## Handoff to worker` section, then <W1>. Work the items in plan
order; keep each item independently verifiable.
Do not add behavior, refactor outside the plan, or change accepted requirements. If the
plan is wrong or needs an unapproved decision, stop and ask through contact_supervisor
instead of deciding.
Run the plan's validation commands as you go. Report: changed files, commands run with
exit codes, validation evidence, deviations, and anything left undone.
Write your handoff to: <artifacts>/implementation.md
```

While it runs, do your own narrow read of the files the plan touches so you can judge the
diff later. Relay any `need_decision` to the operator verbatim; do not pre-approve a plan
deviation.

When it returns:

1. Read the handoff and confirm the claimed edits exist (`git status`, `git diff --stat`).
   A success summary with no edits is a failure, not a completion.
2. Run the repository's validation commands yourself, or confirm the worker's recorded exit
   codes on the current tree. Write commands, exit status, and the output tail to
   `<artifacts>/validation-r0.md`.
3. Record baseline vs current diff in `run.md`. Then start review.

## 6. Stage 5 — reviewer loop

Default cap: 3 rounds. A round is one batch of fresh reviewers inspecting the current
diff, followed by synthesis and at most one fix worker.

For each round `r`:

### 6.1 Launch fresh reviewers in parallel

Fresh context, never forked. `reviewer` has no shell: it inspects files and
`watchdog_diff`, and names any command the parent must run. Set
`output: <artifacts>/review-r<r>-<angle>.md` on every reviewer launch; without it the review
only exists as chat text. `watchdog_diff` covers this session's changes only, so for a
resumed run or `--review-only` generate `git diff <baseline> > <artifacts>/diff-r<r>.patch`
and give each reviewer that path. For a `--review-only` run with no `requirements.md` or
`plan.md`, replace those lines with the original request and the stated diff scope; do not
invent requirements. Choose 3 angles from the actual change, 4 at most:

1. **Correctness and regressions** — does the diff satisfy the requirement IDs it claims,
   preserve existing behavior, and handle the edge cases in `requirements.md`?
2. **Tests and validation** — are assertions meaningful, do they exercise the change, is
   the recorded validation sufficient, what is untested?
3. **Simplicity and maintainability** — duplication, dead code, single-use wrappers,
   scope creep, naming, fit with existing patterns.
4. Add when relevant: **security and data safety** (auth, input, secrets, persistence,
   network), **API and compatibility** (public surface, migration, config), **UX and
   accessibility**, **performance**.

Reviewer task text (one per angle):

```text
You are a fresh-context reviewer, run <RUN_ID>, round <r>, angle: <angle>.
Baseline commit: <sha>. Change scope: <paths/areas> — treat anything outside it as
scope creep. Inspect the repository and the current diff yourself (`watchdog_diff` plus
reading the touched files); do not rely on any chat history.
requirements.md: <artifacts>/requirements.md
plan.md:         <artifacts>/plan.md
implementation:  <artifacts>/implementation.md
parent validation: <artifacts>/validation-r<r-1>.md
Do not edit files and do not run subagents. You have no shell; list any command the
parent must run instead of claiming it passed.
Filter on evidence, not severity: report only concrete, current issues in this change
surface, each with file:line, the requirement ID it violates, and the smallest fix.
Label P0 (blocks merge) / P1 (fix before release) / P2 (report only). Ignore style
preferences and issues this diff did not cause. If nothing qualifies, say exactly:
No issues found.
End with: Merge verdict: BLOCK | OK with notes | OK
```

### 6.2 Synthesize

Read every review, then write `<artifacts>/fixes-r<r>.md`:

- **Accepted now** — P0/P1 items worth fixing in this loop, with the requirement ID and the
  smallest fix. Deduplicate overlapping findings and keep the strongest evidence.
- **Deferred** — P2 or optional items, each with a one-line reason.
- **Rejected** — findings contradicted by the code, out of scope, or speculative, with the
  reason.
- **Needs operator** — anything that is a product, scope, architecture, or compatibility
  decision, or would change an accepted requirement.

Do not apply every suggestion. Do not treat reviewer prose as authority: verify a claimed
finding in the code before accepting it.

### 6.3 Fix and re-review

If `Accepted now` is non-empty and the run is implementation-authorized:

1. Launch one fix `worker` (fresh, no hard caps) with `fixes-r<r>.md` as its contract:
   apply only those fixes, preserve scope, rerun the named validation, report changed
   files and exit codes, update `<artifacts>/implementation.md`.
2. Run or confirm validation yourself; write `<artifacts>/validation-r<r>.md`.
3. If the fix was small and local, run one **targeted re-review** instead of a full round:
   ask only whether the named finding is resolved, whether the fix introduced a new defect
   in its blast radius, and whether earlier P1/P2 notes still stand. If the fix was
   material, run a full fresh round.
4. A fix worker pass does not reset the round counter.

### 6.4 Stop

Stop the loop when any of these holds:

- no P0 and no P1 worth fixing now remain, and remaining notes are deferred with reasons;
- reviewers surfaced an unapproved decision that needs the operator;
- the round cap is reached;
- the change is being rewritten faster than it is being reviewed (two rounds with
  overlapping findings and no net reduction) — report why instead of looping.

Never stop just because reviewers are quiet on a diff you have not inspected yourself.

## 7. Stage 6 — close

1. Inspect the final diff yourself. Confirm it matches the approved plan, that scope creep
   is absent, and that untracked artifacts are not mixed into the change.
2. Run the final validation, or record exactly which command could not be run and why.
3. Write `<artifacts>/summary.md`:

```markdown
# Summary: <task>
## Outcome
## Requirements covered (FR/NFR → evidence)
## Changes (files, behavior)
## Validation (commands, exit status)
## Review rounds (what each round found and what was fixed)
## Deferred / rejected findings (with reasons)
## Risks and open items
## Operator decisions taken
## Artifacts
```

4. Do not commit, push, open a PR, or migrate anything unless the operator asked. If they
   did, record the resulting commit/PR reference.

## Escalation matrix

| Situation | Action |
|---|---|
| Clarify cannot converge | Stop with open questions listed; do not implement a guess. |
| Requirements contradict the code | Operator decision with both sides named; one re-clarify round maximum. |
| Scout finds no code surface for a requirement | Report to the operator; it likely means the requirement is new construction and changes scope. |
| Planner reports a blocked decision | Operator gate before implementation. |
| Worker deviates from the plan | Stop the deviation; either re-gate or revert it. |
| Worker fails or stalls | Inspect status, report the failure; a same-scope retry with a narrower slice is allowed once, then stop. |
| Reviewer infrastructure failure | Report it; never treat a missing review as approval. |
| Validation was already red before the run | Record the baseline and do not blame the diff; state which failures pre-date it. |
| Operator becomes unavailable at a gate | Stop the run at that gate with the artifacts intact; do not self-approve. |

## Final response

Report, in this order and without filler:

- what shipped and whether it is ready to merge, with the merge verdict from the last
  review round;
- the gates the operator passed and any assumption recorded on their behalf;
- validation commands and results;
- review rounds and the fixes each produced;
- deferred findings and remaining risks;
- artifact directory path and the key files (`requirements.md`, `research.md`,
  `context.md`, `plan.md`, `implementation.md`, `review-r*.md`, `fixes-r*.md`,
  `validation-r*.md`, `summary.md`, `run.md`);
- the single next step that would close the run (commit, PR, follow-up round, operator
  decision).

---

Task and flags:

$@
