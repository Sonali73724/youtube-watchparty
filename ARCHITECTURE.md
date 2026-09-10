# YouTube Watch Party — System Architecture Document

## 1. High-Level Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT BROWSERS                                   |
|                                                                                   |
|  +--------------------+     +---------------------+     +----------------------+  |
|  |   Client A (HOST)  |     | Client B (MODERATOR)|     | Client C (VIEWER)    |  |
|  |   - React 18 + TS  |     | - React 18 + TS     |     | - React 18 + TS      |  |
|  |   - YT IFrame API  |     | - YT IFrame API     |     | - YT IFrame API      |  |
|  +---------+----------+     +----------+----------+     +-----------+----------+  |
+------------|---------------------------|----------------------------|-------------+
             |                           |                            |
             | HTTPS (REST API)          | WSS (Socket.IO + JWT)      |
             +---------------------------+----------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        AUTHORITATIVE REALTIME BACKEND                             |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Express HTTP Server + Health Check (/health) + Auth (/api/auth) + Rooms API |  |
|  +-----------------------------------------------------------------------------+  |
|  | SocketService (Socket.IO Gateway)                                           |  |
|  |  - JWT Handshake Authentication Middleware                                  |  |
|  |  - Typed Socket Event Routing & Error Translation                           |  |
|  +-----------------------------------------------------------------------------+  |
|  | Domain & RBAC Layer (Object-Oriented Architecture)                          |  |
|  |  - PermissionService: Authoritative RBAC check (Host / Mod / Participant)   |  |
|  |  - PlaybackStateManager: Authoritative clock extrapolation & drift calc     |  |
|  |  - Room: Aggregate root managing participants, messages & permissions      |  |
|  |  - RoomManager: Concurrency-safe registry of active domain rooms            |  |
|  |  - MessageHandler & ReactionHandler: Sanitization & Rate limiting           |  |
|  +-----------------------------------------------------------------------------+  |
|  | RoomService: Coordinates DB persistence & hydration with Prisma ORM        |  |
|  +-------------------------------------+---------------------------------------+  |
+----------------------------------------|------------------------------------------+
                                         |
                       +-----------------+-----------------+
                       |                                   |
                       v                                   v
        +------------------------------+    +------------------------------+
        |     PostgreSQL (Prisma)      |    |      Redis Pub/Sub Layer     |
        |  - Users & Passwords (bcrypt)|    |  - Socket.IO Redis Adapter   |
        |  - Rooms & Short Codes       |    |  - Multi-Instance Broadcast  |
        |  - Memberships & Roles       |    |  - Horizontal Scaling Mesh   |
        |  - Chat History              |    +------------------------------+
        +------------------------------+
