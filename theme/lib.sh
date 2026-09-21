# Shared helpers for the ~/.config/theme system.
# Surfaces source this via: . "$(dirname "$(dirname "$(readlink -f "$0")")")/lib.sh"
# (or via $THEME_ROOT/lib.sh when run through theme-set).

# theme_file <name> -> path to themes/<name>.toml
theme_file() {
  printf '%s/themes/%s.toml' "$THEME_ROOT" "$1"
}

# theme_val <section> <key> <file> -> value (expects key = "value" lines)
theme_val() {
  sed -n "/^\\[$1\\]/,/^\\[/p" "$3" \
    | sed -n "s/^$2 *= *\"\\(.*\\)\".*/\\1/p" \
    | head -n1
}

# Adw accent names (gsettings enum) -> palette table key.
# slate has its own neutral key (grey2 is purple-tinted in some families).
accent_key() {
  case "$1" in
    blue) printf 'accent_blue' ;;
    teal) printf 'accent_aqua' ;;
    green) printf 'accent_green' ;;
    yellow) printf 'accent_yellow' ;;
    orange) printf 'accent_orange' ;;
    red) printf 'accent_red' ;;
    pink | purple) printf 'accent_purple' ;;
    slate) printf 'slate' ;;
    *) return 1 ;;
  esac
}

# accent_hex <file> <mode> <name> -> hex from the family's [mode] table.
accent_hex() {
  local key
  key="$(accent_key "$3")" || return 1
  theme_val "$2" "$key" "$1"
}

# current_accent -> selected accent name (accent file or family default).
current_accent() {
  local root="${THEME_ROOT:-${XDG_CONFIG_HOME:-$HOME/.config}/theme}"
  if [[ -f "$root/accent" ]]; then
    cat "$root/accent"
  else
    theme_val family default_accent "$1"
  fi
}
# gio_dconf_env: make GSettings/dconf usable in minimal contexts (niri
# keybind spawns, systemd units). Two gaps vs interactive shells:
#  - XDG_DATA_DIRS may list system schemas first (or only), which can
#    predate keys like accent-color -> "No such key" failures.
#    Fixed by preferring the nix-profile schema dirs (same ones the
#    home-manager app wrappers use).
#  - GIO_EXTRA_MODULES may be empty, leaving nix gio with no dconf
#    backend -> silent MEMORY backend: every set exits 0 but writes
#    vanish with the process. Fixed by pointing at the nix dconf
#    gio modules.
# Everything is resolved by glob on each call: no store hashes or
# versions are pinned anywhere.
gio_dconf_env() {
  local d pre mod
  pre=""
  for d in "$HOME"/.nix-profile/share/gsettings-schemas/*/; do
    [[ -d "$d" ]] && pre="${pre:+$pre:}${d%/}"
  done
  [[ -n "$pre" ]] && export XDG_DATA_DIRS="$pre:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
  mod="$(ls -td /nix/store/*-dconf-*-lib/lib/gio/modules 2>/dev/null | head -n 1)"
  [[ -n "$mod" ]] && export GIO_EXTRA_MODULES="$mod${GIO_EXTRA_MODULES:+:$GIO_EXTRA_MODULES}"
  unset d pre mod
}
# pal_export <file> <mode> [prefix]: export every key in [mode] as UPPER
# (c0 -> C0, border_active -> BORDER_ACTIVE), optionally PREFIXED
# (prefix=ink -> INK_C0) so dark+light can coexist for envsubst.
pal_export() {
  local file="$1" mode="$2" prefix="${3:-}" line k v name
  while IFS= read -r line; do
    k="${line%%=*}"; k="${k// /}"
    [[ -n "$k" ]] || continue
    v="${line#*=}"; v="${v//\"/}"; v="${v// /}"
    name="${k^^}"
    [[ -n "$prefix" ]] && name="${prefix^^}_${name}"
    printf -v "$name" '%s' "$v"
    export "$name"
  done < <(sed -n "/^\\[${mode}\\]/,/^\\[/p" "$file" | grep -E '^[a-z0-9_]+ *= *"')
}
