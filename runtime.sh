# Shared runtime lookup for setup.sh and start.sh.
radio_check_node() {
    "$1" -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22||(major===22&&minor>=13)?0:1)' >/dev/null 2>&1
}
RADIO_NODE_BIN=
if [ -x "$RADIO_SERVER_DIR/.runtime/bin/node" ] && radio_check_node "$RADIO_SERVER_DIR/.runtime/bin/node"; then
    RADIO_NODE_BIN="$RADIO_SERVER_DIR/.runtime/bin/node"
elif command -v node >/dev/null 2>&1 && radio_check_node "$(command -v node)"; then
    RADIO_NODE_BIN=$(command -v node)
else
    printf '%s\n' 'Node.js 22.13 or newer is required. Install Node.js, or put a compatible node executable in .runtime/bin/node.' >&2
    exit 1
fi
