#!/usr/bin/env bash
# Restore a trusted, self-created encrypted backup into a new directory only.
set -euo pipefail
umask 077
archive=$(realpath "${1:?请指定自己生成的备份文件}")
dest=$(realpath -m "${2:?请指定新的恢复目录}")
[[ ! -e "$dest" ]]
tmp=$(mktemp -d --tmpdir="$(dirname "$dest")")
trap 'rm -rf "$tmp"' EXIT
gpg --decrypt "$archive" | tar -xzf - --no-same-owner -C "$tmp"
[[ -f "$tmp/accounts.sqlite" && -d "$tmp/storage" ]]
mv -Tn "$tmp" "$dest"
[[ ! -d "$tmp" ]]
