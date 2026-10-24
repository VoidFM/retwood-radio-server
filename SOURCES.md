# Sources and implementation notes

## Live scanner and dispatch (2.1.0)

Hosted scanner: https://metro-fire-live-scanner.noisymule8.chatgpt.site . Public listening is paired with protected station writes. D1 stores ordered PCM packets and transmission metadata; the browser and radios poll selected-channel packets and schedule them through short audio buffers. This is an independent internet relay, not access to a city's dispatch or RF system.

The live microphone branch uses the existing granted MediaStream, a silent AudioWorklet capture branch, 200–3400 Hz filtering and 8 kHz resampling. A native IMBE process persists for each PTT, preserving codec state. `fflush(stdout)` after each 20 ms frame removes pipe buffering; original and updated wrappers produced byte-identical PCM for the same input in verification. The original MediaRecorder/local replay and microphone constraints remain in place. The browser and radio receive channels are checked independently of transmit channel metadata. Radio IDs exclude each station's own network audio from its receiver.

Paging sources:

- Fire pager, Jason, identified as public domain: https://soundbible.com/1766-Fire-Pager.html ; downloaded `https://soundbible.com/mp3/Fire_pager-jason-1283464858.mp3`.
- EMS call alert, ScanMD Minitor VI downloads: https://www.scanmd.org/content/alertaudio/ ; downloaded `https://www.scanmd.org/content/alertaudio/file/ToneEMSCall1.zip`, containing `ToneEMSCall1.wav`.
- Dispatch voice uses Piper 1.8.0 and the same `en_US-ljspeech-high` model credited below. Nine original preset scripts provide fictional dispatches such as Structure Fire, Medical Emergency and Water Rescue. These are generated simulations, not cloned or captured city dispatch announcements.

The paging generator converts downloaded alerts and generated speech to normalized 8 kHz mono PCM. Complete tone-and-voice page-outs are bundled server-side so all receivers hear the same audio, without depending on a listener's system TTS voice. `scanner-site/scripts/generate-dispatch.py` and `scanner-site/README.md` document reproduction and credits.

Implementation references: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet ; https://developers.cloudflare.com/d1/worker-api/prepared-statements/ . Browser autoplay requires the listener to enable audio. A short buffer is intentional; this is not zero-latency RF audio. Recordings have a 24-hour retention policy with bounded cleanup. Private station connection files and hosted runtime credentials are excluded from published source and browser code.

## Radio body

Original Motorola Solutions APX 8000XE transparent product photograph, recovered with its original alpha mask from image object 1576 on page 1 of the manufacturer's September 2023 datasheet:
https://www.motorolasolutions.com/content/dam/msi/docs/products/two-way-radios/apx/apx8000xe/APX8000XE_DataSheet.pdf

The photograph is unchanged. The app overlays its functioning LCD and transparent button targets. Motorola names, marks and imagery remain property of their owners. This independent local simulator is not Motorola firmware or an official Motorola product.

## Recorded audio

W2SJW's Radio Sounds collection explicitly identifies the recordings as public domain:
https://w2sjw.com/radio_sounds.html

- `permit.mp3`: https://w2sjw.com/sounds/Moto_Tri_TPT.mp3 — Motorola trunking talk permit, tri format; contributor Tobias.
- `denied.mp3`: https://w2sjw.com/sounds/APX_Denied.mp3 — APX/XTS transmit denied; contributor Reed.
- `emergency.mp3`: https://w2sjw.com/sounds/APX_Evac.mp3 — APX/XTS emergency evacuation; contributor Reed.
- `lowbattery.mp3`: https://w2sjw.com/sounds/APX_LowBatt.mp3 — APX/XTS low battery; contributor Reed.
- `control3600.mp3`: https://w2sjw.com/sounds/Moto3600%20Type-II%20Slow.mp3 — actual SmartNet 3600-baud control-channel recording.
- `release.wav`: 100 ms squelch fragment, starting at 265 ms, from https://w2sjw.com/sounds/MDC-1200_DOS.mp3 — contributor Victor. Converted to 22.05 kHz mono with a 15 ms fade. This is a recorded radio squelch effect, not an authenticated APX mechanical button recording.

