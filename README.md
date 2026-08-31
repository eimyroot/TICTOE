<div align="center">

# T3A

### Private, server-authoritative multiplayer arena

A compact real-time Team Tic-Tac-Toe proof of concept for invited testers.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white)
![Runtime](https://img.shields.io/badge/runtime-Node-111827)
![Transport](https://img.shields.io/badge/realtime-WebSocket-7C3AED)
![Status](https://img.shields.io/badge/status-private%20POC-F59E0B)

</div>

---

## What it demonstrates

- password-gated access for invited testers;
- signed `HttpOnly` session cookies;
- authenticated WebSocket upgrades;
- server-authoritative match state;
- rate-limited login attempts;
- deterministic syntax and smoke verification;
- one-command Render deployment configuration.

## Runtime flow

```text
browser
  │ password login
  ▼
Node HTTP server
  │ signed session
  ▼
authenticated WebSocket
  │ server-authoritative events
  ▼
in-memory match state
```

The browser is a client, not the authority for authentication or match state.

## Quick start

Requirements: Node.js 22 or newer.

```bash
npm install
T3A_ACCESS_PASSWORD='change-me' \
T3A_SESSION_SECRET='local-dev-secret-change-me' \
npm start
```

Open `http://localhost:8787`.

Run the complete repository verification:

```bash
npm run verify
```

## Render deployment

Create a Render **Web Service** from this repository.

| Setting | Value |
|---|---|
| Runtime | Node |
| Branch | `main` |
| Build command | `npm run check` |
| Start command | `npm start` |
| Health check | `/health` |
| Instance | Free, demo only |

Required secret:

- `T3A_ACCESS_PASSWORD` — password shared with invited testers.

Recommended secret:

- `T3A_SESSION_SECRET` — a strong independently generated session-signing secret.

Never commit either value.

## Security boundary

- access passwords are verified on the server;
- successful login creates a signed `HttpOnly` session cookie;
- WebSocket upgrades require a valid authenticated session;
- login attempts are rate limited in memory;
- secrets are supplied through environment variables, never frontend JavaScript.

Report suspected vulnerabilities according to [SECURITY.md](SECURITY.md).

## Known limitations

T3A is a private proof of concept, not production infrastructure.

- state is held in memory and disappears after restart;
- a free hosting instance may spin down;
- in-memory rate limiting is not shared across replicas;
- there is no production persistence, matchmaking, moderation, or availability guarantee.

## Contributing

Review [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. Pull requests must include verification evidence, risk notes, and a rollback path.
