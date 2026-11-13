---
description: Analyze the working tree, write one honest commit message, and commit
argument-hint: "[hint] [--staged] [--scope=<path>] [--split] [--lang=auto|en|zh] [--dry-run]"
---

Analyze the actual change, compose a commit message that explains *why*, and commit
once. You are the only actor; this task does not need subagents.

Invocation (optional hint, never a substitute for reading the diff):

$@

## Flags

- `--staged` — commit only what is already staged, even if nothing else is dirty.
- `--scope=<path>` — restrict inspection, staging, and the commit to this path.
- `--split` — allow more than one commit (default: exactly one).
- `--lang=auto|en|zh` — subject/body language. Default `auto`.
- `--dry-run` — print the message and the exact commands, commit nothing.

Never push, amend, rebase, reset, stash, force-add, or run with `--no-verify` unless the
invocation says so explicitly. Do not change source files to "prepare" a commit.

## 1. Inspect

```bash
git rev-parse --show-toplevel
git status --porcelain=v1 -b
git diff --cached --stat
git diff --stat
git diff --cached
git diff
git log -20 --format='%h%x09%s'
```

Then read what the diff cannot tell you: new files, renames, migrations, lockfiles,
generated artifacts, config/CI changes. Read the changed files when a hunk's intent is
unclear; a subject written from `--stat` alone is a guess.

Note the shape before writing anything: how many concerns, which layers (source, tests,
docs, config), and whether the change is a feature, fix, refactor, perf, build, or chore.

## 2. Decide the commit set

Default: exactly one commit containing everything that is dirty under the scope.

- Anything staged means the user already chose the set: commit the index only, and report
  the rest as not committed.
- Otherwise stage by explicit path (`git add <paths>`, `git add -u` for tracked
  modifications), never `git add -A` / `git add .` while untracked suspicious paths exist.
- If the change clearly holds two or more unrelated concerns (for example a refactor plus
  an unrelated fix), do not paper over it with a vague subject: propose a split and its
  message set, and ask. Split only when `--split` is set.
- Excluded by default, called out in the report instead of committed silently: secrets and
  `.env*`, credentials, keys, dumps, build output, editor cruft, and anything the repo
  `.gitignore`s. Use `git add -f` only when the user says so.
- If the index and worktree are both clean, stop and say so. Do not create an empty commit.

## 3. Guardrails — stop and report instead of committing

- Merge or rebase in progress, unresolved conflict markers, or a detached HEAD.
- Staged content that looks like a credential: private keys, `token=`, `secret=`,
  `password=`, `BEGIN * PRIVATE KEY`, `.env` values, long high-entropy strings.
- A file over ~5 MB or a binary blob being added without an obvious reason.
- The diff contradicts the hint you were given. Say what you found and ask.
- Pre-existing test, lint, or build failures. Report them; do not "fix" them in this commit.

Do not run the full test suite. Run a fast, already-configured check only when the change
touches its surface and can finish quickly; otherwise state that validation was not run.

## 4. Compose the message

Precedence for convention and language: repo instructions (`CONTRIBUTING.md`, `AGENTS.md`,
`CLAUDE.md`, `.gitmessage`) → the existing `git log` style → Conventional Commits.

Shape:

```text
<type>(<scope>): <subject in imperative mood, no trailing period, ≤ 72 chars>

<body: why this change was needed, what behavior changed, and what a reviewer
must not miss. Wrap at 72 columns. Plain prose or 2-4 short bullets. No
"this commit", no "I", no restating the diff file by file, no filler.>

<footer: Refs: #123 / BREAKING CHANGE: <migration> — only when true>
```

Rules:
- `type` ∈ feat, fix, refactor, perf, test, docs, build, ci, chore, revert — only when the
  repo's log supports the convention; otherwise match the log's plain style.
- Subject states the effect, not the mechanics: `fix(auth): stop dropping session cookies
  on refresh`, not `update auth.js` or `fix bug`.
- Body explains the *why* and the risk. Omit it when the subject truly says everything.
- One message per commit; no emoji unless the log already uses them; no `Co-authored-by`
  or generated-by trailers unless the repo already has them.
- `--lang=auto`: match the language of the recent log; English when it is mixed or empty.

## 5. Commit

Pass the message on stdin so shell quoting cannot mangle it:

```bash
git commit -F - <<'MSG'
<subject>

<body>
MSG
```

Then confirm with `git show --stat --oneline HEAD` and `git status --short`.

## 6. Report

Short and factual:

- the full message as committed;
- files and concerns included; anything left uncommitted and why;
- the convention and language you matched, and the evidence (a log line or the repo doc);
- any validation run or deliberately skipped, plus pre-existing failures;
- the next step, only if the user asked for one (for example pushing).

## Failure handling

- Hook or signing failure: report the exact output. Do not retry with `--no-verify`; fix
  only if the failure is caused by the change itself, otherwise stop and ask.
- Commit created but you now doubt the message: do not amend silently — offer the corrected
  message and the `git commit --amend` command.
- Anything unexpected (unexpected index content, files changed mid-run): stop, report, and
  let the user decide.
