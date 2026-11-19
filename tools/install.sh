#!/usr/bin/env bash
set -Eeuo pipefail

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
readonly BIN_DIR="${HOME}/.local/bin"

readonly -a PACKAGES=(
	'npm:pi-web-access'  # Web search, content extraction, and video understanding for Pi agent
	'npm:pi-subagents'   # lets Pi delegate work to focused child agents
)

readonly -a AGENT_LINKS=(
	'web-search.json'
	'auth.json'
	'models.json'
	'APPEND_SYSTEM.md'
	'AGENTS.md'
	'extensions'
	'skills'
	'prompts'
	'agents'
)

die() {
	printf 'install.sh: %s\n' "$*" >&2
	exit 1
}

install_packages() {
	command -v pi >/dev/null 2>&1 || die 'cannot find pi; add pi to PATH'

	local package
	for package in "${PACKAGES[@]}"; do
		pi install "$package"
	done
}

link_agent_files() {
	mkdir -p "$AGENT_DIR"

	local name
	for name in "${AGENT_LINKS[@]}"; do
		[[ -e "$ROOT_DIR/$name" ]] || continue
		ln -sfn "$ROOT_DIR/$name" "$AGENT_DIR/$name"
	done
}

link_bin_files() {
	mkdir -p "$BIN_DIR"

	local source
	shopt -s nullglob
	for source in "$ROOT_DIR"/bin/*; do
		[[ -f "$source" ]] || continue
		ln -sfn "$source" "$BIN_DIR/$(basename "$source")"
	done
	shopt -u nullglob
}

main() {
	install_packages
	link_agent_files
	link_bin_files
}

main "$@"