Key feedback uses a 28 ms excerpt of the recorded permit tone. Startup uses the recorded three-beep affiliation sound, not a fabricated melody. Motorola documents three quick beeps for successful initial trunking affiliation at power-up in:
https://www.motorolasolutions.com/content/dam/msi/resources/apx-new-feature-brief-2024-2.pdf

The startup sequence is a simulation using this recording; no recording independently verified as an APX 8000XE self-test was located. The speaker effect and sound levels still depend on your speakers/headphones.

## Actual speech codec

https://github.com/nostar/imbe_vocoder — fixed-point Project 25 IMBE encoder and decoder, derived from osmocom OP25; Pavel Yazev, copyright 2009, GPL-3.0-or-later. Upstream sources and copyright headers are preserved in `vendor/imbe_vocoder` and included alongside the native binary in the AppImage under `resources/source`.

The microphone is resampled to 8 kHz, processed in 160-sample frames by the real encoder and decoder (88-bit IMBE speech frames / 4400 bps), then played through a 260–3300 Hz speaker filter. This is an actual codec round trip, not bit-crushing and not a noise recording mixed over the voice. It is P25 Phase 1 IMBE; it is not Motorola's proprietary DSP or AMBE+2/Phase 2. 3600-baud control data is separate and available through Monitor / Audio tests.

Source for the PCM wrapper: `native/vocoder.cpp`. Build: `make -C vendor/imbe_vocoder`, then `g++ -O2 -static-libstdc++ -static-libgcc -Ivendor/imbe_vocoder native/vocoder.cpp vendor/imbe_vocoder/libimbe_vocoder.a -o native/vocoder`.

## Channel and zone voice announcements (2.0.1)

Motorola's ASTRO 25 brochure, page 11, describes Voice Announcement as a stored, pre-recorded voice file describing the selected channel/talk-group or zone:
https://www.motorolasolutions.com/content/dam/msi/docs/business/products/two-way_radios/portable_radios/_documents/static_files/apac_astro_brochure.pdf

The brochure discusses the communication vocoder separately. This documents the configurable local-recording feature, but does not establish the APX's internal announcement encoding or a single universal Motorola announcement voice. No suitable verified Motorola recording covering these simulator aliases was found. The implementation therefore uses the requested TTS fallback: clear local speech through a 260–3300 Hz speaker filter. Announcements do not pass through the simulator's over-air IMBE round trip or contain mixed-in control-channel noise. This is an approximation of a configured radio's local announcements, not a claim to reproduce Motorola's voice talent or proprietary playback DSP.

The 48 unique bundled WAV prompts cover all 48 channel positions and three zones (shared aliases reuse files). They were generated with Piper 1.8.0, model `en_US-ljspeech-high`, US English female, at length scale 0.94, noise scale 0.4 and noise-width scale 0.6. Silence was trimmed and levels normalized with FFmpeg, then saved as 8 kHz mono 16-bit PCM. The app applies the speaker filter and routes speech through its existing master volume. These are generated speech assets, not captured Motorola recordings.

- Piper engine, GPL-3.0: https://github.com/OHF-Voice/piper1-gpl
- Voice repository (MIT metadata): https://huggingface.co/rhasspy/piper-voices
- Model and model card: https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/ljspeech/high
- Model training credit in the card: https://brycebeattie.com/files/tts/
- LJ Speech dataset, public domain; recordings by Linda Johnson, alignment and annotation by Keith Ito: https://keithito.com/LJ-Speech-Dataset/

`assets/audio/announcements/manifest.json` records every display alias, spoken expansion, and filename. `scripts/generate-announcements.py` reproduces the build-time synthesis with `piper-tts==1.8.0`, FFmpeg and the downloaded model. The runtime bundles only the resulting WAVs and manifest, not Python, Piper or the model. No online TTS or browser speech-synthesis API is used. “TAC” is pronounced “tack,” “EMS” as letters, “DISP” as “dispatch,” and “OPS” as “operations.”

## Controls and LCD reference

### Fireground panic button (2.0.2)

Behavior follows the manufacturer's APX 8000XE Model 2.5 user guide, sections 7.11 and 7.14.2 (Emergency Operation and Using TPS Emergency Transmission):
https://docs-be.motorolasolutions.com/bundle/5692/raw/resource/enus/MN002668A01-BF_enus_APX_8000XE_Model_2.5_User_Guide.pdf?save_local=true

