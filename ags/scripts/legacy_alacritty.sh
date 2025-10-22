#!/bin/bash

# This script listens for changes to the GNOME desktop color scheme (dark/light mode)
# or can be manually triggered to create a symbolic link `theme.toml` to either
# `dark_theme.toml` or `light_theme.toml`.

# Ensure you have `gsettings` available on your system.
# Make this script executable with: chmod +x service.sh
#
# Usage:
#   ./service.sh --daemon    # Runs in the background, listening for changes (default)
#   ./service.sh --dark      # Sets the dark theme and exits
#   ./service.sh --light     # Sets the light theme and exits

set -e

# Get the directory where the script is located to ensure paths are correct
SCRIPT_DIR="$HOME/.config/alacritty/"

# --- Configuration ---
DARK_THEME_SOURCE="$SCRIPT_DIR/dark.theme"
LIGHT_THEME_SOURCE="$SCRIPT_DIR/light.theme"
THEME_TARGET="$SCRIPT_DIR/theme.toml"

# --- Functions ---

##
# Sets the theme to dark by creating the appropriate symlink.
##
set_dark_theme() {
    echo "Setting theme to dark."
    rm -f "$THEME_TARGET"
    ln -s "$DARK_THEME_SOURCE" "$THEME_TARGET"
    echo "Link created: $THEME_TARGET -> $DARK_THEME_SOURCE"
}

##
# Sets the theme to light by creating the appropriate symlink.
##
set_light_theme() {
    echo "Setting theme to light."
    rm -f "$THEME_TARGET"
    ln -s "$LIGHT_THEME_SOURCE" "$THEME_TARGET"
    echo "Link created: $THEME_TARGET -> $LIGHT_THEME_SOURCE"
}

##
# Checks the current system theme via gsettings and updates the symlink.
##
update_theme_from_system() {
    local current_scheme
    current_scheme=$(gsettings get org.gnome.desktop.interface color-scheme)

    echo "Detected system color scheme: $current_scheme"

    if [[ "$current_scheme" == "'prefer-dark'" ]]; then
        set_dark_theme
    else
        # This handles 'prefer-light' and the default 'default' value
        set_light_theme
    fi
    echo "---"
}

##
# Starts the daemon to monitor for system theme changes.
##
start_daemon() {
    echo "Starting theme switcher daemon..."
    update_theme_from_system

    gsettings monitor org.gnome.desktop.interface color-scheme | while read -r line; do
        echo "System theme change detected."
        update_theme_from_system
    done
}

# --- Main Logic ---

# Default action is to run the daemon if no argument is provided.
ACTION=${1:---daemon}

case "$ACTION" in
    --dark)
        set_dark_theme
        ;;
    --light)
        set_light_theme
        ;;
    --daemon)
        start_daemon
        ;;
    *)
        echo "Error: Invalid argument '$1'"
        echo "Usage: $0 [--daemon|--dark|--light]"
        exit 1
        ;;
esac
