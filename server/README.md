# Tym server

A small Rust ([axum](https://github.com/tokio-rs/axum) + SQLite) server that hosts the Tym web app and syncs data
between devices.

The app is local-first: everything is saved in the browser and works offline (it's an installable PWA). When
sync is turned on in the app's **Sync** page and the server is reachable, the app pushes local changes and pulls
changes from other devices.

## Running

Build the web app, then start the server from this directory:

```sh
cd .. && bun run build && cd server
TYM_TOKEN="$(openssl rand -hex 32)" TYM_STATIC_DIR=../dist cargo run --release
```

Open the printed address, go to **Sync**, paste the same token and turn sync on. Do the same on every device.

| Variable         | Default          | Meaning                                                         |
| ---------------- | ---------------- | --------------------------------------------------------------- |
| `TYM_TOKEN`      | — (required)     | Shared secret; clients send it as `Authorization: Bearer …`     |
| `TYM_ADDR`       | `127.0.0.1:8080` | Address to listen on (use `0.0.0.0:8080` to accept remote hosts) |
| `TYM_DB`         | `tym.db`         | SQLite database file                                            |
| `TYM_STATIC_DIR` | `../dist`        | Built web app to serve                                          |
| `RUST_LOG`       | `info`           | Log level                                                       |

When exposing it beyond your machine, put it behind HTTPS (e.g. a reverse proxy such as Caddy). The token travels
in a header on every sync, and browsers only install PWAs and run service workers over HTTPS (or on `localhost`).

## Development

- `cargo test` runs the merge, storage and HTTP tests.
- With the server running on port 8080, `bun run dev` proxies `/api` to it, so sync works from the Vite dev
  server too.

## How sync works

`POST /api/sync` with `{ cursor, changes }`. The server applies the changes and replies with
`{ cursor, changes }`: every record changed since the client's cursor, including the client's own changes as
the server resolved them.

- Records are `(collection, id)` pairs from `tasks`, `people`, `taskTypes` and `workflow`, each with the client
  timestamp of its last change. Deletions are kept as tombstones so they reach other devices.
- Conflicts are resolved per record: the most recent change wins. A task's history is merged from both sides, so
  notes and audit entries are never lost.
- Every stored change gets the next sequence number; the cursor is the highest one a client has seen.

Known limitation: if two devices edit *different fields* of the same record while out of touch, the later edit
replaces the whole record (the history still shows both).
