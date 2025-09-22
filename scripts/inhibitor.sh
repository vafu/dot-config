#!/bin/bash

# This script uses upower's monitor to react to AC power changes
# and inhibit/uninhibit hypridle accordingly.

# --- VARIABLES & FUNCTIONS ---
COOKIE_FILE="/tmp/hypridle_inhibit_cookie"
export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"

inhibit_idle() {
    if [ -f "$COOKIE_FILE" ]; then return; fi
    echo "🔌 AC power detected. Inhibiting idle."
    gdbus call --session --dest org.freedesktop.ScreenSaver --object-path /org/freedesktop/ScreenSaver --method org.freedesktop.ScreenSaver.Inhibit "power-adapter" "Plugged into AC" | cut -d' ' -f2 | tr -d '(),' > "$COOKIE_FILE"
}

uninhibit_idle() {
    if [ ! -f "$COOKIE_FILE" ]; then return; fi
    echo "🔋 Battery power detected. Removing idle inhibitor."
    gdbus call --session --dest org.freedesktop.ScreenSaver --object-path /org/freedesktop/ScreenSaver --method org.freedesktop.ScreenSaver.UnInhibit "$(cat "$COOKIE_FILE")"
    rm "$COOKIE_FILE"
}

# --- INITIAL STATE CHECK ---
# Set the correct state when the script is first launched.
AC_PATH=$(upower -e | grep 'line_power')
if upower -i "$AC_PATH" | grep -q "online: *yes"; then
    inhibit_idle
else
    uninhibit_idle
fi

# --- MAIN MONITORING LOOP ---
# Monitor for future changes to power state.
upower --monitor-detail | while IFS= read -r line; do
    if [[ "$line" =~ online:.*yes ]]; then
        inhibit_idle
    elif [[ "$line" =~ online:.*no ]]; then
        uninhibit_idle
    fi
done
