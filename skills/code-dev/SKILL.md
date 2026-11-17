---
name: code-dev
description: |
  Guides software changes end to end: clarifying the requirement, exploring the repository, planning, implementing, verifying, self-reviewing the diff, and handing off.
  Use for new project setup or scaffolding, feature implementation, bug fixes, failing tests, refactors, dependency or configuration upgrades, API/schema migrations, and validating your own work — including when the request looks small enough to just do by hand.
---

# Software Development Lifecycle

Take a change from an unclear request to a verified, reviewable result. Two things decide the quality here: understanding the problem before writing code, and producing evidence that the behavior actually works. Everything else in this skill is scaffolding around those two.

Adapt depth to size and risk, but understanding and verification never drop to zero.

## Scale the process to the change

| Size | Typical work | Stages | Minimum evidence before you report done |
| --- | --- | --- | --- |
| **Trivial** | typo, comment, one-line config, dev-tool bump | Orient → Brief design and confirm → Implement → Verify | You read the file you touched and the nearest existing check, or can say why none applies |
| **Small** | single-function bug, small feature, localized refactor | All stages; a 2–4 sentence plan in the message is enough | Focused test for the changed behavior, plus lint/type-check |
| **Feature** | new module, new endpoint, cross-file change | All stages with a written design and user confirmation before coding | New tests for new behavior, relevant suite green, docs updated |
| **Risky** | data/schema migration, auth or security, public API, concurrency, release path | All stages + rollback plan + user sign-off on the design | Suites green, at least one end-to-end/manual run, rollback stated |

If you are unsure which row you are in, pick the row above your guess.

## Principles

- **Solve the stated problem.** The requested outcome, not the code you want to write, is the target.
- **Inspect before changing.** Repo instructions, existing patterns, and adjacent tests outrank your assumptions about how the project works.
- **Smallest coherent change.** Unrelated cleanup makes review harder and regressions harder to attribute.
- **Prove behavior, not compilation.** A build passing is not evidence the feature works.
- **Never fake a check.** "Tests pass" is a claim about commands you actually ran and read.
- **Preserve user work.** Understand the working tree before you touch it; never revert changes you did not make.
- **Behavior change implies doc change.** A doc that describes the old behavior is a defect shipped with your change.
- **Say what happened.** Decisions, outcomes, skipped checks, and remaining risk belong in the final message.

## Workflow

### 1. Pin the requirement

Restate the problem, who or what it affects, and what observable behavior signals success. Write acceptance criteria as statements you could test:

> "Uploading a 6 MB PDF returns 201 and stores one row." — testable.
> "Uploads work better." — not testable; go ask.

Ask only questions whose answers change what you build. Fewer, sharper questions beat a questionnaire; when an ambiguity is low-risk, state your assumption alongside the plan so the user can correct it instead of being quizzed.

If the request is open-ended ("refactor this", "make it better"), inspect first, then present the top 1–3 concrete issues with file/line evidence and let the user choose what to take on.

**Done when:** acceptance criteria exist and remaining open questions are named.

### 2. Orient in the repository

1. `git status --short` and the current branch — know what was already in flight before you started.
2. Read the doc layer: `README`, `CONTRIBUTING`, `docs/`, and any ADRs relevant to the area.
3. Find how the project is built and checked, from the project itself — CI config (`.github/workflows`, `.gitlab-ci.yml`), `Makefile`/`justfile`, `package.json` scripts, `pyproject.toml`/`tox.ini`, `Cargo.toml`, `go.mod`. Prefer documented commands over inventing your own.
4. Locate the entry points, the adjacent tests, and existing helpers you should reuse. Search with `rg` instead of reading whole trees.
5. Trace only the code paths the change actually touches.

If the code contradicts the docs, the code and its tests are the evidence — and the stale doc is now part of your task.

**Done when:** you can name the files you will change and the exact commands that will prove the change.

### 3. Plan the change

Decide the approach before editing. Cover, in proportion to risk:

- Components, APIs, data, and callers affected
- Compatibility, migration, rollback, and failure behavior
- Security, privacy, performance, concurrency where relevant
- The tests or other checks that will demonstrate each acceptance criterion
- Documentation or examples that must change with the behavior

For anything multi-step or risky, state the plan in the conversation before implementing. Ask the user to choose only between materially different approaches with real trade-offs — not to rubber-stamp the obvious one.

Before implementing any change, present the proposed design to the user and wait for their explicit confirmation. Scale the detail to the change; cover the goal and scope, approach, affected components, important trade-offs, and how it will be verified. Do not treat silence or an unrelated response as approval.

If the user disagrees or requests changes, revise the design and ask for confirmation again. Repeat this review-and-adjust cycle until you and the user agree; do not begin implementation in the meantime.

For complex changes, write a design document or ADR to make the proposal easier to review. Keep simple changes in the conversation rather than creating unnecessary documentation.

**Done when:** scope, approach, and verification are decided, and a reviewer could predict the diff.

### 4. Implement (after user confirmation)

- Match local naming, formatting, typing, error-handling, and layering. A change that reads as foreign costs review time even when it works.
- Reuse existing helpers and dependencies. Add an abstraction or a package only when it earns its maintenance cost, and say why.
- Handle invalid input, error paths, resource cleanup, cancellation, and boundary conditions explicitly. No silent fallbacks that turn a failure into a wrong answer.
- Add or update tests in the same change as the behavior — tests written "later" are usually never written.
- Track which docs, examples, help text, and changelog entries the change invalidates. Step 7 updates them once the behavior is verified and reviewed, so you document the final shape instead of a moving target.
- Leave no debug prints, commented-out code, TODOs without owners, disabled linters, or unrelated reformatting in the diff.
- Do not expand scope silently. Note unrelated problems you spot and report them instead of fixing them.

