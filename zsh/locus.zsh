typeset -g _LOCUS_BUS="${LOCUS_BUS:-org.rsynapse.Locus}"
typeset -g _LOCUS_PATH="/org/rsynapse/Locus"
typeset -g _LOCUS_INTERFACE="org.rsynapse.Locus.Relations1"
typeset -g _LOCUS_WORKSPACE_BUS="${LOCUS_WORKSPACE_BUS:-org.rsynapse.Workspace}"
typeset -g _LOCUS_WORKSPACE_PATH="/org/rsynapse/Workspace"
typeset -g _LOCUS_WORKSPACE_INTERFACE="org.rsynapse.Workspace.Manager1"
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
  local object_path="$2"
  local interface="$3"
  local property="$4"
  _locus_need_dbus_json || return 1
  busctl --user --json=short get-property "$bus" "$object_path" "$interface" "$property" 2>/dev/null \
    | jq -r '.data | if type == "array" then .[0] // empty else . end'
}

_locus_dbus_call_json() {
  _locus_need_dbus_json || return 1
  busctl --user --json=short call "$_LOCUS_BUS" "$_LOCUS_PATH" "$_LOCUS_INTERFACE" "$@" 2>/dev/null
}

_locus_selected_workspace_id() {
  local object_path
  object_path="$(_locus_dbus_property "$_LOCUS_WORKSPACE_BUS" "$_LOCUS_WORKSPACE_PATH" "$_LOCUS_WORKSPACE_INTERFACE" FocusedWorkspace)" || return 1
  [[ -n "$object_path" ]] || return 1
  _locus_dbus_property "$_LOCUS_WORKSPACE_BUS" "$object_path" org.rsynapse.Workspace.Workspace1 Id
}

_locus_selected_window_id() {
  local object_path
  _locus_terminal_window_id && return 0
  object_path="$(_locus_dbus_property "$_LOCUS_WORKSPACE_BUS" "$_LOCUS_WORKSPACE_PATH" "$_LOCUS_WORKSPACE_INTERFACE" FocusedWindow)" || return 1
  [[ -n "$object_path" ]] || return 1
  _locus_dbus_property "$_LOCUS_WORKSPACE_BUS" "$object_path" org.rsynapse.Workspace.Window1 Id
}

_locus_targets() {
  local subject="$1"
  local relation="$2"
  local kind id
  kind="$(jq -er '.kind' <<< "$subject")" || return 1
  id="$(jq -er '.id' <<< "$subject")" || return 1
  _locus_dbus_call_json Targets 'a{ss}s' 3 type stable-key kind "$kind" id "$id" "$relation" \
    | jq -c '.data[0][]?'
}

locus_selected_workspace() {
  local id
  id="$(_locus_selected_workspace_id)" || return 1
  jq -nc --arg id "$id" '{type:"stable-key",kind:"org.rsynapse.workspace.id",id:$id}'
}

locus_selected_window() {
  local id
  id="$(_locus_selected_window_id)" || return 1
  jq -nc --arg id "$id" '{type:"stable-key",kind:"org.rsynapse.window.id",id:$id}'
}

locus_selected_project_target() {
  local subject
  subject="$(locus_selected_workspace)" || return 1
  _locus_targets "$subject" "$_LOCUS_WORKSPACE_PROJECT_RELATION" | jq -sc '.[0] // empty'
}

locus_selected_project_path() {
  local target project_dir kind id
  target="$(locus_selected_project_target)" || return 1
  [[ -n "$target" ]] || return 1
  kind="$(jq -er '.kind' <<< "$target")" || return 1
  id="$(jq -er '.id' <<< "$target")" || return 1
  case "$kind" in
    org.rsynapse.project.path) project_dir="$id" ;;
    org.rsynapse.project.id)
      project_dir="$(proj project list --json | jq -r --arg id "$id" '.[] | select(.id == $id) | .cwd')" ;;
    *) return 1 ;;
  esac
  [[ -d "$project_dir" ]] || return 1
  print -r -- "$project_dir"
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

