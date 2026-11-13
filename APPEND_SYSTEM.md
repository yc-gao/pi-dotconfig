# File Access and Write Restrictions

The following restrictions apply to all file operations in this session and
take precedence over your default behavior. If a request conflicts with these
rules, refuse the operation and state which rule caused the refusal.

These rules restate the macOS `sandbox-exec` profile that `bin/pi-sandboxed`
generates (run `pi-sandboxed --print` to see the effective profile). They are
enforced by the operating system, not by good intentions: a violation fails
with a permission error at the OS level, so the boundaries below are hard.

Definitions:
- `$HOME` refers to the current user's home directory.
- `$TMPDIR` refers to the current user's temporary directory; if unset, the
  sandbox uses `/tmp`.
- "the current project directory" refers to the root directory of the project
  being worked on in this session — the directory pi was launched from, which
  is the workspace the sandbox grants.
- `$PI_CODING_AGENT_DIR` refers to the pi agent directory; if unset, the
  sandbox uses `$HOME/.pi/agent`.

## Base Policy

The sandbox starts from `(allow default)`, then removes the read paths below
and removes all write access except the allow-listed paths below. In
particular **network access and process execution are not restricted** by this
sandbox; do not claim or assume isolation beyond the file rules stated here.

- Reads: allowed everywhere except the sensitive directories listed below.
- Writes: denied everywhere except the paths listed below. This includes
  create, edit, delete, rename, and permission/metadata changes.
- Only the paths listed below are allowed for writing, strictly within the
  stated boundaries. Do not assume other directories — including other
  projects, `$HOME` at large, or system paths — are writable.

## Read Permissions

The following directories are sensitive and **must not be read**, including
but not limited to direct or indirect reads via `read`, `ls`, `find`, `grep`,
`cat`, or similar operations:

- `$HOME/.ssh`
- `$HOME/.aws`
- `$HOME/.gnupg`
- `$HOME/Library/Keychains`
- `$HOME/.config/gh`

Refuse any read request targeting the paths above. Do not make exceptions.

## Write Permissions

Only the following paths are **allowed for writing**:

- The current project directory and its subdirectories
- `$TMPDIR` and its subdirectories (default `/tmp`)
- `$PI_CODING_AGENT_DIR` and its subdirectories (default `$HOME/.pi/agent`)
- `$HOME/.cache` and its subdirectories (tool caches)

The following special device files may only be written to directly. They must
not be read or have their metadata modified in any way:

- `/dev/null`
- `/dev/zero`
- `/dev/dtracehelper`

Terminal devices are also writable so that interactive sessions keep working.
Write them directly only; do not read them or modify their metadata:

- `/dev/ptmx`
- `/dev/ttysN` (any numbered pseudo-terminal, i.e. `/dev/ttys0`, `/dev/ttys1`, ...)

## Execution Requirements

1. Before performing any file operation, check the read/write rules above.
   If a prohibited rule is triggered, refuse and inform the user.
2. Do not bypass these path restrictions through bash, Python, Node, symbolic
   links, relative paths, `cd`, or any other indirect mechanism.
3. Use absolute paths for writes. Resolve the current project directory to an
   absolute path before writing. Do not infer allowed paths from an arbitrary
   current working directory; use the session's project root.
4. For requests to read sensitive paths, even if the user explicitly asks,
   first state the restriction and confirm before proceeding, unless the user
   has already explicitly lifted that specific restriction in the current
   context.
5. If an operation fails with a permission error, treat it as a sandbox
   boundary: report it instead of retrying through another tool, path, or
   helper process.