**Fixing a bug — run this loop, do not shortcut it:**

1. **Reproduce.** Get a failing test, command, or script that fails for the stated reason. If you cannot reproduce it, say so before changing code.
2. **Confirm the cause.** Verify the failure comes from the mechanism you think it does, not from a nearby issue in the same area.
3. **Fix minimally.** Correct the cause, not the symptom, and not the assertion. If the test's expectation was genuinely wrong, fix the test deliberately and explain why.
4. **Guard.** Keep the reproduction as a regression test where the project's test layout allows it.
5. **Prove fail → pass.** Show the check failing before the fix and passing after, with the same command.

If implementation reveals a requirement or design problem, go back to steps 1–3. Do not layer a speculative workaround on a design that no longer fits.

### 5. Verify

Run checks in this order and stop escalating once risk is covered:

1. The focused test(s) for the changed behavior, including the edge cases you identified.
2. The project's lint, format check, and type-check.
3. The broader relevant suite — reproduce how CI runs it rather than a hand-assembled command.
4. Manual or end-to-end confirmation when the behavior is user-facing or the suite does not cover it.

Read the output. A green summary over a skipped or filtered run is not evidence. When something fails, separate failures your change caused from failures already present: check the baseline with `git stash` (or the untouched branch) before blaming either side, and never hide a pre-existing failure inside your change.

**Report exactly:** each command, whether it ran, and its outcome. If a check could not run, say why and name the risk that leaves open.

### 6. Review your own diff

Read `git diff` as if someone else wrote it, then check:

- Does every hunk serve the request? Any stray file, generated artifact, or formatting churn in `git status`?
- Are control flow, edge cases, errors, and cleanup correct on the failure paths, not just the happy path?
- Do the tests actually fail if the behavior breaks, and do they avoid asserting implementation details?
- Which docs does this change prove wrong? List them for step 7 rather than documenting half-reviewed behavior now.
- Any security, privacy, performance, concurrency, or resource-lifecycle regression?

For anything non-trivial, run the review checklist in the `code-review` skill. Fix problems your change introduced; leave unrelated pre-existing problems alone unless they block the work.

### 7. Keep documentation in sync

Do this after the diff is verified and reviewed: you then document the behavior that actually shipped, not a shape still in motion. It stays inside the change — "documentation later" means never, and a doc describing the old behavior is a defect you ship alongside the fix.

| If the change... | Also update |
| --- | --- |
| adds or alters user-visible behavior | the README section, user guide, or feature doc that describes it |
| renames or changes a flag, command, endpoint, config key, or env var | CLI `--help`, reference tables, example commands, sample configs |
| changes a signature, module boundary, or public API | docstrings/type docs, API reference, code examples |
| adds a dependency, tool, or required environment | install, setup, and onboarding docs |
| changes architecture or makes a decision with trade-offs | the `docs/` design note or ADR, including the alternatives rejected |
| deprecates or breaks something | changelog entry, migration note, upgrade guide |

Rules:

- Prefer editing the doc that already owns the topic; if none does, put it where a reader would look first (README section, `docs/`, module docstring) and say where you put it.
- Update the whole affected passage, not just the line you touched — counts, ordering, defaults, constraints, and "not yet supported" claims must all still hold.
- Delete stale statements the change invalidates. Leaving a contradicting doc in place because nobody asked is how docs rot.
- Write comments and docstrings for contracts and reasons, not as a narration of the diff.
- Follow the project's changelog and versioning conventions (`git-workflow-and-versioning`).

Verify documentation with checks you can actually run:

- `rg` the old name, removed flag, or moved path across docs and examples — zero hits, unless the mention is deliberately historical (changelog, migration note).
- Run the commands, snippets, and config examples the docs show; an example that no longer runs is a broken doc.
- Confirm links and paths resolve, and that documented defaults match the code.

**Done when:** every doc touching the changed behavior is updated or confirmed still true.

### 8. Hand off

Commits, branches, PRs, and release steps follow the `git-workflow-and-versioning` skill. Do not commit, push, deploy, migrate production data, or perform destructive operations unless the user asked or the task clearly authorizes it.

End with this summary:

```
**Changed:** <areas/files> — <what behaves differently now>
**Checks:** `<command>` → <pass/fail/counts>
**Not run:** <checks skipped, and why>
**Risks/limits:** <known gaps, follow-ups>
**Next:** <review, merge, deploy, or the question you need answered>
```

## Anti-patterns

- Editing before orienting, then discovering the repo already had a helper for this.
- Guessing at build/test commands instead of reading the manifest or CI config.
- Fixing a bug without a reproduction, so you cannot tell whether it is fixed.
- Weakening or deleting a failing assertion to get green.
- "Refactoring while I'm here" that buries the real change.
- Shipping behavior the docs now describe incorrectly, or documenting a feature the code does not have.
- Reporting checks as passed when they were skipped, filtered, or never run.
- Declaring done with an unread diff.

## Definition of done

- Acceptance criteria are met, and you can point at the evidence for each.
- The diff is scoped, conventional, and reviewed by you first.
- Relevant tests and checks ran; results and gaps are reported accurately.
- Documentation describing the changed behavior is updated or confirmed still true, and its examples still run.
- Risks, limitations, and follow-up work are stated in the handoff.
