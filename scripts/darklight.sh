#!/bin/bash

gsettings set org.gnome.desktop.interface color-scheme $([ "$(gsettings get org.gnome.desktop.interface color-scheme)" = "'prefer-dark'" ] && echo 'prefer-light' || echo 'prefer-dark')
