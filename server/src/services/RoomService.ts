import { prisma, isDbConnected } from '../db';
import { Room } from '../domain/Room';
import { RoomManager } from '../domain/RoomManager';
import { AuthService } from './AuthService';
import { PlayState, Role, generateRoomCode, CONSTANTS, ChatMessageDTO } from '@watchparty/shared';

export class RoomService {
  private roomManager: RoomManager;

  constructor(roomManager: RoomManager) {
    this.roomManager = roomManager;
  }

  public getRoomManager(): RoomManager {
    return this.roomManager;
  }

  /**
   * Creates a new room persistently or in memory
   */
  public async createRoom(userId: string, title?: string, initialVideoId?: string): Promise<Room> {
    const user = await AuthService.getUserById(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    let shortCode = generateRoomCode();
    const roomTitle = (title && title.trim()) ? title.trim().slice(0, CONSTANTS.MAX_ROOM_TITLE_LENGTH) : `${user.username}'s Watch Party`;
    const videoId = initialVideoId || CONSTANTS.DEFAULT_VIDEO_ID;
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (isDbConnected) {
      try {
        let attempts = 0;
        while (attempts < 5) {
          const existing = await prisma.room.findUnique({ where: { shortCode } });
          if (!existing) break;
          shortCode = generateRoomCode();
          attempts++;
        }

        const dbRoom = await prisma.room.create({
          data: {
            shortCode,
            title: roomTitle,
            createdById: userId,
            currentVideoId: videoId,
            playState: PlayState.PAUSED,
            currentTime: 0.0,
            lastStateUpdateAt: new Date(),
            memberships: {
              create: {
                userId,
                role: Role.HOST,
              },
            },
          },
        });

        const domainRoom = new Room({
          id: dbRoom.id,
          shortCode: dbRoom.shortCode,
          title: dbRoom.title,
          createdById: dbRoom.createdById,
          createdAt: dbRoom.createdAt,
          initialPlayback: {
            videoId: dbRoom.currentVideoId,
            playState: dbRoom.playState as PlayState,
            currentTime: dbRoom.currentTime,
            serverUpdatedAt: dbRoom.lastStateUpdateAt.getTime(),
          },
        });

        domainRoom.addParticipant(
          { id: user.id, username: user.username, email: user.email },
          undefined,
          Role.HOST
        );

        this.roomManager.addRoom(domainRoom);
        return domainRoom;
      } catch (err) {
        console.warn('⚠️ DB createRoom failed, falling back to in-memory domain room:', (err as Error).message);
      }
    }

    // In-memory creation fallback
    const domainRoom = new Room({
      id: roomId,
      shortCode,
      title: roomTitle,
      createdById: userId,
      createdAt: new Date(),
      initialPlayback: {
        videoId,
        playState: PlayState.PAUSED,
        currentTime: 0.0,
        serverUpdatedAt: Date.now(),
      },
    });

    domainRoom.addParticipant(
      { id: user.id, username: user.username, email: user.email },
      undefined,
      Role.HOST
    );

    this.roomManager.addRoom(domainRoom);
    return domainRoom;
  }

  /**
   * Finds or hydrates room from database
   */
  public async getOrHydrateRoom(roomIdOrCode: string): Promise<Room | null> {
    // 1. Check in-memory manager first
    const cachedRoom = this.roomManager.getRoomByIdOrCode(roomIdOrCode);
    if (cachedRoom) {
      return cachedRoom;
    }

    // 2. Hydrate from PostgreSQL database if connected
    if (isDbConnected) {
      try {
        const dbRoom = await prisma.room.findFirst({
          where: {
            OR: [
              { id: roomIdOrCode },
              { shortCode: roomIdOrCode.toUpperCase() },
            ],
          },
          include: {
            createdBy: true,
            memberships: {
              include: {
                user: true,
              },
            },
            messages: {
              take: CONSTANTS.MAX_CHAT_HISTORY_LIMIT,
              orderBy: { createdAt: 'asc' },
              include: {
                user: true,
              },
            },
          },
        });

        if (dbRoom) {
          const domainRoom = new Room({
            id: dbRoom.id,
            shortCode: dbRoom.shortCode,
            title: dbRoom.title,
            createdById: dbRoom.createdById,
            createdAt: dbRoom.createdAt,
            initialPlayback: {
              videoId: dbRoom.currentVideoId,
              playState: dbRoom.playState as PlayState,
              currentTime: dbRoom.currentTime,
              serverUpdatedAt: dbRoom.lastStateUpdateAt.getTime(),
            },
          });

          for (const membership of dbRoom.memberships) {
            domainRoom.addParticipant(
              {
                id: membership.user.id,
                username: membership.user.username,
                email: membership.user.email,
              },
              undefined,
              membership.role as Role
            );
            domainRoom.setParticipantOffline(membership.userId);
          }

          const chatDtos: ChatMessageDTO[] = dbRoom.messages.map((m: any) => ({
            id: m.id,
            roomId: m.roomId,
            userId: m.userId,
            username: m.user.username,
            text: m.text,
            createdAt: m.createdAt.toISOString(),
          }));
          domainRoom.getMessageHandler().seedHistory(chatDtos);

          this.roomManager.addRoom(domainRoom);
          return domainRoom;
        }
      } catch (err) {
        console.warn('⚠️ DB getOrHydrateRoom failed:', (err as Error).message);
      }
    }

    return null;
  }

  /**
   * Ensures a user has a membership record
   */
  public async ensureMembership(roomId: string, userId: string, role: Role = Role.PARTICIPANT): Promise<void> {
    if (!isDbConnected) return;
    try {
      await prisma.roomMembership.upsert({
        where: {
          userId_roomId: {
            userId,
            roomId,
          },
        },
        update: {
          lastSeenAt: new Date(),
        },
        create: {
          roomId,
          userId,
          role,
        },
      });
    } catch {}
  }

  /**
   * Persists authoritative playback state changes
   */
  public async persistPlaybackState(
    roomId: string,
    videoId: string,
    playState: PlayState,
    currentTime: number
  ): Promise<void> {
    if (!isDbConnected) return;
    try {
      await prisma.room.update({
        where: { id: roomId },
        data: {
          currentVideoId: videoId,
          playState,
          currentTime,
          lastStateUpdateAt: new Date(),
        },
      });
    } catch {}
  }

  /**
   * Saves and persists a chat message
   */
  public async persistChatMessage(
    roomId: string,
    userId: string,
    text: string
  ): Promise<ChatMessageDTO | null> {
    if (!isDbConnected) return null;
    try {
      const msg = await prisma.chatMessage.create({
        data: {
          roomId,
          userId,
          text,
        },
        include: {
          user: true,
        },
      });

      return {
        id: msg.id,
        roomId: msg.roomId,
        userId: msg.userId,
        username: msg.user.username,
        text: msg.text,
        createdAt: msg.createdAt.toISOString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Updates a user's role
   */
  public async updateMembershipRole(roomId: string, userId: string, role: Role): Promise<void> {
    if (!isDbConnected) return;
    try {
      await prisma.roomMembership.update({
        where: {
          userId_roomId: {
            userId,
            roomId,
          },
        },
        data: { role },
      });
    } catch {}
  }

  /**
   * Handles host transfer persistence
   */
  public async persistHostTransfer(roomId: string, previousHostId: string, newHostId: string): Promise<void> {
    if (!isDbConnected) return;
    try {
      await prisma.$transaction([
        prisma.roomMembership.update({
          where: { userId_roomId: { userId: previousHostId, roomId } },
          data: { role: Role.PARTICIPANT },
        }),
        prisma.roomMembership.update({
          where: { userId_roomId: { userId: newHostId, roomId } },
          data: { role: Role.HOST },
        }),
      ]);
    } catch {}
  }

  /**
   * Removes membership on kick
   */
  public async removeMembership(roomId: string, userId: string): Promise<void> {
    if (!isDbConnected) return;
    try {
      await prisma.roomMembership.deleteMany({
        where: {
          roomId,
          userId,
        },
      });
    } catch {}
  }

  /**
   * Returns active rooms for a user
   */
  public async getUserRooms(userId: string) {
    if (isDbConnected) {
      try {
        const memberships = await prisma.roomMembership.findMany({
          where: { userId },
          include: {
            room: {
              include: {
                createdBy: {
                  select: { id: true, username: true },
                },
                _count: {
                  select: { memberships: true },
                },
              },
            },
          },
          orderBy: { lastSeenAt: 'desc' },
          take: 20,
        });

        return memberships.map((m: any) => ({
          id: m.room.id,
          shortCode: m.room.shortCode,
          title: m.room.title,
          currentVideoId: m.room.currentVideoId,
          playState: m.room.playState,
          role: m.role,
          creator: m.room.createdBy.username,
          participantCount: m.room._count.memberships,
          createdAt: m.room.createdAt.toISOString(),
          lastSeenAt: m.lastSeenAt.toISOString(),
        }));
      } catch {}
    }

    // In-memory fallback
    const allRooms = this.roomManager.getAllRooms();
    const userRooms = allRooms.filter((r) => r.getParticipant(userId) || r.createdById === userId);

    return userRooms.map((r) => {
      const p = r.getParticipant(userId);
      const host = r.getHost();
      return {
        id: r.id,
        shortCode: r.shortCode,
        title: r.title,
        currentVideoId: r.getPlaybackManager().getVideoId(),
        playState: r.getPlaybackManager().getPlayState(),
        role: p ? p.getRole() : Role.PARTICIPANT,
        creator: host ? host.username : 'Unknown',
        participantCount: r.getParticipantsList().length,
        createdAt: r.createdAt.toISOString(),
        lastSeenAt: new Date().toISOString(),
      };
    });
  }
}
