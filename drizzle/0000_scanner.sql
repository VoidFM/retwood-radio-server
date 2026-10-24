CREATE TABLE transmissions (
 id TEXT PRIMARY KEY, channel INTEGER NOT NULL, station TEXT NOT NULL,
 label TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL,
 started_at INTEGER NOT NULL, ended_at INTEGER, last_at INTEGER NOT NULL,
 last_seq INTEGER NOT NULL DEFAULT -1, byte_count INTEGER NOT NULL DEFAULT 0,
 canceled INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX transmissions_channel_time ON transmissions(channel, started_at DESC);
--> statement-breakpoint
CREATE TABLE packets (
 id INTEGER PRIMARY KEY AUTOINCREMENT, tx_id TEXT NOT NULL REFERENCES transmissions(id) ON DELETE CASCADE,
 channel INTEGER NOT NULL, seq INTEGER NOT NULL, available_at INTEGER NOT NULL, pcm BLOB NOT NULL,
 UNIQUE(tx_id,seq)
);
--> statement-breakpoint
CREATE INDEX packets_channel_id ON packets(channel,id);
--> statement-breakpoint
CREATE TABLE floors (channel INTEGER PRIMARY KEY, tx_id TEXT NOT NULL, lease_until INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE stations (id TEXT PRIMARY KEY, label TEXT NOT NULL, seen_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE pairing (hash TEXT PRIMARY KEY, station TEXT NOT NULL, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
