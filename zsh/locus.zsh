typeset -g _LOCUS_BUS="${LOCUS_BUS:-org.rsynapse.Locus}"
typeset -g _LOCUS_PATH="/org/rsynapse/Locus"
typeset -g _LOCUS_INTERFACE="org.rsynapse.Locus.Relations1"
typeset -g _LOCUS_NIRI_BUS="${LOCUS_NIRI_BUS:-org.rsynapse.Niri}"
typeset -g _LOCUS_NIRI_PATH="/org/rsynapse/Niri"
typeset -g _LOCUS_NIRI_INTERFACE="org.rsynapse.Niri1"
typeset -g _LOCUS_WORKSPACE_PROJECT_RELATION="org.rsynapse.workspace.project"
typeset -g _LOCUS_WINDOW_APP_INSTANCE_RELATION="org.rsynapse.window.app-instance"

_locus_have() {
  command -v "$1" >/dev/null 2>&1
}

_locus_need_dbus_json() {
  _locus_have busctl && _locus_have jq
}

_locus_dbus_property() {
  local bus="$1"
  local path="$2"
  local interface="$3"
  local property="$4"
  _locus_need_dbus_json || return 1
  busctl --user --json=short get-property "$bus" "$path" "$interface" "$property" 2>/dev/null \
    | jq -r '.data[0] // empty'
}

_locus_dbus_call_json() {
  _locus_need_dbus_json || return 1
  busctl --user --json=short call "$_LOCUS_BUS" "$_LOCUS_PATH" "$_LOCUS_INTERFACE" "$@" 2>/dev/null
}

_locus_id_from_path() {
  local path="$1"
  local prefix="$2"
  local id
  [[ -n "$path" ]] || return 1
  id="${path:t}"
  id="${id#$prefix}"
  [[ "$id" == <-> ]] || return 1
  print -r -- "$id"
}

_locus_selected_workspace_id() {
  local path
  path="$(_locus_dbus_property "$_LOCUS_NIRI_BUS" "$_LOCUS_NIRI_PATH" "$_LOCUS_NIRI_INTERFACE" FocusedWorkspace)" || return 1
  _locus_id_from_path "$path" workspace_
}

_locus_selected_window_id() {
  local path
  if [[ "${NIRI_WINDOW_ID:-}" == <-> ]]; then
    print -r -- "$NIRI_WINDOW_ID"
    return 0
  fi
  if [[ "${LOCUS_TERMINAL_WINDOW_ID:-}" == <-> ]]; then
    print -r -- "$LOCUS_TERMINAL_WINDOW_ID"
    return 0
  fi
  path="$(_locus_dbus_property "$_LOCUS_NIRI_BUS" "$_LOCUS_NIRI_PATH" "$_LOCUS_NIRI_INTERFACE" FocusedWindow)" || return 1
  _locus_id_from_path "$path" window_
}

_locus_targets() {
  local subject="$1"
  local relation="$2"
  _locus_dbus_call_json Targets ss "$subject" "$relation" | jq -r '.data[0][]?'
}

locus_selected_workspace() {
  local id
  id="$(_locus_selected_workspace_id)" || return 1
  print -r -- "niri-workspace:$id"
}

locus_selected_window() {
  local id
  id="$(_locus_selected_window_id)" || return 1
  print -r -- "niri-window:$id"
}

locus_selected_project_target() {
  local subject
  subject="$(locus_selected_workspace)" || return 1
  _locus_targets "$subject" "$_LOCUS_WORKSPACE_PROJECT_RELATION" | head -n1
}

locus_selected_project_path() {
  local target path
  target="$(locus_selected_project_target)" || return 1
  [[ -n "$target" ]] || return 1
  case "$target" in
    project:*) path="${target#project:}" ;;
    *) path="$target" ;;
  esac
  [[ -d "$path" ]] || return 1
  print -r -- "$path"
}

_locus_random_token() {
  if _locus_have uuidgen; then
    uuidgen
  else
    print -r -- "$$-$EPOCHREALTIME-$RANDOM"
  fi
}

_locus_set_terminal_title() {
  local title="$1"
  printf '\033]2;%s\007' "$title" > /dev/tty 2>/dev/null
}

