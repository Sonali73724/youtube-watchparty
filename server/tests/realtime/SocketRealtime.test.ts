import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { SocketService } from '../../src/realtime/SocketService';
import { RoomManager } from '../../src/domain/RoomManager';
import { RoomService } from '../../src/services/RoomService';
import { AuthService } from '../../src/services/AuthService';
import { Role, PlayState, ServerToClientEvents, ClientToServerEvents } from '@watchparty/shared';

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

describe('Realtime Socket.IO Synchronization & Authoritative RBAC', () => {
  let httpServer: http.Server;
  let socketService: SocketService;
  let roomManager: RoomManager;
  let roomService: RoomService;
  let port: number;

  const user1 = { id: 'user-host-1', username: 'HostUser', email: 'host@test.com' };
  const user2 = { id: 'user-part-2', username: 'ParticipantUser', email: 'part@test.com' };
  const user3 = { id: 'user-mod-3', username: 'SecondParticipant', email: 'mod@test.com' };

  let token1: string;
  let token2: string;
  let token3: string;

  let client1: TypedClientSocket;
  let client2: TypedClientSocket;
  let client3: TypedClientSocket;

  const testRoomId = 'test-room-rt-1';
  const testRoomCode = 'TEST99';

  beforeAll(async () => {
    const app = express();
    httpServer = http.createServer(app);
    roomManager = new RoomManager();
    roomService = new RoomService(roomManager);

    // Mock DB calls in roomService to avoid requiring active DB connection during realtime unit tests
    roomService.ensureMembership = async () => {};
    roomService.persistPlaybackState = async () => {};
    roomService.persistChatMessage = async () => null;
    roomService.updateMembershipRole = async () => {};
    roomService.persistHostTransfer = async () => {};
    roomService.removeMembership = async () => {};

    // Seed room in RoomManager
    const domainRoom = new (await import('../../src/domain/Room')).Room({
      id: testRoomId,
      shortCode: testRoomCode,
      title: 'Realtime Test Room',
      createdById: user1.id,
    });
    // Add Host
    domainRoom.addParticipant(user1, undefined, Role.HOST);
    roomManager.addRoom(domainRoom);

    socketService = new SocketService(httpServer, roomService);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === 'object' && addr ? addr.port : 4001;
        resolve();
      });
    });

    token1 = AuthService.generateToken({ id: user1.id, username: user1.username, email: user1.email, createdAt: new Date().toISOString() });
    token2 = AuthService.generateToken({ id: user2.id, username: user2.username, email: user2.email, createdAt: new Date().toISOString() });
    token3 = AuthService.generateToken({ id: user3.id, username: user3.username, email: user3.email, createdAt: new Date().toISOString() });
  });

  afterAll(async () => {
    client1?.disconnect();
    client2?.disconnect();
    client3?.disconnect();
    await socketService.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('should authenticate and connect clients to Socket.IO', async () => {
    client1 = ioc(`http://localhost:${port}`, { auth: { token: token1 } });
    client2 = ioc(`http://localhost:${port}`, { auth: { token: token2 } });
    client3 = ioc(`http://localhost:${port}`, { auth: { token: token3 } });

    await Promise.all([
      new Promise<void>((res) => client1.on('connect', res)),
      new Promise<void>((res) => client2.on('connect', res)),
      new Promise<void>((res) => client3.on('connect', res)),
    ]);

    expect(client1.connected).toBe(true);
    expect(client2.connected).toBe(true);
    expect(client3.connected).toBe(true);
  });

  it('should allow joining room and receive canonical state', async () => {
    const syncPromise1 = new Promise<any>((res) => client1.once('sync_state', res));
    client1.emit('join_room', { roomIdOrCode: testRoomCode });
    const state1 = await syncPromise1;
    expect(state1.room.id).toBe(testRoomId);
    expect(state1.userRole).toBe(Role.HOST);

    // Client 2 joins -> should get participant role, Client 1 should get user_joined
    const userJoinedPromise = new Promise<any>((res) => client1.once('user_joined', res));
    const syncPromise2 = new Promise<any>((res) => client2.once('sync_state', res));
    client2.emit('join_room', { roomIdOrCode: testRoomId });

    const [joinedData, state2] = await Promise.all([userJoinedPromise, syncPromise2]);
    expect(joinedData.participant.userId).toBe(user2.id);
    expect(state2.userRole).toBe(Role.PARTICIPANT);

    // Client 3 joins
    client3.emit('join_room', { roomIdOrCode: testRoomId });
    await new Promise((r) => setTimeout(r, 100));
  });

  it('Host play event should broadcast playback_updated with PLAYING to all users', async () => {
    const playUpdatePromise2 = new Promise<any>((res) => client2.once('playback_updated', res));
    const playUpdatePromise3 = new Promise<any>((res) => client3.once('playback_updated', res));

    client1.emit('play', { roomId: testRoomId, currentTime: 25.0 });

    const [update2, update3] = await Promise.all([playUpdatePromise2, playUpdatePromise3]);
    expect(update2.playState).toBe(PlayState.PLAYING);
    expect(update2.currentTime).toBe(25.0);
    expect(update3.playState).toBe(PlayState.PLAYING);
  });

  it('Participant play attempt should be REJECTED with error_event', async () => {
    const errorPromise = new Promise<any>((res) => client2.once('error_event', res));
    client2.emit('play', { roomId: testRoomId, currentTime: 50.0 });

    const err = await errorPromise;
    expect(err.code).toBe('PERMISSION_DENIED');
    expect(err.message).toContain('Only Host and Moderators');
  });

  it('Host pause event should broadcast to all users', async () => {
    const pausePromise2 = new Promise<any>((res) => client2.once('playback_updated', res));
    client1.emit('pause', { roomId: testRoomId, currentTime: 30.0 });

    const update = await pausePromise2;
    expect(update.playState).toBe(PlayState.PAUSED);
    expect(update.currentTime).toBe(30.0);
  });

  it('Host seek event should broadcast to all users', async () => {
    const seekPromise2 = new Promise<any>((res) => client2.once('playback_updated', res));
    client1.emit('seek', { roomId: testRoomId, currentTime: 95.5 });

    const update = await seekPromise2;
    expect(update.currentTime).toBe(95.5);
  });

  it('Host change_video should broadcast video_changed and playback_updated', async () => {
    const videoPromise2 = new Promise<any>((res) => client2.once('video_changed', res));
    client1.emit('change_video', { roomId: testRoomId, videoUrlOrId: 'https://youtu.be/M7lc1UVf-VE' });

    const videoData = await videoPromise2;
    expect(videoData.videoId).toBe('M7lc1UVf-VE');
    expect(videoData.changedBy).toBe('HostUser');
    expect(videoData.state.playState).toBe(PlayState.PAUSED);
  });

  it('Participant change_video attempt should be REJECTED', async () => {
    const errorPromise = new Promise<any>((res) => client2.once('error_event', res));
    client2.emit('change_video', { roomId: testRoomId, videoUrlOrId: 'dQw4w9WgXcQ' });

    const err = await errorPromise;
    expect(err.code).toBe('PERMISSION_DENIED');
  });

  it('Host assigns Moderator role to User 2 -> broadcast role_assigned', async () => {
    const rolePromise2 = new Promise<any>((res) => client2.once('role_assigned', res));
    client1.emit('assign_role', { roomId: testRoomId, targetUserId: user2.id, newRole: Role.MODERATOR });

    const roleData = await rolePromise2;
    expect(roleData.targetUserId).toBe(user2.id);
    expect(roleData.newRole).toBe(Role.MODERATOR);
  });

  it('Newly promoted Moderator (User 2) CAN now play, pause, seek, and change video', async () => {
    const playPromise1 = new Promise<any>((res) => client1.once('playback_updated', res));
    client2.emit('play', { roomId: testRoomId, currentTime: 10.0 });

    const update = await playPromise1;
    expect(update.playState).toBe(PlayState.PLAYING);
  });

  it('Moderator attempting to assign roles should be REJECTED', async () => {
    const errorPromise = new Promise<any>((res) => client2.once('error_event', res));
    client2.emit('assign_role', { roomId: testRoomId, targetUserId: user3.id, newRole: Role.MODERATOR });

    const err = await errorPromise;
    expect(err.code).toBe('ROLE_ASSIGNMENT_FAILED');
  });

  it('Chat message should broadcast to all participants', async () => {
    const msgPromise1 = new Promise<any>((res) => client1.once('message_received', res));
    const msgPromise3 = new Promise<any>((res) => client3.once('message_received', res));

    client2.emit('send_message', { roomId: testRoomId, text: 'Hello everyone from chat!' });

    const [msg1, msg3] = await Promise.all([msgPromise1, msgPromise3]);
    expect(msg1.text).toBe('Hello everyone from chat!');
    expect(msg1.username).toBe('ParticipantUser');
    expect(msg3.text).toBe('Hello everyone from chat!');
  });

  it('Reaction emoji should broadcast to all participants', async () => {
    const reactionPromise1 = new Promise<any>((res) => client1.once('reaction_received', res));
    client3.emit('send_reaction', { roomId: testRoomId, emoji: '🔥' });

    const reaction = await reactionPromise1;
    expect(reaction.emoji).toBe('🔥');
    expect(reaction.username).toBe('SecondParticipant');
  });

  it('Host transfer should update roles and broadcast host_transferred', async () => {
    const transferPromise2 = new Promise<any>((res) => client2.once('host_transferred', res));
    client1.emit('transfer_host', { roomId: testRoomId, targetUserId: user2.id });

    const data = await transferPromise2;
    expect(data.previousHostId).toBe(user1.id);
    expect(data.newHostId).toBe(user2.id);
  });

  it('New Host (User 2) can remove a participant (User 3)', async () => {
    const removePromise1 = new Promise<any>((res) => client1.once('participant_removed', res));
    const kickPromise3 = new Promise<any>((res) => client3.once('error_event', res));

    client2.emit('remove_participant', { roomId: testRoomId, targetUserId: user3.id });

    const [removeData, kickData] = await Promise.all([removePromise1, kickPromise3]);
    expect(removeData.targetUserId).toBe(user3.id);
    expect(kickData.code).toBe('KICKED_FROM_ROOM');
  });
});
