_locus_root() {
  print -r -- "${LOCUS_ROOT:-${XDG_RUNTIME_DIR:-/run/user/$UID}/locusfs}"
}

_locus_encode_segment() {
  jq -rn --arg value "$1" '$value | @uri'
}

_locus_safe_node_part() {
  print -r -- "$1" | tr -c '[:alnum:]_' '_'
}

_locus_selected_node() {
  local relative_path="$1"
  local kind="$2"
  local target
  target="$(readlink -f "$(_locus_root)/$relative_path" 2>/dev/null)" || return 1
  [[ -n "$target" ]] || return 1
  print -r -- "$kind:${target:t}"
}

locus_selected_window() {
  _locus_selected_node context/selected/window window
}

locus_selected_workspace() {
  _locus_selected_node context/selected/workspace workspace
}

locus_selected_project_path() {
  local property="$(_locus_root)/context/selected/workspace/project/path"
  local value
  [[ -r "$property" ]] || return 1
  IFS= read -r value < "$property" || return 1
  [[ -n "$value" ]] || return 1
  print -r -- "$value"
}

_locus_node_dir() {
  local subject="$1"
  local kind="${subject%%:*}"
  local local_id="${subject#*:}"
  [[ "$kind" != "$subject" && -n "$kind" && -n "$local_id" ]] || return 1
  print -r -- "$(_locus_root)/$(_locus_encode_segment "$kind")/$(_locus_encode_segment "$local_id")"
}

_locus_ensure_node() {
  local subject="$1"
  local root="$(_locus_root)"
  local kind="${subject%%:*}"
  local dir
  dir="$(_locus_node_dir "$subject")" || return 1
  mkdir "$root/$(_locus_encode_segment "$kind")" 2>/dev/null || true
  [[ -d "$dir" ]] || mkdir "$dir"
}

_locus_write_prop() {
  local subject="$1"
  local key="$2"
  local value="$3"
  local dir
  _locus_ensure_node "$subject" || return 1
  dir="$(_locus_node_dir "$subject")" || return 1
  print -r -- "$value" > "$dir/$(_locus_encode_segment "$key")"
}

_locus_wrap_app() {
  local app_name="$1"
  local app_icon="$2"
  shift 2
  if [[ "$1" == "--" ]]; then
    shift
  fi

  local selected_window selected_window_id app_part app_local app_node app_dir linked=0 command_status=0
  selected_window="$(locus_selected_window 2>/dev/null)"
  selected_window_id="${selected_window#window:}"
  app_part="$(_locus_safe_node_part "$app_name")"
  app_local="${app_part}_${$}_${RANDOM}"
  app_node="app-instance:${app_local}"

  if [[ "$selected_window" == window:* && -n "$1" && -n "$app_part" ]]; then
    app_dir="$(_locus_node_dir "$app_node")"
    if _locus_write_prop "$app_node" kind app-instance \
      && _locus_write_prop "$app_node" name "$app_name" \
      && _locus_write_prop "$app_node" icon "$app_icon"; then
      rm -f "$(_locus_root)/window/$(_locus_encode_segment "$selected_window_id")/app-instance" 2>/dev/null || true
      ln -s "../../app-instance/$(_locus_encode_segment "$app_local")" \
        "$(_locus_root)/window/$(_locus_encode_segment "$selected_window_id")/app-instance" \
        && linked=1
    fi
  fi

  {
    if (( linked )); then
      LOCUS_APP_INSTANCE="$app_node" AGENT_DBUS_WINDOW_ID="$selected_window_id" "$@"
    else
      "$@"
    fi
  } always {
    command_status=$?
    if (( linked )); then
      rm -f "$(_locus_root)/window/$(_locus_encode_segment "$selected_window_id")/app-instance" 2>/dev/null || true
      rmdir "$app_dir" >/dev/null 2>&1 || true
    fi
  }

  return $command_status
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
precmd_functions+=(_locus_precmd_project_workspace)
_locus_refresh_project_root >/dev/null 2>&1 || true
_locus_update_project_if_changed
