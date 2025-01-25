#!/bin/bash

LANG=C top -bn1 | grep Cpu | sed 's/\\,/\\./g' | awk '{print $2}'
