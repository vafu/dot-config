#!/bin/bash
if [ -n "$1" ]; then
    COLOR="$1"
else
    COLOR=$(gsettings get org.gnome.desktop.interface accent-color | tr -d "'")
fi

echo "@define-color accent_bg_color @accent_$COLOR;" >~/.local/share/themes/accent-color.css
theme=$(gsettings get org.gnome.desktop.interface gtk-theme)
gsettings set org.gnome.desktop.interface gtk-theme ''
gsettings set org.gnome.desktop.interface gtk-theme $theme
