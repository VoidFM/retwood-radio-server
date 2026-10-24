#!/bin/sh
set -eu
RADIO_SERVER_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$RADIO_SERVER_DIR/runtime.sh"
if [ ! -f "${RADIO_CONFIG:-$RADIO_SERVER_DIR/server.json}" ]; then
    "$RADIO_NODE_BIN" "$RADIO_SERVER_DIR/setup.mjs"
fi
exec "$RADIO_NODE_BIN" --experimental-sqlite "$RADIO_SERVER_DIR/server.mjs"
