CREATE TABLE network_servers (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, password_salt TEXT, password_hash TEXT,
 password_version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE server_channels (
 server_id TEXT NOT NULL REFERENCES network_servers(id) ON DELETE CASCADE,
 channel INTEGER NOT NULL, name TEXT NOT NULL, zone TEXT NOT NULL,
 PRIMARY KEY(server_id,channel)
);
--> statement-breakpoint
ALTER TABLE transmissions ADD COLUMN server_id TEXT NOT NULL DEFAULT 'metro';
--> statement-breakpoint
ALTER TABLE transmissions ADD COLUMN owner TEXT;
--> statement-breakpoint
ALTER TABLE packets ADD COLUMN server_id TEXT NOT NULL DEFAULT 'metro';
--> statement-breakpoint
ALTER TABLE stations ADD COLUMN server_id TEXT NOT NULL DEFAULT 'metro';
--> statement-breakpoint
ALTER TABLE pairing ADD COLUMN server_id TEXT NOT NULL DEFAULT 'metro';
--> statement-breakpoint
ALTER TABLE pairing ADD COLUMN purpose TEXT NOT NULL DEFAULT 'operator';
--> statement-breakpoint
DROP TABLE floors;
--> statement-breakpoint
CREATE TABLE floors (server_id TEXT NOT NULL DEFAULT 'metro',channel INTEGER NOT NULL,tx_id TEXT NOT NULL,lease_until INTEGER NOT NULL,PRIMARY KEY(server_id,channel));
--> statement-breakpoint
CREATE INDEX transmissions_server_channel ON transmissions(server_id,channel,started_at DESC);
--> statement-breakpoint
CREATE INDEX packets_server_channel ON packets(server_id,channel,id);
--> statement-breakpoint
CREATE INDEX stations_server_seen ON stations(server_id,seen_at);
