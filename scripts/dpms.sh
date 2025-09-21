#!/bin/bash

AC_ADAPTER=$(ls /sys/class/power_supply/ | grep -E '^AC|^ADP')

if [ "$1" = "off" ]; then
    # Turn off display only if on battery (online = 0)
    if [ "$(cat /sys/class/power_supply/${AC_ADAPTER}/online)" -eq 0 ]; then
        hyprctl dispatch dpms off
    fi
elif [ "$1" = "on" ]; then
    hyprctl dispatch dpms on && brightnessctl -r
fi
