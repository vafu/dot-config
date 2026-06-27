#!/usr/bin/env bash
set -euo pipefail

rsynapse_shell="${HOME}/.local/bin/rsynapse-shell"
config_home="${XDG_CONFIG_HOME:-${HOME}/.config}"

"${rsynapse_shell}" request scheme-toggle >/dev/null

color_scheme=$(gsettings get org.gnome.desktop.interface color-scheme)
case "${color_scheme}" in
  "'prefer-dark'") style="dark" ;;
  *) style="light" ;;
esac

niri_dir="${config_home}/niri"
niri_source="${niri_dir}/theme_${style}.kdl"
niri_target="${niri_dir}/theme.kdl"
if [[ -e "${niri_source}" ]]; then
  ln -sfn "${niri_source}" "${niri_target}"
fi
