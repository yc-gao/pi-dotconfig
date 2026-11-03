---
description: End-to-end feature delivery chain — clarify, scout + researcher, planner, worker, reviewer
argument-hint: "<feature request> [--max-rounds N] [--plan-only] [--skip-clarify] [--isolate]"
---

Run a parent-orchestrated feature delivery chain for the request below. Keep the parent session as the controller, gate owner, and final decision-maker. Each child gets one concrete role-specific task; children must not orchestrate or launch subagents.

The chain is:

```text
clarify → [ scout ∥ researcher ] → planner → worker → reviewers → (fix worker → reviewers)*
```

## Ground rules

- Launch children async by default and consume each result only when a later step depends on it. Native completion wakes this session, so return control instead of sleeping or polling. Use `async: false` only when you must block and no child may need a decision — a child that needs a supervisor decision cannot reach you while you are blocked in that call.
- Default to fresh context for every child so each starts from its assigned brief and the artifacts on disk, not from the unfinished conversation. Forked context is the one exception: launch `clarify` with its forked default (do not force `fresh`), because it inherits the parent's intent; use forked context elsewhere only if I explicitly ask.
- Keep `clarify`, `planner`, and `reviewer` read-only with respect to the repository. They must not modify repository files: `clarify`/`planner` may write only their own artifacts, `reviewer` writes nothing, and `worker` is the only writer of repository files.
- One writer against the active worktree at a time. Only use `worktree: true` (or `--isolate`) for parallel slices that are independently deliverable.
- Do not set a hard `toolBudget` or tight `usageBudget` on workers. Give each writer a narrow delivery slice and an outer elapsed deadline with enough margin, and request a checkpoint after the current tool returns before that deadline. An elapsed timeout is not a mutation-safe boundary.
- Do not silently expand scope. Any unapproved product, scope, or architecture decision pauses the chain for me.

## Artifact routing (file-based handoff)

Children do not share files on disk implicitly. A relative `output` is nested under the run's own artifact directory, not the project cwd, and an agent's `defaultReads` resolves relative names against the child cwd and silently skips missing files. A handoff therefore works only when you make the path explicit:

- Put every handoff artifact under `<cwd>/.pi/artifacts/` (resolve `<cwd>` to the absolute project path) and add that directory to `.gitignore`.
- When launching a child whose result a later phase must read, pass an ABSOLUTE `output`, e.g. `output: "<cwd>/.pi/artifacts/context.md"`. Relative output paths do not land in the project tree.
- Pass that exact absolute path in the next child's task text. Do not rely on the agent's `defaultReads` filename convention.
- Before launching a phase, verify every artifact it consumes exists and is non-empty (`ls`/`read`), and record that check in your summary.
- Keep stale copies out of the project root so `defaultReads` cannot pick up an outdated file.
- Keep review children on `output: false` unless I ask for artifacts; when a scripted fix loop needs the findings on disk, write them to `<cwd>/.pi/artifacts/review-round<N>.md`.
- Under `--isolate`/parallel worktrees, handoff artifacts live outside the worktrees at one absolute path in the main cwd, because each lane's cwd and relative reads/outputs differ.

## Phase 0 — Clarify (gate)

Unless the invocation contains `--skip-clarify` and my request is already decision-ready, launch one async `clarify` with forked context and `output: "<cwd>/.pi/artifacts/clarify.md"`. It reads code and the web, writes a refined requirement brief plus open questions to that path, and may raise an interview request.

Relay unresolved questions to me through the interview/ask path and wait. Do not start scouting until the requirement is decision-ready or I explicitly tell you to proceed on the stated defaults. If `clarify` surfaces a decision that changes the design, data model, or scope, stop and ask instead of defaulting.

On `--skip-clarify`, write the decision-ready brief yourself to `<cwd>/.pi/artifacts/clarify.md` (or embed it in the Phase 1 tasks) so downstream children still have a brief. Carry that absolute path forward as the brief.

## Phase 1 — Reconcile (parallel, fresh)

Launch async `scout` and `researcher` in parallel and give each a distinct angle. Pass each the absolute brief path from Phase 0 (`<cwd>/.pi/artifacts/clarify.md`) in its task text, and set `output: "<cwd>/.pi/artifacts/context.md"` and `output: "<cwd>/.pi/artifacts/research.md"` respectively.

- `scout`: local files, entry points, key types/interfaces, data flow, existing patterns, constraints, tests, likely change seams. It writes `context.md` with exact paths and line ranges to the path you set.
- `researcher`: external docs, specs, APIs, versions, benchmarks, recent changes, and primary evidence. It writes `research.md` with sourced findings, contradictions, and gaps to the path you set.

Add a third angle when the feature is time-sensitive, security-relevant, or depends on a specific external API; otherwise two children are enough. Do not launch the planner until both return, both artifact files exist, and you have stated how their findings agree or conflict.

## Phase 2 — Plan (gate)

Launch async `planner` with fresh context and `output: "<cwd>/.pi/artifacts/plan.md"`. Give it the absolute paths `<cwd>/.pi/artifacts/context.md` and `<cwd>/.pi/artifacts/research.md` in its task; it reads both (read-only) and writes a concrete, ordered `plan.md` with files, validation, risks, and open decisions.

