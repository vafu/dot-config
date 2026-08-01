#!/usr/bin/env bash
set -euo pipefail

"${HOME}/.local/bin/rsynapse-shell" request scheme-toggle >/dev/null
