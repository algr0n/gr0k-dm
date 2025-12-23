# Unity Migration Plan — gr0k-dm (Windows-first, Multiplayer-first)

Summary
- Goal: Port the client from web (TypeScript/React) to Unity (C#) focusing on multiplayer rooms that connect to the existing Express/ws backend. Windows is primary target; Proton/Steam handles Linux/Steam Deck later.
- Constraints: Keep Grok API server-side, server-authoritative game state (prevent cheating), focus prototype on player rooms, dice, chat, and AI as GM relay.

Engine & tooling
- Unity LTS (2023.4+). C# + Unity UI Toolkit or uGUI.
- Prototype networking: WebSocket client in Unity to reuse existing Express/ws.
- Production options: Steamworks.NET + SteamNetworkingSockets or Mirror/Netcode depending on matchmaking needs.
- JSON parsing: Newtonsoft.Json or Unity's JsonUtility.
- WebSocket libs: WebSocketSharp or UnityWebRequest WebSocket if available.

Architecture (prototype)
- Unity client: UI, input, dice animation, WebSocket client → Express/ws.
- Express/ws server: authoritative state, Grok integration, persistence (Turso), caching, rate-limiting.

High-level milestones
1. Project and repo setup
2. Client/server handshake + auth
3. Lobby & room join/leave
4. Authoritative dice + actions
5. Chat + AI relay via server
6. Steamworks integration & packaging

Security & cost notes
- Never embed Grok API keys in client; all AI calls must be server-side.
- Add caching, throttling and usage meters for AI costs.
- Use short-lived auth tokens (map SteamID to server token).

Deliverables for prototype
- Unity project skeleton
- WebSocket client: authenticate, join/leave room, send actions, receive state
- Dice roll flow: client -> RollRequest -> server RNG -> RollResult broadcast
- Simple lobby and in-game scene
- Server instrumentation showing AI usage/costs
