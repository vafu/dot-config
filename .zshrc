function reload_gtk_theme() {
  theme=$(gsettings get org.gnome.desktop.interface gtk-theme)
  gsettings set org.gnome.desktop.interface gtk-theme ''
  gsettings set org.gnome.desktop.interface gtk-theme $theme
}


# Unity CLI
case ":${PATH}:" in *:"$HOME/.local/bin":*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac
