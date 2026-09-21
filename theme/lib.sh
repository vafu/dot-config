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
