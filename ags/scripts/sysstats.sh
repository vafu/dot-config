#!/bin/bash

LANG=C top -bn1 | awk '
  /Cpu/ { gsub(",", ".", $2); cpu=$2 }
  /^MiB Mem/ { ram=($8 / $4) * 100 }
  /^Mem/ { ram=($3 / $2) * 100 }
  END { printf("{\"cpu\":%.0f,\"ram\":%.0f}\n", cpu, ram) }
'