_locus_niri_window_id_for_title() {
  local title="$1"
  _locus_have niri && _locus_have jq || return 1
  niri msg --json windows 2>/dev/null \
    | jq -r --arg title "$title" '
        .[]
        | select((.app_id == "com.mitchellh.ghostty" or .app_id == "ghostty") and .title == $title)
        | .id
      ' \
    | head -n1
}

_locus_link_ghostty_window_async() {
  local window_id="$1"
  local ghostty_uuid="$2"
  [[ "$window_id" == <-> && -n "$ghostty_uuid" ]] || return 0
  _locus_need_dbus_json || return 0

  {
    busctl --user --json=short call \
      "$_LOCUS_BUS" "$_LOCUS_PATH" "$_LOCUS_INTERFACE" \
      SetOne a{ss}sa{ss}a{ss} \
      3 type stable-key kind org.rsynapse.niri.window.id id "$window_id" \
      "$_LOCUS_WINDOW_APP_INSTANCE_RELATION" \
      3 type stable-key kind org.rsynapse.app-instance.id id "$ghostty_uuid" \
      4 terminal ghostty shell zsh cwd "$PWD" pid "$$" \
      >/dev/null 2>&1 || true
  } &!
}

_locus_init_ghostty_window_title() {
  precmd_functions=("${(@)precmd_functions:#_locus_init_ghostty_window_title}")
  [[ -o interactive ]] || return 0
  [[ "${TERM_PROGRAM:-}" == ghostty ]] || return 0
  [[ -w /dev/tty ]] || return 0

  local token window_id deadline
  token="$(_locus_random_token)"
  _locus_set_terminal_title "$token" || return 0

  zmodload zsh/datetime 2>/dev/null || true
  deadline=$(( EPOCHREALTIME + 0.5 ))
  while (( EPOCHREALTIME < deadline )); do
    window_id="$(_locus_niri_window_id_for_title "$token")"
    [[ "$window_id" == <-> ]] && break
  done

  export GHOSTTY_UUID="$token"
  if [[ "$window_id" == <-> ]]; then
    export NIRI_WINDOW_ID="$window_id"
    export LOCUS_TERMINAL_WINDOW_ID="$window_id"
    export AGENT_DBUS_WINDOW="$window_id"
    _locus_link_ghostty_window_async "$window_id" "$token"
  fi
}

_locus_wrap_app() {
  local app_name="$1"
  local app_icon="$2"
  shift 2
  if [[ "${1:-}" == "--" ]]; then
    shift
  fi

  local selected_window_id
  selected_window_id="$(_locus_selected_window_id 2>/dev/null || true)"
  if [[ "$selected_window_id" == <-> ]]; then
    NIRI_WINDOW_ID="$selected_window_id" \
      LOCUS_TERMINAL_WINDOW_ID="$selected_window_id" \
      AGENT_DBUS_WINDOW="$selected_window_id" \
      "$@"
  else
    "$@"
  fi
}

codex() {
  local codex_bin
  codex_bin="$(whence -p codex)" || return 1
  _locus_wrap_app codex utilities-terminal -- "$codex_bin" "$@"
}

gemini() {
  local gemini_bin
  gemini_bin="$(whence -p gemini)" || return 1
  _locus_wrap_app gemini utilities-terminal -- "$gemini_bin" "$@"
}

nvim() {
  local nvim_bin
  nvim_bin="$(whence -p nvim)" || return 1
  _locus_wrap_app neovim "$HOME/.config/ags/assets/icons/Neovim.svg" -- "$nvim_bin" "$@"
}

zmodload -F zsh/stat b:zstat 2>/dev/null || true

_locus_project_root_for_pwd() {
  local dir="${PWD:A}"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/.project.json" ]]; then
      print -r -- "$dir"
      return 0
    fi
    dir="${dir:h}"
  done
  return 1
}

