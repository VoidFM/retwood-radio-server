#!/bin/sh
set -eu
RADIO_SERVER_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$RADIO_SERVER_DIR/runtime.sh"
exec "$RADIO_NODE_BIN" "$RADIO_SERVER_DIR/setup.mjs"
