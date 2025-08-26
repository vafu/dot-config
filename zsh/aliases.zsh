alias e="$EDITOR"
alias se="sudoedit"
#
alias gpb='git push origin "$(git branch --show-current)"'

alias gaa="git add ."
alias gcm="git commit -m"

gpa() {
  if [ -z "$1" ]; then
    echo "Error: Please provide a commit message."
    return 1
  fi
  gaa
  gcm $1
  gpb
}