TPS is a particular programmable conventional fireground configuration, not a universal fire-department setting. The model here uses a latched local beacon that pauses for PTT and returns after voice traffic; a second one-second hold cancels it. The entry press uses the documented 50 ms default. The app also pauses the beacon throughout its local microphone replay so the existing voice feature remains audible. The alert has its own fixed 0.45 profile gain and is independent of the normal master-volume setting. Emergency keeps the LCD lit and suspends idle auto-off; manual power-off still clears it.

In 2.0.2–2.0.3 the repeating audio was the existing W2SJW/Reed APX/XTS emergency/evacuation recording (`emergency.mp3`), credited above. That recording is retained in Audio tests → Emergency. It is actual recorded radio alert audio, but not an independently verified recording of the specific TPS emergency beacon or de-key sidetone. The raised orange button is a CSS overlay at the top emergency-button location, with pressed feedback. No dispatch, RF, Bluetooth beacon or location service is connected.

### Rapid P25-styled panic warble (2.0.4)

The user selected a rapid high/low Motorola-style warble. `panic-p25.wav` uses 120 ms excerpts of the stable approximately 900 Hz and 600 Hz portions of the W2SJW/Reed recording, alternating high/low at 4.167 cycles per second. Two-millisecond splice ramps retain the original recorded pitches while speeding the cadence. The resulting PCM is processed through the same real P25 Phase 1 IMBE encoder and decoder used for microphone playback, in 160-sample frames at 8 kHz. Ten warm-up cycles are discarded, then the 2.4-second loop receives a 260–3300 Hz speaker filter, compression and peak normalization to 0.8, with four-millisecond edge ramps.

This is a deliberately customized radio effect using genuine codec processing, not an authenticated recording of an APX's internal emergency beacon or a claim that P25 defines a universal panic tone. No oscillators, mixed-in data noise or network services are used. The original recording remains unchanged. Runtime playback uses the pre-rendered WAV and retains the existing PTT/replay mute, hold-to-clear and fixed alarm gain. `scripts/generate-panic-audio.py` reproduces the asset using Python's standard library, FFmpeg and the bundled native wrapper; `assets/audio/panic-p25.json` records provenance and processing parameters.

https://docs-be.motorolasolutions.com/bundle/5692/raw/resource/enus/MN002668A01-BF_enus_APX_8000XE_Model_2.5_User_Guide.pdf

Physical button locations follow the product photograph. LCD status glyphs follow radio concepts (RSSI bars, high power, direct/digital, scan, lock, battery); no Bluetooth, GPS, encryption or RF connectivity is represented as connected. Local channels and settings are simulator configuration, not a copied firmware menu. Battery percentage is a simulated full battery.

## Clearfield announcements and startup speech (2.2.2)

Every alias in the current `radio-server/channels.json`, plus the startup word “Motorola”, has a bundled 8 kHz mono neural speech recording made with Piper 1.8.0 / en_US-ljspeech-high. County is spoken in place of “Co”, and DuBois uses the local “Doo boys” pronunciation. This uses the same speaker and playback filter as existing announcements, rather than depending on system TTS. The startup sequence plays the sourced Motorola talk-permit recording, followed by synthesized “Motorola” and the selected zone/channel. These speech recordings are synthesized, not a verified Motorola voice pack.

Motorola documentation describes configurable announcement recordings and WAV/MVF conversion, rather than a single universal announcer:
https://docs-be.motorolasolutions.com/bundle/18400/raw/resource/enus/MN003621A01-BA_enus_APX_CPS_Radio_Management_User_Guide.pdf

Reproduction: `PYTHONPATH=<piper-install> python3 scripts/generate-announcements.py <model.onnx> --channels radio-server/channels.json --include-startup --skip-existing`.

## Scanner PTT cues (standalone server 1.0.2)

