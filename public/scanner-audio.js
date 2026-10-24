'use strict';
// One receive opening and closing per transmission, independent of packet size.
// All sources share the listener's volume control. No microphone is opened here.
globalThis.ScannerAudio = class ScannerAudio {
  constructor(context, output, {sources = new Set(), latency = .3, maxAhead = 5} = {}) {
    this.context = context;
    this.output = output;
    this.sources = sources;
    this.latency = latency;
    this.maxAhead = maxAhead;
    this.nextTime = 0;
    this.calls = new Map();
    this.current = null;
    this.cues = Object.fromEntries(Object.entries(globalThis.SCANNER_PTT_PCM).map(([key, pcm]) => [key, this.decode(pcm)]));
  }

  decode(pcm) {
    const raw = atob(pcm), buffer = this.context.createBuffer(1, raw.length / 2, 8000);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      let value = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
      if (value > 32767) value -= 65536;
      samples[i] = value / 32768;
    }
    return buffer;
  }

  schedule(buffer, at, call, type) {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    this.sources.add(source);
    call.sources.add(source);
    source.onended = () => {this.sources.delete(source); call.sources.delete(source); source.disconnect()};
    source.start(at);
    return source;
  }

  packet(packet, buffer = this.decode(packet.pcm)) {
    let call = this.calls.get(packet.tx);
    if (call && (packet.seq <= call.seq || call.closed)) return;
    const now = this.context.currentTime;
    if (this.nextTime > now + this.maxAhead) this.stop();
    if (!call || !this.calls.has(packet.tx)) {
      if (this.current && !this.current.closed) this.close(this.current);
      this.nextTime = Math.max(this.nextTime, now + this.latency);
      call = {id: packet.tx, seq: -1, end: this.nextTime, closed: false, sources: new Set()};
      this.calls.set(packet.tx, call);
      this.current = call;
      this.schedule(this.cues.key, this.nextTime, call, 'key');
      this.nextTime += this.cues.key.duration + .015;
      // Completed IDs prevent duplicate polls from replaying opening cues.
      if (this.calls.size > 128) for (const [id, old] of this.calls) {
        if (old.closed && !old.sources.size) {this.calls.delete(id); break}
      }
    }
    this.nextTime = Math.max(this.nextTime, now + .02);
    this.schedule(buffer, this.nextTime, call, 'voice');
    this.nextTime += buffer.duration;
    call.end = this.nextTime;
    call.seq = packet.seq;
  }

  close(call) {
    if (call.closed) return;
    call.closed = true;
    const at = Math.max(call.end, this.context.currentTime + .01);
    this.schedule(this.cues.release, at, call, 'release');
    call.end = at + this.cues.release.duration;
    this.nextTime = Math.max(this.nextTime, call.end + .025);
  }

  sync(history) {
    for (const row of history) {
      const call = this.calls.get(row.id);
      if (!call) continue;
      if (row.canceled) {
        for (const source of call.sources) {try {source.stop()} catch {}}
        call.closed = true;
        call.end = this.context.currentTime;
        if (this.current === call) this.nextTime = 0;
      } else if (row.endedAt !== null && call.seq >= row.lastSeq) this.close(call);
    }
  }

  get busy() {
    return this.nextTime > this.context.currentTime || [...this.calls.values()].some(call => !call.closed);
  }

  stop() {
    for (const source of this.sources) {try {source.stop()} catch {}}
    this.sources.clear();
    this.calls.clear();
    this.current = null;
    this.nextTime = 0;
  }
};
