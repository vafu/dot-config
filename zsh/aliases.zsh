alias e="$EDITOR"
alias se="sudoedit"
#
alias gpb='git push origin "$(git branch --show-current)"'

alias gaa="git add ."
alias gcm="git commit -m"

open_project() {
  PROJECT_DIR=""
  if [ -n "$1" ]; then
    PROJECT_DIR="$1"
  fi
  if [ -n "$2" ]; then
    PROJECT_DIR="$PROJECT_DIR/$2"
  fi
  cd $PROJECT_DIR
}


p() {
  open_project "$HOME/proj" $1
}

c() {
  open_project "$HOME/.config" $1
}

pe() {
  p $1
  e
}

ce() {
  c $1
  e
}


gpa() {
  if [ -z "$1" ]; then
    echo "Error: Please provide a commit message."
    return 1
  fi
  gaa
  gcm $1
  gpb
}

function reload_gtk_theme() {
  theme=$(gsettings get org.gnome.desktop.interface gtk-theme)
  gsettings set org.gnome.desktop.interface gtk-theme ''
  gsettings set org.gnome.desktop.interface gtk-theme $theme
}

function find_and_move() {
  if [[ "$#" -ne 3 ]]; then
    echo "Usage: find_rsync_move <source_dir> <dest_dir> <file_pattern>" >&2
    return 1
  fi

  local source_dir="$1"
  local dest_dir="$2"
  local pattern="$3"

  if command -v realpath >/dev/null 2>&1; then
    source_dir=$(realpath "$source_dir")
    dest_dir=$(realpath "$dest_dir")
  else
    echo "Warning: 'realpath' not found. This command may fail with relative paths." >&2
  fi

  if [[ ! -d "$source_dir" ]]; then
    echo "Error: Source directory '$source_dir' not found." >&2
    return 1
  fi
  if [[ ! -d "$dest_dir" ]]; then
    echo "Error: Destination directory '$dest_dir' not found." >&2
    return 1
  fi

  (
    cd "$source_dir" || exit
    find . -type f -name "$pattern" -print0 | rsync -av --remove-source-files --from0 --files-from=- -R . "$dest_dir"
  )

  # clean up empty dirs
  find "$source_dir" -type d -empty -delete
}