`public/ptt-key.wav` and `public/ptt-release.wav` are custom P25-styled receive cues. The key-up uses the recorded W2SJW/Tobias Motorola tri-format talk-permit tone (`Moto_Tri_TPT.mp3`). The release uses 110 ms starting at 240 ms from W2SJW/Victor's `MDC-1200_DOS.mp3` (original retained in `assets/audio/mdc-dos.mp3`). This newly extracted segment is used independently of the radio app's older `release.wav` asset. The collection declares its sounds public domain:
https://w2sjw.com/radio_sounds.html

`scripts/generate-scanner-ptt.py` resamples the recordings to 8 kHz mono, passes them through the existing native P25 Phase 1 IMBE encoder/decoder, trims near-silent edges, normalizes key-up/release to 0.30/0.20 peak and applies 3 ms ramps. `public/ptt-cues.js` embeds the resulting PCM for synchronous browser playback; no online audio request or microphone access is needed. The server bundle includes these rendered clips, not a runtime codec dependency.

Talk-permit is a transmitter-side alert; MDC DOS is an analog signaling/squelch recording. These derived clips are intentionally applied as a scanner listening effect, not presented as an authenticated P25 over-air PTT burst or a sound mandated by P25. No control-channel noise is mixed into live speech. Each browser adds one opening and closing per transmission; the server recordings and diagnostic microphone RMS remain unchanged. End scheduling uses the final packet sequence, so regular packet boundaries and duplicate polls cannot trigger extra cues.

## Windows build and managed hosting (2.3.0)

The Windows x64 native codec was cross-compiled from the same preserved GPL sources using the official LLVM MinGW UCRT Linux toolchain, release 20261020. Source archive SHA-256: `55064b60b991a1e1e8090b8c2f84e82b22cfe5903d12c159d65064cf5e8ae335`. The wrapper selects binary stdin/stdout mode under Windows, preventing CR/LF translation and Ctrl-Z truncation of PCM. The runtime dependency check uses the toolchain's objdump; Windows itself is needed for a final microphone/runtime check.
https://github.com/mstorsjo/llvm-mingw/releases/tag/20261020

Render documents automatic Cloudflare-backed DDoS protection for its hosted services and separate limitations for Free compute. The new blueprint requests Free explicitly and provisions no paid datastore. App request controls do not constitute a claim of DDoS immunity.
https://render.com/docs/ddos-protection
https://render.com/docs/free
https://render.com/docs/blueprint-spec

## Retwood branding (2.4.0)

The app is named Retwood APX 8000. The Retwood R monogram, app icon, metal badge and wordmark in `assets/brand/` are original SVG artwork created for this project. The original hardware photograph remains unchanged as a source asset; new vector badges and the Retwood APX 8000 case label cover the original front/antenna marks at runtime. No claim is made that the physical photographed hardware was manufactured by Retwood.

Startup now speaks “Retwood” using the same Piper 1.8.0 / en_US-ljspeech-high synthesis described above, pronounced “Ret wood”. The previous synthesized Motorola startup file was removed from the current bundle. Recorded Motorola-origin permit/alert sounds remain credited and are retained for the requested radio sound. Historical implementation descriptions above refer to earlier versions.

The Windows build applies the new ICO and Retwood version metadata through electron-builder's JavaScript PE resource editor, while leaving code signing disabled. Desktop PNG and multi-size ICO assets are rendered from `icon.svg` with librsvg and Pillow by `scripts/render-brand-icons.py`.

## Native radio outline (2.4.2)

The drawing/input region is generated at the window's display size from the original photograph's alpha channel (alpha >= 24/255). Adjacent identical scanline spans are merged into native rectangles, then offset to the rendered photo position. The raised panic-button bounds are included separately. The photograph itself is not edited. Electron's Windows/Linux `setShape` clips native drawing and input outside this outline, independently of the renderer's transparent pixels. The window is fixed-size because Electron documents that resizable transparent windows can fail on some platforms. Linux selects X11 when DISPLAY is present to support the shape region through X11/XWayland.

Validation includes a real desktop capture over a solid-color test window, with the radio renderer deliberately forced to opaque black. Pixels outside the radio continue to show the underlying test window. Earlier image-alpha-only checks could not detect a desktop compositor presenting transparent buffers as black.
https://www.electronjs.org/docs/latest/api/base-window#winsetshaperects-windows-linux-experimental
https://www.electronjs.org/docs/latest/tutorial/custom-window-styles#limitations
