# 🎥 YouTube Watch Party — Production Web Application

A full-stack, real-time collaborative YouTube Watch Party web application featuring authoritative backend playback synchronization, role-based access control (RBAC), chat, emoji reactions, Redis horizontal scaling, and comprehensive automated test suites.

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Key Features](#-key-features)
3. [Tech Stack](#-tech-stack)
4. [Architecture & Design Principles](#-architecture--design-principles)
5. [Folder Structure](#-folder-structure)
6. [Prerequisites & Environment Variables](#-prerequisites--environment-variables)
7. [Local Setup & Quick Start](#-local-setup--quick-start)
8. [Testing Suite](#-testing-suite)
9. [Authoritative Playback Synchronization](#-authoritative-playback-synchronization)
10. [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
11. [Redis Horizontal Realtime Scaling](#-redis-horizontal-realtime-scaling)
12. [PostgreSQL & Prisma Persistence](#-postgresql--prisma-persistence)
13. [WebSocket Event Reference](#-websocket-event-reference)
14. [REST API Endpoints](#-rest-api-endpoints)
15. [Production Deployment Guide](#-production-deployment-guide)
16. [Key Interview Discussion Files](#-key-interview-discussion-files)

---

## 🌟 Project Overview

YouTube Watch Party lets multiple users join a shared room and watch YouTube videos together with sub-second synchronization. When an authorized user (Host or Moderator) plays, pauses, seeks, or changes the video, all participants in the room converge to the exact same playback state in real time.

---

## ✨ Key Features

### Core Capabilities
- **Authoritative Playback Synchronization**: Backend server manages canonical video ID, playback state, and timestamp with drift correction.
- **YouTube URL Parsing**: Supports standard URLs (`/watch?v=`), short links (`youtu.be/`), Shorts (`/shorts/`), embed links, and raw 11-char IDs.
- **Loop & Echo Prevention**: Flag-based remote sync suppression prevents infinite client-server rebroadcast loops.
- **Collision-Resistant Room Codes**: Shareable 6-character room codes and one-click invite links.

### Authoritative RBAC (Role-Based Access Control)
- **HOST**: Full control (Play, Pause, Seek, Change Video, Promote Moderator, Demote, Kick User, Transfer Host).
- **MODERATOR**: Playback control (Play, Pause, Seek, Change Video).
- **PARTICIPANT / VIEWER**: View synchronized video, live chat, and reactions. Playback mutations are strictly rejected on the backend.

### Bonus Features
- **Live Room Chat**: Instant messaging with auto-scroll, message length validation, and persisted history.
- **Floating Emoji Reactions**: Interactive reaction toolbar (❤️ 😂 😮 👏 🔥 🎉 🍿) with rising animated particles over the video and spam throttling.
- **Redis Multi-Instance Scaling**: `@socket.io/redis-adapter` enables horizontal scaling across multiple backend instances.
- **Persistent State**: PostgreSQL database via Prisma ORM ensures rooms, memberships, and messages survive server restarts.

---

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, React Router 6, Tailwind CSS, Lucide Icons, Canvas Confetti |
| **Backend** | Node.js, Express, TypeScript, Socket.IO 4, IORedis, BcryptJS, JSONWebTokens |
| **Database** | PostgreSQL, Prisma ORM |
| **Realtime / PubSub** | Redis, `@socket.io/redis-adapter` |
| **Testing** | Vitest, React Testing Library, Supertest, Socket.IO Client |
| **Deployment** | Vercel (Frontend SPA), Node.js / Docker (Backend Server) |

---

## 📐 Architecture & Design Principles

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT BROWSERS                                   |
|   React 18 + Vite + Tailwind + YouTube IFrame API + Socket.IO Client              |
+------------------------------------------+----------------------------------------+
                                           |
                              WSS (Socket.IO) & HTTPS (REST)
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                        AUTHORITATIVE REALTIME BACKEND                             |
|                                                                                   |
|  - Express Server & Auth API (/api/auth) & Rooms API (/api/rooms)                 |
|  - SocketService (Realtime Gateway + JWT Middleware)                              |
|  - Domain Model (OOP):                                                            |
|      * Room (Aggregate Root)                                                      |
|      * Participant (Entity)                                                       |
|      * PlaybackStateManager (Clock Extrapolation & Drift Reconciliation)          |
|      * PermissionService (Stateless RBAC Rules)                                   |
|      * MessageHandler & ReactionHandler (Sanitization & Rate Limiting)            |
|  - RoomService (Prisma DB Persistence Coordinator)                                |
+------------------------------------------+----------------------------------------+
                                           |
                       +-------------------+-------------------+
                       |                                       |
                       v                                       v
        +------------------------------+        +------------------------------+
        |     PostgreSQL (Prisma)      |        |          Redis Mesh          |
        |  Durable State: Users,       |        |  Horizontal Realtime Pub/Sub |
        |  Rooms, Memberships, Chat    |        |  Cross-instance Broadcast    |
        +------------------------------+        +------------------------------+
```

---

## 📁 Folder Structure

```
Youtube_watchparty/
├── shared/                  # Shared domain types, contracts & utilities
│   ├── src/
│   │   ├── types.ts         # Socket events & DTO definitions
│   │   ├── constants.ts     # Thresholds, emoji whitelist, limits
│   │   ├── utils/youtube.ts # Robust YouTube URL parser
│   │   └── utils/validation.ts
│   └── package.json
│
├── server/                  # Authoritative Backend (Express + Socket.IO + Prisma)
│   ├── prisma/
│   │   └── schema.prisma    # PostgreSQL database schema
│   ├── src/
│   │   ├── config.ts        # Environment configuration
│   │   ├── db.ts            # Prisma client singleton
│   │   ├── domain/          # Object-Oriented Domain Layer
│   │   │   ├── Room.ts
│   │   │   ├── Participant.ts
│   │   │   ├── PlaybackStateManager.ts
│   │   │   ├── PermissionService.ts
│   │   │   ├── MessageHandler.ts
│   │   │   ├── ReactionHandler.ts
│   │   │   └── RoomManager.ts
│   │   ├── realtime/
│   │   │   └── SocketService.ts # Socket.IO Realtime Gateway & Redis Adapter
│   │   ├── services/
│   │   │   ├── AuthService.ts
│   │   │   └── RoomService.ts
│   │   ├── routes/
│   │   │   ├── authRoutes.ts
│   │   │   └── roomRoutes.ts
│   │   └── server.ts        # Express app & HTTP server entrypoint
│   └── tests/               # 52 Backend Unit & Realtime Integration Tests
│
├── client/                  # Modern React Frontend (Vite + Tailwind)
│   ├── src/
│   │   ├── components/      # CustomControls, ChatPanel, ParticipantsPanel, Reactions
│   │   ├── context/         # AuthContext, SocketContext, ToastContext
│   │   ├── hooks/           # useYouTubePlayer (with drift sync & loop prevention)
│   │   ├── pages/           # LandingPage, DashboardPage, RoomPage
│   │   └── App.tsx
│   └── tests/               # React Testing Library unit tests
│
├── vercel.json              # Vercel deployment configuration
├── ARCHITECTURE.md          # In-depth architectural design document
└── README.md
```

---

## ⚙️ Prerequisites & Environment Variables

### Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **PostgreSQL**: Local instance, Neon, Supabase, or Railway URL
- **Redis**: Optional for local single-node; recommended for multi-instance scaling

### Environment Variables (`.env` in server root)
```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/youtube_watchparty?schema=public"
REDIS_URL="redis://localhost:6379" # Optional in dev mode
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
CLIENT_URL="http://localhost:3000"
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
```

---

## 🚀 Local Setup & Quick Start

1. **Install all dependencies across the monorepo**:
   ```bash
   npm install
   ```

2. **Build the shared type contracts**:
   ```bash
   npm run build --workspace=@watchparty/shared
   ```

3. **Initialize Database Schema with Prisma**:
   ```bash
   cd server
   npx prisma db push
   # or npx prisma migrate dev
   cd ..
   ```

4. **Start Development Servers (Frontend + Backend concurrently)**:
   ```bash
   npm run dev
   ```
   - Frontend will be live on `http://localhost:3000`
   - Backend API & WebSockets on `http://localhost:4000`

---

## 🧪 Testing Suite

The repository includes a comprehensive 57-test automated suite covering domain rules, URL parsing, RBAC permissions, realtime multi-client socket flows, and frontend UI components.

### Run All Tests:
```bash
npm run test
```

### Run Server Tests:
```bash
npm run test:server
```
- `PermissionService.test.ts`: Exhaustive matrix testing for HOST, MODERATOR, PARTICIPANT permissions.
- `PlaybackStateManager.test.ts`: Clock extrapolation, pause freezing, seek updates, drift detection.
- `YouTubeParser.test.ts`: URL extraction from watch, youtu.be, shorts, embeds, and query parameters.
- `RoomDomain.test.ts`: Aggregate root invariants, role assignment, host transfer, member removal.
- `SocketRealtime.test.ts`: Multi-client Socket.IO integration tests verifying play/pause propagation, RBAC rejections, chat, and reactions.

### Run Frontend Tests:
```bash
npm run test:client
```

---

## 🔄 Authoritative Playback Synchronization

1. **Clock Extrapolation**: When the video is playing, the server calculates authoritative time as:
   $$\text{AuthoritativeTime} = \text{currentTime} + \frac{\text{Date.now}() - \text{serverUpdatedAt}}{1000}$$
2. **Drift Threshold**: If a client's player drifts by more than `1.2s`, the client smoothly seeks to the authoritative time.
3. **Loop Prevention**: Server-initiated player state changes set `isRemoteUpdateRef = true`, preventing the client from echoing the event back to the server.

---

## 🛡️ Role-Based Access Control (RBAC)

| Role | Play / Pause / Seek | Change Video | Promote / Demote | Kick User | Transfer Host | Chat & Reactions |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **HOST** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **MODERATOR** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **PARTICIPANT** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

Every socket event is validated on the server by `PermissionService` before mutating room state or broadcasting.

---

## 📡 WebSocket Event Reference

### Client -> Server Events
- `join_room`: `{ roomIdOrCode: string }`
- `leave_room`: `{ roomId: string }`
- `play`: `{ roomId: string, currentTime: number }`
- `pause`: `{ roomId: string, currentTime: number }`
- `seek`: `{ roomId: string, currentTime: number }`
- `change_video`: `{ roomId: string, videoUrlOrId: string }`
- `assign_role`: `{ roomId: string, targetUserId: string, newRole: Role }`
- `remove_participant`: `{ roomId: string, targetUserId: string }`
- `transfer_host`: `{ roomId: string, targetUserId: string }`
- `send_message`: `{ roomId: string, text: string }`
- `send_reaction`: `{ roomId: string, emoji: string }`
- `request_sync`: `{ roomId: string }`

### Server -> Client Events
- `sync_state`: Full canonical room, playback, participant, and chat payload.
- `playback_updated`: Updated `playState`, `currentTime`, and `serverUpdatedAt`.
- `video_changed`: New video ID and state.
- `user_joined` / `user_left`: Presence updates.
- `role_assigned`: Updated participant role.
- `host_transferred`: New host assignment.
- `participant_removed`: Target user removed from room.
- `message_received`: Broadcast chat message DTO.
- `reaction_received`: Broadcast reaction DTO.
- `error_event`: `{ code: string, message: string }`.

---

## 🌐 REST API Endpoints

- `POST /api/auth/signup`: Create a new user (`username`, `email`, `password`).
- `POST /api/auth/login`: Authenticate and receive JWT (`identifier`, `password`).
- `GET /api/auth/me`: Fetch authenticated user profile.
- `POST /api/rooms`: Create a new persistent watch party.
- `GET /api/rooms/:idOrCode`: Fetch room metadata and initial state.
- `GET /api/rooms/my-rooms`: Fetch current user's active watch party rooms.
- `GET /health`: Healthcheck endpoint with database & Redis connection status.

---

## 🚢 Production Deployment Guide

### Frontend (Vercel)
1. Push repository to GitHub.
2. Import repository into [Vercel](https://vercel.com).
3. Set the Root Directory to `client` or use root with `vercel.json`.
4. Deploy!

### Backend & Database (Render / Railway / Fly.io / Neon)
1. Provision a PostgreSQL database (e.g. Neon or Supabase) and copy `DATABASE_URL`.
2. (Optional) Provision a Redis instance (e.g. Upstash or Redis Cloud) and copy `REDIS_URL`.
3. Set environment variables in your backend host:
   - `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `NODE_ENV=production`.
4. Run `npx prisma db push` or `prisma migrate deploy`.
5. Start server with `npm start` in the `server` directory.

---

## 💡 Key Interview Discussion Files

When presenting or walking through this codebase:
1. `server/src/domain/PlaybackStateManager.ts`: Mathematical clock extrapolation and drift reconciliation algorithm.
2. `server/src/domain/PermissionService.ts`: Authoritative server-side RBAC validation.
3. `server/src/domain/Room.ts`: Domain Aggregate Root managing participants, roles, and invariants.
4. `server/src/realtime/SocketService.ts`: Redis Pub/Sub adapter, JWT handshake authentication, and typed event dispatching.
5. `client/src/hooks/useYouTubePlayer.ts`: IFrame API lifecycle management and feedback loop prevention.
6. `server/tests/realtime/SocketRealtime.test.ts`: Complete multi-client integration test suite.
