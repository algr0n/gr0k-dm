# Prototype Backlog (8–12 weeks) — Unity multiplayer prototype (Windows)

Assumptions
- Team: 1–2 engineers (Unity + backend), 1 QA/artist part-time.
- Reuse existing backend endpoints where possible.

Sprint 0 — Setup (1 week)
- Create Unity LTS project skeleton, gitignore, README.
- Add WebSocket client package.
Acceptance: Unity project opens and builds a dev Windows player.

Sprint 1 — Auth & Handshake (1 week)
- Implement dev-token login flow and handshake exchanging player metadata.
Acceptance: Client connects and receives player id.

Sprint 2 — Lobby & Room Join (1 week)
- Lobby UI, create/join room; server returns room state.
Acceptance: Two clients join same room and see player list.

Sprint 3 — Authoritative Dice & Actions (2 weeks)
- Dice UI + animation; client sends RollRequest; server RNG -> RollResult.
Acceptance: Same roll result for all clients; animation shows result.

Sprint 4 — Chat, GM, AI Relay (2 weeks)
- Text chat; server triggers Grok for AI responses; AI responses broadcasted.
Acceptance: Chat works; AI-generated GM responses appear.

Sprint 5 — Persistence, Avatars, Basic Audio (1–2 weeks)
- Save/load player data, avatar/name UI, audio plan/placeholders.
Acceptance: Player name persists across reconnects.

Sprint 6 — Steamworks & Packaging (2 weeks)
- Integrate Steamworks.NET, map SteamID to server token, create Windows build pipeline.
Acceptance: Steam-authenticated user can join rooms and overlay works.

Sprint 7 — Polish & Test (1–2 weeks)
- Bug fixes, logging, profiling, AI-cost instrumentation.
Acceptance: Playable 2–4 player session; AI costs visible in logs.

Optional Sprint 8 — Early Access Prep (2 weeks)
- EULA, privacy, store asset checklist, private Steam build.
Acceptance: Private Steam build tested.

Notes
- Use 2-week cadence if preferred.
- Parallelize tasks with larger team.
