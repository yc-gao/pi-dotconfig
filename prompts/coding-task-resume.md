---
description: Resume a coding-cycle run from its artifacts, without redoing finished stages
argument-hint: "<artifact directory or RUN_ID> [note about what changed]"
---

Continue an existing coding-cycle run from where it stopped. Do not restart it, and do not
rebuild state from memory: the run's artifact directory is the state.

The artifact directory or run id, plus any note about what changed, is at the end.

## 1. Load the run

1. Resolve the artifact directory: use the given path, or `<repo>/.pi/coding-task/<RUN_ID>/`.
2. Read `run.md` first (stage ledger, baseline commit, gates, validation commands), then
   `summary.md` if it exists, then the stage files present:
   `requirements.md`, `research.md`, `context.md`, `plan.md`, `implementation.md`,
   `fixes-r*.md`, `validation-r*.md`.
   Each artifact must still honor the contract its stage owes the next one:
   `requirements.md` carries `## Recon brief for scout` (and `## Research brief for
   researcher` when external questions exist) before stage 2 can start, and `plan.md`
   carries `## Handoff to worker` before stage 4 can start. A missing section means that
   stage is incomplete, not that it is done.
3. Establish what actually happened, not just what was recorded:
   - `git status --short`, `git log --oneline <baseline>..HEAD`, `git diff --stat <baseline>`.
   - Compare the current tree against the implementation handoff and validation files.
   - Run the recorded validation commands from `run.md` and compare with the last recorded
     result.
4. Report a three-line assessment before acting: last completed stage, worktree state, and
   whether recorded evidence still matches the tree.

## 2. Decide the entry point

| Evidence | Resume at |
|---|---|
| No `requirements.md`, or it is a draft with open blocking questions | clarify (Stage 1) |
| Requirements approved, no `context.md` | recon/research (Stage 2) |
| `context.md` (and `research.md` when required) present, no `plan.md` | plan (Stage 3) |
| `plan.md` approved, no implementation evidence or the handoff does not match the tree | implement (Stage 4) |
| Implementation present, last review round has open P0/P1 or no review yet | reviewer loop (Stage 5) |
| Loop stopped clean or capped | close (Stage 6) — verify, then report |

Rules:

- A stage that already produced an accepted artifact is not rerun. Re-open it only when
  the tree contradicts the artifact, the operator says the inputs changed, or the artifact
  fails a check you can state in one sentence.
- Gates already passed stay passed. Record the resume in `run.md` with the reason and the
  new stage.
- If requirements were amended since the last gate, that is a new requirements revision:
  re-gate, and re-run planner plus any stage whose input changed.
- If the tree changed outside the plan's touch set since the last review, treat the current
  diff as unreviewed and run a full review round even if the previous round was clean.
- `watchdog_diff` only covers the current session, so reviewers in a resumed run must be
  given an explicit `git diff <baseline> > <artifacts>/diff-r<n>.patch` path instead of
  relying on it. Regenerate the patch at every resumed round.

## 3. Continue the existing loop

Use the same stage contracts, artifact paths, reviewer angles, synthesis rules, and stop
conditions as the main coding-cycle prompt (`prompts/coding-task.md`); read it if this
session does not already have it. The launch text for each stage lives there too, and the
named sections one stage hands to the next are part of that text, so a stage you re-open
is re-launched from the prompt rather than reconstructed from memory. Specifically:

- The review-round cap is the one recorded in `run.md`, not a fresh 3.
- Continue appending to the same `fixes-r<n>.md` / `validation-r<n>.md` numbering; never
  overwrite an earlier round.
- Keep one writer. Do not launch a second writer alongside an unfinished one; inspect its
  status first or stop it.
- A run that stopped at a gate resumes at that gate with the same question. Do not
  self-approve it because time passed.
- A run that stopped because a child failed resumes with the same scope and a narrower
  slice; report the failure instead of pretending the retry is the first attempt.

## 4. Report

Same closing format as the main prompt, plus:

- what stage was resumed and why;
- which recorded evidence you re-verified and which you had to discard as stale;
- anything the previous run left ambiguous that you resolved by reading the code, and what
  you did not resolve.

---

Resume target and change note:

$@
