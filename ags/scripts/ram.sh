#!/bin/bash

LANG=C free | awk '/^Mem/ {printf("%.2f", ($3/$2) * 100)}'
