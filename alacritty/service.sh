#!/bin/bash

# This script listens for changes to the GNOME desktop color scheme (dark/light mode)
# and creates a symbolic link `theme.toml` to either `dark_theme.toml` or
# `light_theme.toml` accordingly.

# Ensure you have `gsettings` available on your system.
# Make this script executable with: chmod +x service.sh
# Run it in the background from your terminal: ./service.sh &

set -e

# Get the directory where the script is located to ensure paths are correct
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

DARK_THEME_SOURCE="$SCRIPT_DIR/dark.theme"
LIGHT_THEME_SOURCE="$SCRIPT_DIR/light.theme"
THEME_TARGET="$SCRIPT_DIR/theme.toml"

update_theme_link() {
    local current_scheme
    current_scheme=$(gsettings get org.gnome.desktop.interface color-scheme)

    echo "Detected color scheme: $current_scheme"

    rm -f "$THEME_TARGET"

    if [[ "$current_scheme" == "'prefer-dark'" ]]; then
        echo "Switching to dark theme."
        ln -s "$DARK_THEME_SOURCE" "$THEME_TARGET"
    else
        # This handles 'prefer-light' and the default value
        echo "Switching to light theme."
        ln -s "$LIGHT_THEME_SOURCE" "$THEME_TARGET"
    fi
    echo "---"
}

echo "Starting theme switcher script..."

update_theme_link

gsettings monitor org.gnome.desktop.interface color-scheme | while read -r line; do
    echo "A theme change was detected by the system."
    update_theme_link
done
