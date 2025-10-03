#!/bin/bash

set -eo pipefail

if [[ -z "${AUTOREMOTE_URL}" ]]; then
  echo "Error: AUTOREMOTE_URL environment variable is not set." >&2
  exit 1
fi

send_request() {
  local message="$1"
  curl -fsSL "${AUTOREMOTE_URL}&message=${message}" > /dev/null
}

dnd_on() {
  echo "Activating DND..."
  swaync-client --dnd-on
  send_request "dnd_on"
  echo "DND is now on."
}

dnd_off() {
  echo "Deactivating DND..."
  swaync-client --dnd-off
  send_request "dnd_off"
  echo "DND is now off."
}

# Main script logic
main() {
  case "$1" in
    on)
      dnd_on
      ;;
    off)
      dnd_off
      ;;
    request)
      if [[ -z "$2" ]]; then
        echo "Error: 'request' command requires a message argument." >&2
        usage
      fi
      send_request "$2"
      ;;
  esac
}

main "$@"
