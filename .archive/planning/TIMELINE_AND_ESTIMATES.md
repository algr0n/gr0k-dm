# Timeline & Estimates — Unity multiplayer prototype (Windows)

Team options
- Small: 1 Unity dev (backend-capable) + 1 backend dev part-time + 1 QA/artist part-time
- Medium: 2 Unity devs, 1 backend dev, 1 artist, 1 QA

Effort estimate (small team)
- Setup: 1 week (10–20h)
- Handshake & networking: 1 week (20–30h)
- Lobby & room: 1 week (20–30h)
- Authoritative dice: 2 weeks (40–80h)
- Chat + AI relay: 2 weeks (40–80h)
- Persistence + avatars: 1–2 weeks (20–40h)
- Steam integration: 2 weeks (20–60h)
- Polish & QA: 1–2 weeks (20–40h)

Total: ~8–12 weeks at part-time/one-dev pace. Parallel work shortens calendar time.

AI cost planning
- Instrument tokens per response and calls per session.
- Heuristic: 1–5 AI calls/session-hour. Multiply active users * avg calls * avg cost.
- Mitigations: caching, throttling, credits/paid tiers, pre-generated content.

Infra
- Dev: single Express/ws instance.
- Prod: scale with load balancer, multiple servers, Redis caching or Turso where appropriate.
- Add logging, cost dashboards, and per-room AI meters.

Next actionable item
- Start Sprint 0: create Unity repo skeleton and add a dev WebSocket token endpoint on server.
- I can generate a Unity C# WebSocket client example and RollRequest/RollResult handlers next — tell me if you want that now.
