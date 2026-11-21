#!/usr/bin/env bash
# Run after stopping the gateway and local Worker. Keep the destination outside the data directory.
set -euo pipefail
umask 077
data=$(realpath "${YANYUAN_DATA_DIR:-$HOME/.local/share/yanyuan-lan}")
dest=$(realpath -m "${1:?请指定新备份文件，例如 /backup/hezhi.tar.gz.gpg}")
[[ ! -e "$dest" && "$dest" != "$data/"* && -f "$data/accounts.sqlite" && -d "$data/storage" ]]
tmp=$(mktemp --tmpdir="$(dirname "$dest")")
trap 'rm -f "$tmp"' EXIT
tar -czf - -C "$data" . | gpg --symmetric --cipher-algo AES256 > "$tmp"
ln "$tmp" "$dest"
sha256sum "$dest"
