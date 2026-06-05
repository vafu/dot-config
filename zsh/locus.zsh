[[ -r "$HOME/.config/locus/locus.sh" ]] && source "$HOME/.config/locus/locus.sh"

_locus_safe_node_part() {
  print -r -- "$1" | tr -c '[:alnum:]_' '_'
}

_locus_apply() {
  locusctl apply >/dev/null 2>&1
}

_locus_wrap_app() {
  local app_name="$1"
  local app_icon="$2"
  shift 2
  if [[ "$1" == "--" ]]; then
    shift
  fi

  local selected_window app_part app_node linked=0 command_status=0
  selected_window="$(locus_selected_window 2>/dev/null)"
  app_part="$(_locus_safe_node_part "$app_name")"
  app_node="app-instance:${app_part}/${$}-${RANDOM}"

  if [[ "$selected_window" == window:* && -n "$1" && -n "$app_part" ]]; then
    {
      print -r -- "set-property"$'\t'"$app_node"$'\t'"kind"$'\t'"app-instance"
      print -r -- "set-property"$'\t'"$app_node"$'\t'"name"$'\t'"$app_name"
      print -r -- "set-property"$'\t'"$app_node"$'\t'"icon"$'\t'"$app_icon"
      print -r -- "set-link"$'\t'"$selected_window"$'\t'"app-instance"$'\t'"$app_node"
    } | _locus_apply && linked=1
  fi

  {
    if (( linked )); then
      LOCUS_APP_INSTANCE="$app_node" AGENT_DBUS_WINDOW_ID="${selected_window#window:}" "$@"
    else
      "$@"
    fi
  } always {
    command_status=$?
    if (( linked )); then
      locusctl delete-node "$app_node" >/dev/null 2>&1 || true
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
  _locus_wrap_app neovim "$HOME/.config/ags/assets/icons/Neovim.svg" -- /usr/bin/nvim "$@"
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
    _LOCUS_PROJECT_PUBLISH_STATE=""
    return 1
  }
}

_locus_publish_project_if_changed() {
  [[ -x "$HOME/.config/scripts/proj" ]] || return 0
  local root file branch head head_mtime mtime state
  root="$_LOCUS_PROJECT_ROOT"
  [[ -n "$root" && "$root" != "-" ]] || return 0
  file="$root/.project.json"
  branch="$(_locus_git_branch_for_root "$root")"
  head="$(_locus_git_head_for_root "$root")"
  head_mtime="$(_locus_project_file_mtime "$head" 2>/dev/null || true)"
  mtime="$(_locus_project_file_mtime "$file")" || return 0
  state="$root|$branch|$head_mtime|$mtime"
  [[ "$state" == "$_LOCUS_PROJECT_PUBLISH_STATE" ]] && return 0
  _LOCUS_PROJECT_PUBLISH_STATE="$state"
  "$HOME/.config/scripts/proj" publish "$root" >/dev/null 2>&1 || true
}

_locus_chpwd_project_workspace() {
  _locus_refresh_project_root || return 0
  _locus_publish_project_if_changed
}

_locus_precmd_project_workspace() {
  if [[ -z "$_LOCUS_PROJECT_ROOT" ]]; then
    _locus_refresh_project_root >/dev/null 2>&1 || return 0
  fi
  _locus_publish_project_if_changed
}

typeset -g _LOCUS_PROJECT_ROOT=""
typeset -g _LOCUS_PROJECT_PUBLISH_STATE=""
typeset -ga chpwd_functions
chpwd_functions=("${(@)chpwd_functions:#_locus_chpwd_project_window}")
chpwd_functions=("${(@)chpwd_functions:#_locus_chpwd_project_workspace}")
chpwd_functions=("${(@)chpwd_functions:#_locus_publish_project_if_changed}")
chpwd_functions+=(_locus_chpwd_project_workspace)
typeset -ga precmd_functions
precmd_functions=("${(@)precmd_functions:#_locus_publish_project_if_changed}")
precmd_functions=("${(@)precmd_functions:#_locus_precmd_project_workspace}")
precmd_functions+=(_locus_precmd_project_workspace)
_locus_refresh_project_root >/dev/null 2>&1 || true
_locus_publish_project_if_changed