_locus_git_dir_for_root() {
  local root="$1" git_meta git_dir line
  git_meta="$root/.git"
  if [[ -f "$git_meta" ]]; then
    IFS= read -r line < "$git_meta" || return 0
    git_dir="${line#gitdir: }"
    [[ "$git_dir" = /* ]] || git_dir="$root/$git_dir"
  elif [[ -d "$git_meta" ]]; then
    git_dir="$git_meta"
  else
    return 0
  fi
  print -r -- "${git_dir:A}"
}

_locus_git_head_for_root() {
  local root="$1" git_dir head
  git_dir="$(_locus_git_dir_for_root "$root")"
  [[ -n "$git_dir" ]] || return 0
  head="$git_dir/HEAD"
  [[ -r "$head" ]] || return 0
  print -r -- "$head"
}

_locus_git_branch_for_root() {
  local root="$1" head line
  head="$(_locus_git_head_for_root "$root")"
  [[ -n "$head" ]] || return 0
  IFS= read -r line < "$head" || return 0
  if [[ "$line" == ref:\ refs/heads/* ]]; then
    print -r -- "${line#ref: refs/heads/}"
  fi
}

_locus_project_file_mtime() {
  local -A stat
  zstat -H stat "$1" 2>/dev/null || return 1
  print -r -- "${stat[mtime]}"
}

_locus_refresh_project_root() {
  _LOCUS_PROJECT_ROOT="$(_locus_project_root_for_pwd)" || {
    _LOCUS_PROJECT_ROOT="-"
    _LOCUS_PROJECT_UPDATE_STATE=""
    return 1
  }
}

_locus_update_project_if_changed() {
  local proj_bin root file branch head head_mtime mtime state selected_project_path
  proj_bin="$(whence -p proj 2>/dev/null)" || return 0
  [[ -x "$proj_bin" ]] || return 0
  root="$_LOCUS_PROJECT_ROOT"
  [[ -n "$root" && "$root" != "-" ]] || return 0
  selected_project_path="$(locus_selected_project_path 2>/dev/null || true)"
  [[ "$selected_project_path" == "$root" ]] || return 0
  file="$root/.project.json"
  branch="$(_locus_git_branch_for_root "$root")"
  head="$(_locus_git_head_for_root "$root")"
  head_mtime="$(_locus_project_file_mtime "$head" 2>/dev/null || true)"
  mtime="$(_locus_project_file_mtime "$file")" || return 0
  state="$root|$branch|$head_mtime|$mtime"
  [[ "$state" == "$_LOCUS_PROJECT_UPDATE_STATE" ]] && return 0
  _LOCUS_PROJECT_UPDATE_STATE="$state"
  "$proj_bin" update "$root" >/dev/null 2>&1 || true
}

_locus_chpwd_project_workspace() {
  _locus_refresh_project_root || return 0
}

_locus_precmd_project_workspace() {
  _locus_refresh_project_root >/dev/null 2>&1 || return 0
  _locus_update_project_if_changed
}

# Project binding is explicit: run `proj set_current` when assigning the
# selected workspace to a project. This hook only refreshes metadata for the
# current project after commands, so branch changes do not rebind workspaces.
typeset -g _LOCUS_PROJECT_ROOT=""
typeset -g _LOCUS_PROJECT_UPDATE_STATE=""
typeset -ga chpwd_functions
chpwd_functions=("${(@)chpwd_functions:#_locus_chpwd_project_window}")
chpwd_functions=("${(@)chpwd_functions:#_locus_chpwd_project_workspace}")
chpwd_functions=("${(@)chpwd_functions:#_locus_publish_project_if_changed}")
chpwd_functions=("${(@)chpwd_functions:#_locus_update_project_if_changed}")
chpwd_functions+=(_locus_chpwd_project_workspace)
typeset -ga precmd_functions
precmd_functions=("${(@)precmd_functions:#_locus_publish_project_if_changed}")
precmd_functions=("${(@)precmd_functions:#_locus_update_project_if_changed}")
precmd_functions=("${(@)precmd_functions:#_locus_precmd_project_workspace}")
precmd_functions=("${(@)precmd_functions:#_locus_init_ghostty_window_title}")
precmd_functions+=(_locus_precmd_project_workspace)
precmd_functions+=(_locus_init_ghostty_window_title)
_locus_refresh_project_root >/dev/null 2>&1 || true
_locus_update_project_if_changed