Present the plan and its open questions to me. Do not hand off to a worker until I approve the plan or explicitly authorize proceeding, and until any plan-blocking question is answered. If I pass `--plan-only`, stop here with the plan and its open questions.

## Phase 3 — Implement

Launch one async `worker` to implement the approved plan. Give it the absolute paths `<cwd>/.pi/artifacts/plan.md` and `<cwd>/.pi/artifacts/context.md` plus the named seams. It is the single writer of repository files. Tell it to stay within approved scope, follow existing patterns, validate as it goes, and report changed files, commands run with exit codes, validation evidence, surprises, and anything left undone.

If the worker surfaces a gap in the approved direction, it must escalate instead of deciding. Relay that decision to me before the chain continues.

## Phase 4 — Review (parallel, fresh)

When the worker's handoff arrives, treat it as the transition into review, not completion. Launch fresh-context `reviewer`s in parallel on the current diff. Pass each reviewer the absolute artifact paths (`<cwd>/.pi/artifacts/plan.md`, `<cwd>/.pi/artifacts/context.md`) and the diff scope in its task. Reviewers inspect the repository, relevant instructions, and diff directly; they must not rely on conversation history and must not edit files.

Choose angles from the actual change. Typical angles are correctness/regressions, tests/validation, and simplicity/maintainability; add security, performance, docs/API contracts, or user-flow validation when the work calls for it. Prefer three strong reviewers over many vague ones.

Tell reviewers to filter on evidence, not severity: report only concrete current issues caused or made reachable by the diff, with source proof or a repro, labeled P0/P1/P2, ending with `Merge verdict: BLOCK`, `Merge verdict: OK`, or `Merge verdict: OK with notes`. P0 blocks merge; P1 should be fixed before release; P2 is report-only.

## Phase 5 — Fix loop (cap 3 rounds unless `--max-rounds N`)

Synthesize reviewer feedback into:

- P0 blockers or scope/product/architecture decisions that need my approval;
- P1 fixes worth doing now;
- P2 report-only notes or optional improvements;
- feedback to ignore or defer, with a short reason.

Do not blindly apply every suggestion. If reviewers surface an unapproved decision, pause and ask me before launching a fix worker.

If you drive this loop from a script, persist the synthesized findings to `<cwd>/.pi/artifacts/review-round<N>.md` so the fix worker can read them; otherwise `output: false` is fine.

When there are fixes worth doing now and the chain is implementation-authorized, launch one async `worker` to apply only those synthesized fixes, preserving the approved scope. After it returns, run another review round only when it made material changes or addressed non-trivial findings — do not loop for optional polish or already-deferred findings.

For a targeted follow-up review, ask only three questions: whether the named finding was resolved, whether the fix introduced a new concrete defect in its blast radius, and whether prior P1/P2 notes still stand. Count a round each time fresh reviewers inspect the current diff after a worker pass.

Stop and summarize when one of these is true:

- reviewers find no P0 blockers and no P1 fixes worth doing now;
- remaining feedback is optional, speculative, or intentionally deferred;
- reviewers surface an unapproved decision that needs me;
- the round cap is reached.

## Completion

On completion, inspect the final diff yourself, run or confirm focused validation where appropriate, confirm the handoff artifacts under `<cwd>/.pi/artifacts/` are present, and summarize the chain: requirement, approved plan, files changed, validation evidence, rounds run, fixes applied, remaining deferred items, and why the chain stopped. Do not report success for a worker that made no edits when edits were expected.

## Optional scripted core

When the requirement is already decision-ready (for example after Phase 0 or `--skip-clarify`), the deterministic middle of the chain can run as one background workflow instead of separate child calls. Write this block verbatim in the same reply as the call, then launch it:

````js workflow
const dir = args.artifactsDir;
const recon = await runs.all([
  { key: "scout", label: "Map the local codebase", agent: "scout", output: `${dir}/context.md`, task: `Read ${dir}/clarify.md, then map the local codebase for this feature: entry points, key types/interfaces, data flow, likely change seams, tests, and constraints. Return exact paths and line ranges.` },
  { key: "research", label: "Gather external evidence", agent: "researcher", output: `${dir}/research.md`, task: `Read ${dir}/clarify.md, then gather external evidence for this feature: official docs, specs, APIs, versions, benchmarks, and recent changes. Return sourced findings, contradictions, and gaps.` }
]);
const plan = await runs.run("plan", {
  label: "Draft the implementation plan",
  agent: "planner",
  output: `${dir}/plan.md`,
  task: `Draft the implementation plan from ${dir}/context.md (local evidence) and ${dir}/research.md (external evidence).`
});
return {
  scout: recon[0].outputReference,
  research: recon[1].outputReference,
  plan: plan.outputReference
};
````

Launch it with `subagent({ workflow: true, async: true, args: { artifactsDir: "<cwd>/.pi/artifacts" } })` (pass the absolute artifact directory; the workflow script has no filesystem access) and treat the returned references as the Phase 1–2 artifacts, verifying `<cwd>/.pi/artifacts/plan.md` exists before Phase 3. Then continue with the Phase 3 worker and Phase 4–5 review loop as separate runs so each gate can pause for my decision.

Feature request, flags, or extra focus from the invocation:

$@
