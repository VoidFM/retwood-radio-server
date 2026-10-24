# Free managed hosting, radio only

Render runs this server for you. Your computer does not need to stay on. Members run the desktop radio and enter the Render HTTPS address, your shared server password, and their callsign.

## Deploy without a terminal

1. Extract `Retwood-Managed-Server-1.2.0.zip`.
2. Create a GitHub repository. Upload the **contents** of `managed-server/` so `render.yaml`, `managed.mjs`, `channels.json` and `package.json` are at the repository root. Do not upload a desktop AppImage or EXE.
3. Sign in at https://dashboard.render.com, select **New → Blueprint**, and connect that repository. The included `render.yaml` explicitly selects the **Free** web-service plan, with no paid disk or database.
4. Enter `RADIO_NAME` (your server name) and `RADIO_PASSWORD` (10–128 characters). Render generates a private `RADIO_SIGNING_SECRET`. Keep passwords and signing secrets in Render's environment settings, never in GitHub files.
5. Deploy. Copy the service's HTTPS address, such as `https://your-radio.onrender.com`. The root page intentionally returns 404 because the scanner is disabled. `/health` returns a readiness result.
6. Open Retwood APX 8000 2.4.0 or newer. Enter that HTTPS address, the password and your callsign. Give other members the same address and password; they choose their own callsigns.

To rename channels or zones, edit `channels.json` in the repository and deploy the update. It contains three zones of 16 channels; keep IDs and numbering intact. Change the server name/password through Render's environment settings and redeploy.

For another group, deploy another service with its own name, password and signing secret. Each service has its own channels and audio. Free compute hours are shared within a Render workspace; several continuously running instances can exhaust the allowance. Each group can instead deploy under its own Render account and share that service's address. There is no public server-management website.

## What is disabled

This entry point serves radio connections and `/health`. Scanner pages, audio-test pages, browser paging, station pairing and downloadable recordings return 404. Live audio, channel catalog and status require a signed radio login. Retwood APX 8000 2.3.0 hides scanner menu items when connected to this mode. Older radio versions cannot receive its authenticated feed.

A short rolling SQLite audio buffer is kept for live delivery and cleaned on a 30-second interval; transmissions older than two minutes are eligible once inactive. No public recording access is enabled. The radio does not repeat your own microphone audio back to you.

## Protection

Render automatically supplies Cloudflare-backed DDoS protection for hosted services:
https://render.com/docs/ddos-protection

The app adds bounded request buckets, global and per-address concurrency limits, login throttling, a 16 KiB request body limit, 8 KiB header limit, connection/time limits, and authenticated live-audio access. A direct connection cannot invent an IP using forwarding headers. On Render, only the final ingress-appended forwarded address is used. These controls supplement the host's network protection; they do not make the application DDoS-proof or guarantee availability during an attack.

## Free-plan limits

Render Free sleeps after 15 minutes without incoming traffic. Waking can take about a minute; the new radio login allows up to 90 seconds and shows a starting-server message. Free filesystem data is erased by restarts, redeployments and sleep. Channel definitions are restored from Git; credentials/signing grants remain stable when the same private environment variables are retained. Audio buffers and presence reset, and transmissions in progress are interrupted. Radios reconnect after the service starts again.

The published allowance is 750 free instance-hours per workspace each month, shared by its free services. Bandwidth and build limits also apply. Without a payment method, exceeding included bandwidth suspends free services for the rest of the month; with billing enabled, additional bandwidth can incur charges. Review the dashboard's quotas/spending settings if you need strictly zero cost. Do not use a keep-alive service to work around idle restrictions.

This is a free hobby/testing deployment, not a promise of continuous availability or unlimited users. Current details:
https://render.com/docs/free

## Optional manual service setup

If you choose **New → Web Service** instead of a Blueprint:

- Runtime: Node
- Plan: Free
- Build command: `node --check managed.mjs`
- Start command: `node --experimental-sqlite managed.mjs`
- Health check: `/health`
- Environment: `NODE_VERSION=22`, `RADIO_NAME`, `RADIO_PASSWORD`, `RADIO_SCANNER_ENABLED=false`, and a randomly generated `RADIO_SIGNING_SECRET` of at least 32 characters.

The managed ZIP also maps `npm start` to `managed.mjs`. In the full source folder, use the explicit managed command above; its ordinary `npm start` launches the classic file-configured server.
