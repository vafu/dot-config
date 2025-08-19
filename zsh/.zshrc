
### Added by Zinit's installer
if [[ ! -f $HOME/.local/share/zinit/zinit.git/zinit.zsh ]]; then
    print -P "%F{33} %F{220}Installing %F{33}ZDHARMA-CONTINUUM%F{220} Initiative Plugin Manager (%F{33}zdharma-continuum/zinit%F{220})…%f"
    command mkdir -p "$HOME/.local/share/zinit" && command chmod g-rwX "$HOME/.local/share/zinit"
    command git clone https://github.com/zdharma-continuum/zinit "$HOME/.local/share/zinit/zinit.git" && \
        print -P "%F{33} %F{34}Installation successful.%f%b" || \
        print -P "%F{160} The clone has failed.%f%b"
fi

source "$HOME/.local/share/zinit/zinit.git/zinit.zsh"

autoload -Uz _zinit
(( ${+_comps} )) && _comps[zinit]=_zinit

HISTFILE=$HOME/.zsh_history
setopt appendhistory

zinit light zsh-users/zsh-syntax-highlighting
zinit light zsh-users/zsh-autosuggestions
zinit light zsh-users/zsh-completions

zinit ice as"command" from"gh-r" lucid \
  mv"zoxide*/zoxide -> zoxide" \
  atclone"./zoxide init zsh > init.zsh" \
  atpull"%atclone" src"init.zsh" nocompile'!'

zinit light ajeetdsouza/zoxide

zinit light-mode for \
    junegunn/fzf-bin \
    zsh-users/zsh-history-substring-search

zinit ice as"command" from"gh-r" \
          atclone"./starship init zsh > init.zsh; ./starship completions zsh > _starship" \
          atpull"%atclone" src"init.zsh"
zinit light starship/starship

source_if_exists() {
  if [[ -f "$1" ]]; then
    source "$1"
  fi
}

source_if_exists "$ZDOTDIR/env.zsh"
source_if_exists "$ZDOTDIR/aliases.zsh"
source_if_exists "$ZDOTDIR/env.zsh"
source_if_exists "$HOME/.zshrc"

