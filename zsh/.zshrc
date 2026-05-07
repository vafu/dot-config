if [[ -o interactive ]]; then
  if (( ${+__ZSHRC_LOADED} || ${+functions[_zsh_autosuggest_start]} )); then
    return
  fi
  typeset -g __ZSHRC_LOADED=1
fi

# Remove older command from the history if a duplicate is to be added.
HISTFILE=$HOME/.zsh_history
setopt HIST_IGNORE_ALL_DUPS

# Set editor default keymap to emacs (`-e`) or vi (`-v`)
bindkey -v

# Prompt for spelling correction of commands.
setopt CORRECT

# Customize spelling correction prompt.
#SPROMPT='zsh: correct %F{red}%R%f to %F{green}%r%f [nyae]? '

# Remove path separator from WORDCHARS.
WORDCHARS=${WORDCHARS//[\/]}

# -----------------
# Zim configuration
# -----------------

# Use degit instead of git as the default tool to install and update modules.
#zstyle ':zim:zmodule' use 'degit'

# --------------------
# Module configuration
# --------------------

#
# git
#

# Set a custom prefix for the generated aliases. The default prefix is 'G'.
#zstyle ':zim:git' aliases-prefix 'g'

#
# input
#

# Append `../` to your input for each `.` you type after an initial `..`
#zstyle ':zim:input' double-dot-expand yes

#
# termtitle
#

# Set a custom terminal title format using prompt expansion escape sequences.
# See http://zsh.sourceforge.net/Doc/Release/Prompt-Expansion.html#Simple-Prompt-Escapes
# If none is provided, the default '%n@%m: %~' is used.
#zstyle ':zim:termtitle' format '%1~'

codex() {
  local codex_bin
  codex_bin="$(whence -p codex)"
  _locus_wrap_app codex utilities-terminal -- "$codex_bin" "$@"
}

_locus_safe_node_part() {
  print -r -- "$1" | tr -c '[:alnum:]_' '_'
}

[[ -r "$HOME/.config/locus/locus.sh" ]] && source "$HOME/.config/locus/locus.sh"

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
    locusctl prop set "$app_node" kind app-instance >/dev/null 2>&1 \
      && locusctl prop set "$app_node" name "$app_name" >/dev/null 2>&1 \
      && locusctl prop set "$app_node" icon "$app_icon" >/dev/null 2>&1 \
      && locusctl link set "$selected_window" app-instance "$app_node" >/dev/null 2>&1 \
      && linked=1
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
      locusctl link remove "$selected_window" app-instance "$app_node" >/dev/null 2>&1 || true
    fi
  }

  return $command_status
}

nvim() {
  _locus_wrap_app neovim "$HOME/.config/ags/assets/icons/Neovim.svg" -- /usr/bin/nvim "$@"
}

_locus_selected_workspace_subject() {
  local workspace_subject
  workspace_subject="$(locus_selected_workspace 2>/dev/null)"
  [[ "$workspace_subject" == workspace:* ]] || return 1
  print -r -- "$workspace_subject"
}

_locus_project_subject_for_pwd() {
  local project_root="${HOME:A}/proj"
  local pwd_path="${PWD:A}"
  [[ "${pwd_path:h}" == "$project_root" ]] || return 1
  print -r -- "project:$pwd_path"
}

_locus_chpwd_project_workspace() {
  (( $+commands[locusctl] )) || return 0

  local project_subject workspace_subject
  project_subject="$(_locus_project_subject_for_pwd)" || return 0
  workspace_subject="$(_locus_selected_workspace_subject)" || return 0

  locusctl prop set "$project_subject" kind project >/dev/null 2>&1 || return 0
  locusctl prop set "$project_subject" path "$PWD" >/dev/null 2>&1 || true
  locusctl prop set "$project_subject" name "${PWD:t}" >/dev/null 2>&1 || true
  locusctl link set "$workspace_subject" project "$project_subject" >/dev/null 2>&1 || true
}

typeset -ga chpwd_functions
chpwd_functions=("${(@)chpwd_functions:#_locus_chpwd_project_window}")
chpwd_functions=("${(@)chpwd_functions:#_locus_chpwd_project_workspace}")
chpwd_functions+=(_locus_chpwd_project_workspace)
_locus_chpwd_project_workspace

#
# zsh-autosuggestions
#

ZSH_AUTOSUGGEST_IGNORE_WIDGETS=(${ZSH_AUTOSUGGEST_IGNORE_WIDGETS[@]} zle-\*)

# Customize the style that the suggestions are shown with.
# See https://github.com/zsh-users/zsh-autosuggestions/blob/master/README.md#suggestion-highlight-style
#ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=242'

#
# zsh-syntax-highlighting
#

# Set what highlighters will be used.
# See https://github.com/zsh-users/zsh-syntax-highlighting/blob/master/docs/highlighters.md
ZSH_HIGHLIGHT_HIGHLIGHTERS=(main brackets)

# Customize the main highlighter styles.
# See https://github.com/zsh-users/zsh-syntax-highlighting/blob/master/docs/highlighters/main.md#how-to-tweak-it
#typeset -A ZSH_HIGHLIGHT_STYLES
#ZSH_HIGHLIGHT_STYLES[comment]='fg=242'

# ------------------
# Initialize modules
# ------------------

ZIM_HOME=${ZDOTDIR:-${HOME}}/.zim
# Download zimfw plugin manager if missing.
if [[ ! -e ${ZIM_HOME}/zimfw.zsh ]]; then
  if (( ${+commands[curl]} )); then
    curl -fsSL --create-dirs -o ${ZIM_HOME}/zimfw.zsh \
        https://github.com/zimfw/zimfw/releases/latest/download/zimfw.zsh
  else
    mkdir -p ${ZIM_HOME} && wget -nv -O ${ZIM_HOME}/zimfw.zsh \
        https://github.com/zimfw/zimfw/releases/latest/download/zimfw.zsh
  fi
fi
# Install missing modules, and update ${ZIM_HOME}/init.zsh if missing or outdated.
if [[ ! ${ZIM_HOME}/init.zsh -nt ${ZIM_CONFIG_FILE:-${ZDOTDIR:-${HOME}}/.zimrc} ]]; then
  source ${ZIM_HOME}/zimfw.zsh init
fi
# Initialize modules.
source ${ZIM_HOME}/init.zsh

# ------------------------------
# Post-init module configuration
# ------------------------------

#
# zsh-history-substring-search
#

zmodload -F zsh/terminfo +p:terminfo
# Bind ^[[A/^[[B manually so up/down works both before and after zle-line-init
for key ('^[[A' '^P' ${terminfo[kcuu1]}) bindkey ${key} history-substring-search-up
for key ('^[[B' '^N' ${terminfo[kcud1]}) bindkey ${key} history-substring-search-down
for key ('k') bindkey -M vicmd ${key} history-substring-search-up
for key ('j') bindkey -M vicmd ${key} history-substring-search-down
unset key
# }}} End configuration added by Zim install

function zle-keymap-select () {
  case $KEYMAP in
    vicmd) echo -ne '\e[2 q';;
    viins|main) echo -ne '\e[5 q';;
  esac
}
zle -N zle-keymap-select

zle-line-init() {
  echo -ne "\e[5 q"
}
zle -N zle-line-init

export KEYTIMEOUT=1

source_if_exists() {
  if [[ -f "$1" ]]; then
    source "$1"
  fi
}

source_if_exists "$ZDOTDIR/env.zsh"
source_if_exists "$ZDOTDIR/aliases.zsh"
source_if_exists "$ZDOTDIR/niri.zsh"

cd /tmp

#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"
