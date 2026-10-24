# Retwood APX 8000 standalone server

Copy this entire folder onto the machine where you want to host your radio server. One running folder is one server. Its password, callsigns, channels, recordings and scanner belong to that instance. There is no browser server-management or server-creation panel.

Requires Node.js 22.13+ (Node.js 22 or 24 LTS). No npm dependencies or database installation are needed.

## Free managed hosting

For hosting that runs away from your computer, follow [HOST-ON-RENDER.md](HOST-ON-RENDER.md). The included Render Free blueprint uses `managed.mjs`, private environment credentials and radio-only access. It disables scanner pages, public audio, recordings and browser dispatch. Free-plan sleep, storage and usage limits are documented there. Retwood APX 8000 2.4.0 or newer is required for authenticated reception.

## First start

```sh
cd radio-server
./start.sh
```

The launcher uses a local `.runtime/bin/node` when present, otherwise a compatible system Node.js. It runs setup automatically if `server.json` does not exist, then starts the server. No `npm` command is needed. To change the password later, run `./setup.sh`.

Setup asks for your server name and password; the password input is hidden. It writes a private `server.json` containing a salted password verifier. Start uses port 8080 by default. Open `http://127.0.0.1:8080` locally to view the scanner. Radio users enter your public HTTPS address, the shared server password and their callsign. Local testing also accepts `http://127.0.0.1:8080`.

Give other radio users only the address and password. Keep `server.json`, TLS keys and `.data/` private. They are never served over HTTP. The server binds each voice transmission to the callsign in its signed login grant; the public scanner and receiving radios display it. Radio grants expire after 24 hours. No personal accounts are required.

For automated setup, provide `RADIO_NAME` and `RADIO_PASSWORD` in the hosting service's environment and run `node setup.mjs`. Do not put real passwords in a public repository or Docker image. The example configuration alternatively supports a private `password` field or a runtime `RADIO_PASSWORD` override; `CHANGE_ME_NOW` is rejected.

## Live audio test

Open `http://127.0.0.1:8080/audio-test` locally, or `/audio-test` on your public HTTPS address. Click **Listen**, hold PTT on the radio and speak. The page follows an active channel by default, plays actual received server audio and displays the transmitting callsign, received PCM packet count and RMS audio level. It also reports near-silent incoming samples. Manual channel selection is available. The page never opens a microphone. Its URL is also available through the desktop radio’s **Open audio test** context-menu item.

## Scanner PTT sounds

Both the full scanner and `/audio-test` play a brief P25-styled Motorola key-up cue once when a transmission starts, then a release cue after its last buffered speech sample. Dispatch broadcasts, local dispatch previews and history playback use the same cues. Automatic scanning holds the channel until the audio tail finishes. Stop or a manual channel change clears pending speech and cues together.

The clips are bundled, rendered through the radio's actual IMBE codec at build time, and follow the scanner volume control. They are custom effects based on recorded radio sounds, not a universal P25 receiver tone. They are added at browser playback, so downloaded WAV files and microphone level readings retain the original server audio. Audio playback must be enabled in each browser.

## Your channel names

Edit `channels.json` on the server. The 48 stable IDs represent three zones of 16 positions. Change each entry's `name` and `zone`, keeping `id`, `zoneIndex` and `number` in place. All entries in a zone must use the same zone name. Names may contain 1–24 characters. Connected radios receive edits within about five seconds; browsers refresh automatically too. The app cannot rename server channels locally.

Change `server.json` for the server display name, `dispatchCallsign`, port or bind host. Name, password and channel edits reload automatically; port/bind/TLS changes require a restart. Re-run setup to rotate the password. Rotation invalidates current radio and paging grants. Existing users must sign in again.

## Hosting

Your host must expose this Node process to the internet. For a VM, put Caddy or another HTTPS reverse proxy in front of port 8080. `Caddyfile.example` shows the proxy configuration; replace its domain. Alternatively, configure `tlsCert` and `tlsKey` paths in private `server.json` for direct HTTPS. The desktop radio requires HTTPS for remote hosts; HTTP is accepted for loopback testing.

The process respects the hosting provider's `PORT` environment variable. `RADIO_CONFIG` selects another private configuration path. For multiple independent servers, copy this folder or run separate processes using separate config paths, data directories and ports/domains. Share each instance's address. `GET /health` reports readiness.

A Dockerfile is included. Mount private configuration and a persistent data directory at runtime. Keep recordings on persistent storage; a hosting plan that sleeps or deletes its disk is unsuitable for reliable radio use. Only enable `trustProxy` when the server is behind your trusted proxy, with direct backend access blocked.

A local scanner listener can enable audio without a password. Radio transmission requires a successful server-password login. A signed-in radio can open a single-use browser dispatch link from its context menu; that enables paging on that server, not server administration.

SQLite recordings survive restarts and expire after 24 hours. One transmitter is allowed per channel; different channels can transmit concurrently. Stop gracefully with Ctrl+C or SIGTERM. Back up the private configuration and `.data/` with the process stopped.

## Request protection

The HTTP listener applies bounded per-address request buckets, separate login admission throttling, global/per-client concurrency limits, 16 KiB bodies, 8 KiB headers, request timeouts and connection limits. Denied requests receive HTTP 429 with Retry-After. These controls supplement hosting-provider DDoS protection. Only enable `trustProxy` behind a trusted ingress with direct access blocked; the final ingress-appended address is used, rather than a client-supplied leftmost forwarded value.

Set `scannerEnabled: false` to require authenticated radio reception and disable scanner/browser dispatch/recording routes. This mode retains a short live audio buffer (two minutes by default); scanner-enabled mode retains the previous 24-hour recording behavior. Restart when changing scanner mode.

## Verification

```sh
npm test
```

The test uses an isolated temporary server and verifies password rejection, callsign enforcement, channel separation, recordings, live channel-file reload, paging, restart persistence, password rotation and absent management routes. The app's Electron checks also cover live microphone audio, no local echo and the emergency hot mic.

Audio credits are in SOURCES.md. The server and radio form a simulation; they do not connect to emergency services or transmit RF.
