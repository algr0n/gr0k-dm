# WebSocket API Contract — Unity client <-> Express/ws server

Design goals
- JSON messages with small payloads.
- Server authoritative for dice and core state.
- Versioned via clientVersion in JoinRoom.

Envelope
- { "type": "string", "reqId": "optional", "payload": { ... } }

Core message types
- JoinRoom (client) — payload: { roomId, player: { displayName, clientVersion, meta }, authToken }
- LeaveRoom (client)
- RoomState (server) — payload: { roomId, players[], history[], settings }
- PlayerJoined / PlayerLeft (server)
- ChatMessage (client/server) — payload: { senderId, text, timestamp }
- RollRequest (client) — payload: { playerId, diceSpec, contextId?, reqId }
- RollResult (server) — payload: { rollId, playerId, diceSpec, result, breakdown, timestamp }
- ActionRequest / ActionResult (generic)
- AiRequest (server-side trigger) — payload: { roomId, contextSnapshot, promptHints, maxTokens }
- AiResponse (server) — payload: { responseText, aiMeta, responseId }
- Error — payload: { code, message, reqId }

Security & replay
- AuthToken short-lived and mapped to playerId server-side.
- Server validates playerId with token on every message.
- Server RNG only — no client-provided dice seeds.

Heartbeat & reconnection
- Ping/Pong keepalive.
- On reconnect client supplies lastReceivedEventId to receive missed events.

Versioning
- Server can reject old clientVersion on JoinRoom.

Sample Roll flow
1. Client -> RollRequest
2. Server validates -> RNG -> RollResult
3. Server -> broadcast RollResult
4. Clients display result when RollResult received.

Extend contract as features (voice, binary payloads, Steam features) are added.