```

---

## 2. Authoritative Playback Synchronization

### Single Source of Truth
The server is the authoritative clock for all room playback state. The client never dictates the room state to other peers directly.

The server's canonical `PlaybackStatePayload` consists of:
```typescript
interface PlaybackStatePayload {
  videoId: string;
  playState: 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ENDED';
  currentTime: number;       // Current reference timestamp (seconds)
  serverUpdatedAt: number;   // Epoch timestamp (ms) when last modified
  updatedByUserId?: string;
  updatedByUsername?: string;
}
```

### Clock Extrapolation Algorithm
When a video is `PLAYING`, the server does not poll the client. Instead, it computes the exact authoritative time on-demand using clock delta:
$$\text{AuthoritativeTime} = \text{referenceTime} + \frac{\text{Date.now}() - \text{serverUpdatedAt}}{1000}$$

When `PAUSED`, $\text{AuthoritativeTime} = \text{referenceTime}$.

### Drift Reconciliation
1. When a client joins or reconnects, the server sends the full `sync_state` containing the extrapolated authoritative timestamp.
2. The client loads the video and seeks to `authoritativeTime`.
3. During active playback, local client time is checked against the server clock. If drift exceeds the threshold ($\Delta t > 1.2\text{s}$), a smooth non-blocking seek (`player.seekTo(target, true)`) reconciles the player.
4. If drift is within $1.2\text{s}$, the video continues playing uninterrupted, preventing stutter.

### Playback Loop & Echo Prevention
- When a user interacts with local controls, a socket event is emitted.
- When the server broadcasts a canonical state (`playback_updated`), the receiving clients mark an internal `isRemoteUpdateRef = true` flag.
- When the YouTube IFrame API triggers its internal `onStateChange`, the hook consumes the flag and suppresses any rebroadcast, eliminating infinite event ping-pong loops.

---

## 3. Authoritative RBAC (Role-Based Access Control)

Security is strictly enforced on the server for every privileged socket event:

| Action | HOST | MODERATOR | PARTICIPANT | Unauthenticated |
| :--- | :---: | :---: | :---: | :---: |
| `play` | ✅ | ✅ | ❌ (Rejected) | ❌ |
| `pause` | ✅ | ✅ | ❌ (Rejected) | ❌ |
| `seek` | ✅ | ✅ | ❌ (Rejected) | ❌ |
| `change_video` | ✅ | ✅ | ❌ (Rejected) | ❌ |
| `assign_role` | ✅ (Mod/Viewer) | ❌ (Rejected) | ❌ (Rejected) | ❌ |
| `transfer_host` | ✅ | ❌ (Rejected) | ❌ (Rejected) | ❌ |
| `remove_participant`| ✅ | ❌ (Rejected) | ❌ (Rejected) | ❌ |
| `send_message` | ✅ | ✅ | ✅ | ❌ |
| `send_reaction` | ✅ | ✅ | ✅ | ❌ |

### Enforcement Flow:
```
Client Emits Privileged Event ('play', 'seek', 'assign_role')
  -> Socket.IO Handshake verifies JWT token & identifies socket.data.user
  -> Realtime Gateway fetches domain Room aggregate
  -> PermissionService validates user's authoritative role
       ├── If Unauthorized: Emits 'error_event' { code: 'PERMISSION_DENIED' } and halts.
       └── If Authorized: Mutates PlaybackStateManager, persists to DB, and broadcasts.
```

---

## 4. Object-Oriented Domain Layer (OOP)

The architecture utilizes clean Object-Oriented Domain Driven Design:

1. **`Room` (Aggregate Root)**: Encapsulates participants collection, host transfer invariants, participant removal, and coordinates sub-managers.
2. **`Participant` (Entity)**: Encapsulates user metadata within a room, socket binding, presence status, and role lifecycle.
3. **`PlaybackStateManager` (Value / Domain Manager)**: Encapsulates authoritative time extrapolation, drift checking, and playback state transitions.
4. **`PermissionService` (Domain Service)**: Stateless RBAC rule engine.
5. **`MessageHandler` (Domain Handler)**: Chat input validation, sanitization, in-memory ring-buffer history, and rate-limiting.
6. **`ReactionHandler` (Domain Handler)**: Emoji validation against whitelist and rapid-fire spam throttling.
7. **`RoomManager` (Domain Registry)**: In-memory concurrency-safe cache of active rooms.
8. **`SocketService` (Realtime Gateway)**: Adapter bridging network sockets to domain aggregates.

---

## 5. Persistence vs Realtime Layer

- **PostgreSQL (via Prisma ORM)**:
  - Durable source of truth for Users, Rooms, Memberships, and Chat History.
  - Guarantees data durability across server restarts or container re-deployments.
- **Redis (via `@socket.io/redis-adapter`)**:
  - Horizontal realtime communication mesh across multiple Node.js instances.
  - Handles pub/sub routing so a command executed on Server Instance A instantly propagates to clients connected to Server Instance B.
  - Gracefully falls back to standalone in-memory pub/sub if `REDIS_URL` is omitted in development.

---

## 6. Reconnect & Resilience Strategy

- **Transient Disconnects**: Socket.IO client automatically retries connection with exponential backoff (1s to 5s).
- **State Resynchronization**: Upon reconnect, client emits `join_room` and receives fresh canonical `sync_state`, realigning video, timestamp, role, and chat history.
- **Graceful Server Shutdown**: Handles `SIGTERM`/`SIGINT` by closing WebSocket listeners, flushing DB transactions, and disconnecting Prisma cleanly.