_locus_set_window_app_instance() {
  local window_id="$1"
  local ghostty_uuid="$2"
  local app_name="${3:-}"
  local app_icon="${4:-}"
  [[ -n "$window_id" && -n "$ghostty_uuid" ]] || return 0
  _locus_need_dbus_json || return 0

  local -a metadata
  metadata=(terminal ghostty shell zsh cwd "$PWD" pid "$$")
  if [[ -n "$app_name" ]]; then
    metadata+=(app-name "$app_name")
  fi
  if [[ -n "$app_icon" ]]; then
    metadata+=(app-icon "$app_icon")
  fi

  busctl --user --json=short call \
    "$_LOCUS_BUS" "$_LOCUS_PATH" "$_LOCUS_INTERFACE" \
    SetOne a{ss}sa{ss}a{ss} \
    3 type stable-key kind org.rsynapse.window.id id "$window_id" \
    "$_LOCUS_WINDOW_APP_INSTANCE_RELATION" \
    3 type stable-key kind org.rsynapse.app-instance.id id "$ghostty_uuid" \
    $(( ${#metadata} / 2 )) "${metadata[@]}" \
    >/dev/null 2>&1
}

_locus_link_ghostty_window_async() {
  local window_id="$1"
  local ghostty_uuid="$2"
  [[ -n "$window_id" && -n "$ghostty_uuid" ]] || return 0
  _locus_need_dbus_json || return 0

  {
    _locus_set_window_app_instance "$window_id" "$ghostty_uuid" || true
  } &!
}

_locus_init_ghostty_window_title() {
  precmd_functions=("${(@)precmd_functions:#_locus_init_ghostty_window_title}")
  [[ -o interactive ]] || return 0
  [[ "${TERM_PROGRAM:-}" == ghostty ]] || return 0
  [[ -w /dev/tty ]] || return 0

  # A new terminal must not inherit the parent terminal's ownership, including
  # when discovery is unavailable or fails.
  unset NIRI_WINDOW_ID LOCUS_TERMINAL_WINDOW_ID AGENT_DBUS_WINDOW AGENT_DBUS_WINDOW_ID
  _locus_have workspace-terminal-id || return 0
  local token window_id
  token="$(_locus_random_token)"
  window_id="$(workspace-terminal-id "$token" 2>/dev/null)"
  _locus_set_terminal_title "${PWD:t}"
  export GHOSTTY_UUID="$token"
  if [[ -n "$window_id" ]]; then
    export LOCUS_TERMINAL_WINDOW_ID="$window_id"
    export AGENT_DBUS_WINDOW="$window_id"
    _locus_link_ghostty_window_async "$window_id" "$token"
  fi
}

_locus_terminal_window_id() {
  if [[ -n "${LOCUS_TERMINAL_WINDOW_ID:-}" ]]; then
    print -r -- "$LOCUS_TERMINAL_WINDOW_ID"
    return 0
  fi
  if [[ -n "${AGENT_DBUS_WINDOW:-}" ]]; then
    print -r -- "$AGENT_DBUS_WINDOW"
    return 0
  fi
  if [[ -n "${NIRI_WINDOW_ID:-}" ]]; then
    print -r -- "$NIRI_WINDOW_ID"
    return 0
  fi
  return 1
}

_locus_wrap_app() {
  local app_name="$1"
  local app_icon="$2"
  shift 2
  if [[ "${1:-}" == "--" ]]; then
    shift
  fi

  local selected_window_id app_instance_id result
  selected_window_id="$(_locus_terminal_window_id 2>/dev/null || true)"
  app_instance_id="${GHOSTTY_UUID:-}"
  if [[ -n "$selected_window_id" ]]; then
    if [[ -n "$app_instance_id" ]]; then
      _locus_set_window_app_instance "$selected_window_id" "$app_instance_id" "$app_name" "$app_icon" || true
    fi
    LOCUS_TERMINAL_WINDOW_ID="$selected_window_id" \
      AGENT_DBUS_WINDOW="$selected_window_id" \
      "$@"
    result=$?
    if [[ -n "$app_instance_id" ]]; then
      _locus_set_window_app_instance "$selected_window_id" "$app_instance_id" || true
    fi
    return "$result"
  else
    "$@"
  fi
}

codex() {
  local codex_bin
  codex_bin="$(whence -p codex)" || return 1
  _locus_wrap_app codex utilities-terminal -- "$codex_bin" "$@"
}

opencode() {
  local opencode_bin
  opencode_bin="$(whence -p opencode)" || return 1
  _locus_wrap_app opencode utilities-terminal -- "$opencode_bin" "$@"
}

snapopencode() {
  local opencode_bin
  opencode_bin="$(whence -p snapopencode)" || return 1
  _locus_wrap_app opencode utilities-terminal -- "$opencode_bin" "$@"
}

gemini() {
  local gemini_bin
  gemini_bin="$(whence -p gemini)" || return 1
  _locus_wrap_app gemini utilities-terminal -- "$gemini_bin" "$@"
}

nvim() {
  local nvim_bin
  nvim_bin="$(whence -p nvim)" || return 1
  _locus_wrap_app neovim nvim -- "$nvim_bin" "$@"
}

zmodload -F zsh/stat b:zstat 2>/dev/null || true

_locus_project_root_for_pwd() {
  local root
  _locus_have git || return 1
  root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null)" || return 1
  print -r -- "${root:A}"
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
  local proj_bin root branch head head_mtime state
  proj_bin="$(whence -p proj 2>/dev/null)" || return 0
  [[ -x "$proj_bin" ]] || return 0
  root="$_LOCUS_PROJECT_ROOT"
  [[ -n "$root" && "$root" != "-" ]] || return 0
  branch="$(_locus_git_branch_for_root "$root")"
  head="$(_locus_git_head_for_root "$root")"
  head_mtime="$(_locus_project_file_mtime "$head" 2>/dev/null || true)"
  state="$root|$branch|$head_mtime"
  [[ "$state" == "$_LOCUS_PROJECT_UPDATE_STATE" ]] && return 0
  _LOCUS_PROJECT_UPDATE_STATE="$state"
  "$proj_bin" update "$root" >/dev/null 2>&1 || true
}

_locus_refresh_project_workspace_cwd() {
  local proj_bin root state
  proj_bin="$(whence -p proj 2>/dev/null)" || return 0
  [[ -x "$proj_bin" ]] || return 0
  root="$_LOCUS_PROJECT_ROOT"
  [[ -n "$root" && "$root" != "-" ]] || return 0
  state="$root|$PWD"
  [[ "$state" == "$_LOCUS_PROJECT_CWD_STATE" ]] && return 0
  _LOCUS_PROJECT_CWD_STATE="$state"
  "$proj_bin" refresh-current "$PWD" >/dev/null 2>&1 || true
}

_locus_chpwd_project_workspace() {
  _locus_refresh_project_root || return 0
  _locus_refresh_project_workspace_cwd
}

_locus_precmd_project_workspace() {
  _locus_refresh_project_root >/dev/null 2>&1 || return 0
  _locus_update_project_if_changed
  _locus_refresh_project_workspace_cwd
}

# Project binding is explicit: run `proj set_current` when assigning the
# selected workspace to a project. This hook only refreshes metadata for the
# current project after commands, so branch changes do not rebind workspaces.
typeset -g _LOCUS_PROJECT_ROOT=""
typeset -g _LOCUS_PROJECT_UPDATE_STATE=""
typeset -g _LOCUS_PROJECT_CWD_STATE=""
typeset -ga chpwd_functions
chpwd_functions=("${(@)chpwd_functions:#_locus_chpwd_project_window}")
chpwd_functions=("${(@)chpwd_functions:#_locus_chpwd_project_workspace}")
chpwd_functions=("${(@)chpwd_functions:#_locus_publish_project_if_changed}")
chpwd_functions=("${(@)chpwd_functions:#_locus_update_project_if_changed}")
chpwd_functions=("${(@)chpwd_functions:#_locus_refresh_project_workspace_cwd}")
chpwd_functions+=(_locus_chpwd_project_workspace)
typeset -ga precmd_functions
precmd_functions=("${(@)precmd_functions:#_locus_publish_project_if_changed}")
precmd_functions=("${(@)precmd_functions:#_locus_update_project_if_changed}")
precmd_functions=("${(@)precmd_functions:#_locus_refresh_project_workspace_cwd}")
precmd_functions=("${(@)precmd_functions:#_locus_precmd_project_workspace}")
precmd_functions=("${(@)precmd_functions:#_locus_init_ghostty_window_title}")
precmd_functions+=(_locus_precmd_project_workspace)
precmd_functions+=(_locus_init_ghostty_window_title)
_locus_refresh_project_root >/dev/null 2>&1 || true
_locus_update_project_if_changed
