import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  Role,
  extractYouTubeVideoId,
} from '@watchparty/shared';
import { AuthService } from '../services/AuthService';
import { RoomService } from '../services/RoomService';
import { PermissionService } from '../domain/PermissionService';
import { CONFIG } from '../config';

export class SocketService {
  private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private roomService: RoomService;
  private redisPub?: Redis;
  private redisSub?: Redis;

  constructor(httpServer: HttpServer, roomService: RoomService) {
    this.roomService = roomService;
    this.io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
      cors: {
        origin: CONFIG.CORS_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 20000,
      pingInterval: 10000,
    });

    this.setupRedisAdapter();
    this.setupAuthMiddleware();
    this.setupConnectionHandlers();
  }

  public getIO(): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
    return this.io;
  }

  /**
   * Configures Redis Pub/Sub adapter for horizontal multi-instance scaling
   */
  private setupRedisAdapter(): void {
    if (CONFIG.REDIS_URL && process.env.NODE_ENV !== 'test') {
      let adapterAttached = false;

      const pubClient = new Redis(CONFIG.REDIS_URL, {
        maxRetriesPerRequest: 1,
        lazyConnect: false,
        retryStrategy(times) {
          if (times > 3) return null; // Stop reconnecting after 3 attempts if Redis is offline
          return Math.min(times * 200, 1000);
        },
      });
      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) => {
        if (!adapterAttached) {
          // Log fallback warning on first connection failure
        } else {
          console.warn('⚠️ Redis Pub error:', err.message);
        }
      });

      subClient.on('error', () => {
        // Suppress initial sub connection errors before ready
      });

      Promise.all([
        new Promise<void>((resolve, reject) => {
          pubClient.once('ready', () => resolve());
          pubClient.once('error', (err) => {
            if (!adapterAttached) reject(err);
          });
        }),
        new Promise<void>((resolve, reject) => {
          subClient.once('ready', () => resolve());
          subClient.once('error', (err) => {
            if (!adapterAttached) reject(err);
          });
        }),
      ])
        .then(() => {
          if (!adapterAttached) {
            adapterAttached = true;
            this.redisPub = pubClient;
            this.redisSub = subClient;
            this.io.adapter(createAdapter(pubClient, subClient));
            console.log('🚀 Redis Adapter connected and attached to Socket.IO.');
          }
        })
        .catch((err) => {
          console.warn('⚠️ Redis server offline or unreachable. Falling back to Socket.IO in-memory adapter:', (err as Error).message);
          pubClient.disconnect();
          subClient.disconnect();
        });
    } else {
      console.log('ℹ️ Running Socket.IO in standalone in-memory mode.');
    }
  }

  /**
   * Handshake authentication middleware
   */
  private setupAuthMiddleware(): void {
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
        if (!token) {
          return next(new Error('Authentication required: No token provided.'));
        }

        const decoded = AuthService.verifyToken(token);
        socket.data.user = {
          id: decoded.userId,
          username: decoded.username,
          email: decoded.email,
        };
        next();
      } catch (error) {
        next(new Error('Authentication failed: Invalid or expired token.'));
      }
    });
  }

  /**
   * Event listeners and room handlers
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
      const user = socket.data.user;
      console.log(`🔌 User connected: ${user.username} (${user.id}) on socket ${socket.id}`);

      // 1. JOIN ROOM
      socket.on('join_room', async ({ roomIdOrCode }, callback) => {
        try {
          const room = await this.roomService.getOrHydrateRoom(roomIdOrCode);
          if (!room) {
            socket.emit('error_event', { code: 'ROOM_NOT_FOUND', message: 'Room does not exist.' });
            callback?.({ success: false, error: 'Room not found.' });
            return;
          }

          // Leave any previous room
          if (socket.data.currentRoomId && socket.data.currentRoomId !== room.id) {
            await this.handleLeaveRoom(socket, socket.data.currentRoomId);
          }

          socket.data.currentRoomId = room.id;
          socket.join(`room:${room.id}`);

          // Add participant to domain room and ensure DB membership
          const participant = room.addParticipant(user, socket.id);
          await this.roomService.ensureMembership(room.id, user.id, participant.getRole());

          // Send current authoritative room state to the joiner
          const statePayload = room.getRoomStatePayload(user.id);
          socket.emit('sync_state', statePayload);

          // Broadcast user joined to other room participants
          socket.to(`room:${room.id}`).emit('user_joined', {
            participant: participant.toDTO(),
            message: `${user.username} joined the party.`,
          });

          callback?.({ success: true, data: statePayload });
        } catch (error) {
          console.error('Error in join_room:', error);
          socket.emit('error_event', { code: 'JOIN_ERROR', message: 'Failed to join room.' });
          callback?.({ success: false, error: 'Failed to join room.' });
        }
      });

      // 2. LEAVE ROOM
      socket.on('leave_room', async ({ roomId }) => {
        await this.handleLeaveRoom(socket, roomId);
      });

      // 3. PLAY
      socket.on('play', async ({ roomId, currentTime }) => {
        const room = await this.roomService.getOrHydrateRoom(roomId);
        if (!room) return;

        const participant = room.getParticipant(user.id);
        if (!participant || !PermissionService.canPlay(participant.getRole())) {
          socket.emit('error_event', {
            code: 'PERMISSION_DENIED',
            message: 'Permission denied: Only Host and Moderators can play.',
          });
          return;
        }

        const playbackState = room.getPlaybackManager().play(currentTime, user.id, user.username);
        await this.roomService.persistPlaybackState(
          room.id,
          playbackState.videoId,
          playbackState.playState,
          playbackState.currentTime
        );

        this.io.to(`room:${room.id}`).emit('playback_updated', playbackState);
      });

      // 4. PAUSE
      socket.on('pause', async ({ roomId, currentTime }) => {
        const room = await this.roomService.getOrHydrateRoom(roomId);
        if (!room) return;

        const participant = room.getParticipant(user.id);
        if (!participant || !PermissionService.canPause(participant.getRole())) {
          socket.emit('error_event', {
            code: 'PERMISSION_DENIED',
            message: 'Permission denied: Only Host and Moderators can pause.',
          });
          return;
        }

        const playbackState = room.getPlaybackManager().pause(currentTime, user.id, user.username);
        await this.roomService.persistPlaybackState(
          room.id,
          playbackState.videoId,
          playbackState.playState,
          playbackState.currentTime
        );

        this.io.to(`room:${room.id}`).emit('playback_updated', playbackState);
      });

      // 5. SEEK
      socket.on('seek', async ({ roomId, currentTime }) => {
        const room = await this.roomService.getOrHydrateRoom(roomId);
        if (!room) return;

        const participant = room.getParticipant(user.id);
        if (!participant || !PermissionService.canSeek(participant.getRole())) {
          socket.emit('error_event', {
            code: 'PERMISSION_DENIED',
            message: 'Permission denied: Only Host and Moderators can seek.',
          });
          return;
        }

        const playbackState = room.getPlaybackManager().seek(currentTime, user.id, user.username);
        await this.roomService.persistPlaybackState(
          room.id,
          playbackState.videoId,
          playbackState.playState,
          playbackState.currentTime
        );

        this.io.to(`room:${room.id}`).emit('playback_updated', playbackState);
      });

      // 6. CHANGE VIDEO
      socket.on('change_video', async ({ roomId, videoUrlOrId }) => {
        const room = await this.roomService.getOrHydrateRoom(roomId);
        if (!room) return;

        const participant = room.getParticipant(user.id);
        if (!participant || !PermissionService.canChangeVideo(participant.getRole())) {
          socket.emit('error_event', {
            code: 'PERMISSION_DENIED',
            message: 'Permission denied: Only Host and Moderators can change the video.',
          });
          return;
        }

        const videoId = extractYouTubeVideoId(videoUrlOrId);
        if (!videoId) {
          socket.emit('error_event', {
            code: 'INVALID_VIDEO_URL',
            message: 'Invalid YouTube URL or Video ID.',
          });
          return;
        }

        const playbackState = room.getPlaybackManager().changeVideo(videoId, user.id, user.username);
        await this.roomService.persistPlaybackState(
          room.id,
          playbackState.videoId,
          playbackState.playState,
          playbackState.currentTime
        );

        this.io.to(`room:${room.id}`).emit('video_changed', {
          videoId,
          changedBy: user.username,
          state: playbackState,
        });
        this.io.to(`room:${room.id}`).emit('playback_updated', playbackState);
      });

      // 7. ASSIGN ROLE
      socket.on('assign_role', async ({ roomId, targetUserId, newRole }) => {
        const room = await this.roomService.getOrHydrateRoom(roomId);
        if (!room) return;

        const result = room.assignRole(user.id, targetUserId, newRole);
        if (!result.success || !result.targetParticipant) {
          socket.emit('error_event', {
            code: 'ROLE_ASSIGNMENT_FAILED',
            message: result.error || 'Failed to assign role.',
          });
          return;
        }

        await this.roomService.updateMembershipRole(room.id, targetUserId, newRole);

        this.io.to(`room:${room.id}`).emit('role_assigned', {
          targetUserId,
          targetUsername: result.targetParticipant.username,
          newRole,
          updatedBy: user.username,
        });
      });

      // 8. REMOVE PARTICIPANT
      socket.on('remove_participant', async ({ roomId, targetUserId }) => {
        const room = await this.roomService.getOrHydrateRoom(roomId);
        if (!room) return;

        const result = room.removeUserByHost(user.id, targetUserId);
        if (!result.success || !result.targetParticipant) {
          socket.emit('error_event', {
            code: 'REMOVE_PARTICIPANT_FAILED',
            message: result.error || 'Failed to remove participant.',
          });
          return;
        }

        await this.roomService.removeMembership(room.id, targetUserId);

        // Notify room
        this.io.to(`room:${room.id}`).emit('participant_removed', {
          targetUserId,
          reason: 'Removed by host',
        });

        // Find and disconnect target socket if connected
        const targetSockets = await this.io.in(`room:${room.id}`).fetchSockets();
        for (const s of targetSockets) {
          if (s.data.user?.id === targetUserId) {
            s.leave(`room:${room.id}`);
            s.data.currentRoomId = undefined;
            s.emit('error_event', {
              code: 'KICKED_FROM_ROOM',
              message: 'You have been removed from this room by the host.',
            });
          }
        }
      });

      // 9. TRANSFER HOST
      socket.on('transfer_host', async ({ roomId, targetUserId }) => {
        const room = await this.roomService.getOrHydrateRoom(roomId);
        if (!room) return;

        const result = room.transferHost(user.id, targetUserId);
        if (!result.success || !result.newHost || !result.previousHost) {
          socket.emit('error_event', {
            code: 'HOST_TRANSFER_FAILED',
            message: result.error || 'Failed to transfer host.',
          });
          return;
        }

        await this.roomService.persistHostTransfer(room.id, user.id, targetUserId);

        this.io.to(`room:${room.id}`).emit('host_transferred', {
          previousHostId: result.previousHost.userId,
          newHostId: result.newHost.userId,
          newHostUsername: result.newHost.username,
        });
      });

      // 10. SEND MESSAGE
      socket.on('send_message', async ({ roomId, text }) => {
        const room = await this.roomService.getOrHydrateRoom(roomId);
        if (!room) return;

        const participant = room.getParticipant(user.id);
        if (!participant || !PermissionService.canSendMessage(participant.getRole())) {
          socket.emit('error_event', {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to send messages.',
          });
          return;
        }

        const messageDto = room.getMessageHandler().addMessage(
          `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          room.id,
          user.id,
          user.username,
          text
        );

        if (!messageDto) {
          socket.emit('error_event', {
            code: 'MESSAGE_REJECTED',
            message: 'Message could not be sent (empty or rate limited).',
          });
          return;
        }

        // Persist message asynchronously
        this.roomService.persistChatMessage(room.id, user.id, messageDto.text);

        // Broadcast to all participants in the room
        this.io.to(`room:${room.id}`).emit('message_received', messageDto);
      });

      // 11. SEND REACTION
      socket.on('send_reaction', async ({ roomId, emoji }) => {
        const room = await this.roomService.getOrHydrateRoom(roomId);
        if (!room) return;

        const reactionDto = room.getReactionHandler().validateAndCreateReaction(
          `react_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          room.id,
          user.id,
          user.username,
          emoji
        );

        if (reactionDto) {
          this.io.to(`room:${room.id}`).emit('reaction_received', reactionDto);
        }
      });

      // 12. REQUEST SYNC
      socket.on('request_sync', async ({ roomId }) => {
        const room = await this.roomService.getOrHydrateRoom(roomId);
        if (room) {
          const statePayload = room.getRoomStatePayload(user.id);
          socket.emit('sync_state', statePayload);
        }
      });

      // 13. DISCONNECT
      socket.on('disconnect', async () => {
        console.log(`🔌 User disconnected: ${user.username} (${user.id})`);
        if (socket.data.currentRoomId) {
          await this.handleLeaveRoom(socket, socket.data.currentRoomId);
        }
      });
    });
  }

  private async handleLeaveRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    roomId: string
  ): Promise<void> {
    const user = socket.data.user;
    socket.leave(`room:${roomId}`);
    socket.data.currentRoomId = undefined;

    const room = this.roomService.getRoomManager().getRoom(roomId);
    if (room) {
      room.setParticipantOffline(user.id);
      this.io.to(`room:${roomId}`).emit('user_left', {
        userId: user.id,
        username: user.username,
      });
    }
  }

  public async close(): Promise<void> {
    if (this.redisPub) {
      await this.redisPub.quit();
    }
    if (this.redisSub) {
      await this.redisSub.quit();
    }
    await new Promise<void>((resolve) => this.io.close(() => resolve()));
  }
}
