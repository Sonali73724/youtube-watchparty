import { describe, it, expect, beforeEach } from 'vitest';
import { Room } from '../../src/domain/Room';
import { Role, PlayState } from '@watchparty/shared';

describe('Room Aggregate Root & Domain Logic', () => {
  let room: Room;
  const hostUser = { id: 'host-1', username: 'HostAlice', email: 'alice@example.com' };
  const participant1 = { id: 'part-1', username: 'Bob', email: 'bob@example.com' };
  const participant2 = { id: 'part-2', username: 'Charlie', email: 'charlie@example.com' };

  beforeEach(() => {
    room = new Room({
      id: 'room-123',
      shortCode: 'PARTY1',
      title: 'Movie Night',
      createdById: hostUser.id,
    });
    // Add creator as HOST
    room.addParticipant(hostUser, 'socket-host', Role.HOST);
  });

  it('should initialize room with creator as HOST', () => {
    expect(room.id).toBe('room-123');
    expect(room.shortCode).toBe('PARTY1');
    expect(room.createdById).toBe(hostUser.id);
    const host = room.getHost();
    expect(host).toBeDefined();
    expect(host?.userId).toBe(hostUser.id);
    expect(host?.getRole()).toBe(Role.HOST);
  });

  it('should default new joiners to PARTICIPANT role', () => {
    const p = room.addParticipant(participant1, 'socket-bob');
    expect(p.getRole()).toBe(Role.PARTICIPANT);
    expect(p.getSocketId()).toBe('socket-bob');
    expect(p.getIsOnline()).toBe(true);
  });

  it('should allow Host to promote a Participant to MODERATOR', () => {
    room.addParticipant(participant1, 'socket-bob');

    const result = room.assignRole(hostUser.id, participant1.id, Role.MODERATOR);
    expect(result.success).toBe(true);
    expect(room.getParticipant(participant1.id)?.getRole()).toBe(Role.MODERATOR);
  });

  it('should REJECT Moderator attempting to promote another user', () => {
    room.addParticipant(participant1, 'socket-bob', Role.MODERATOR);
    room.addParticipant(participant2, 'socket-charlie', Role.PARTICIPANT);

    const result = room.assignRole(participant1.id, participant2.id, Role.MODERATOR);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission denied');
  });

  it('should transfer host properly and demote previous host', () => {
    room.addParticipant(participant1, 'socket-bob');

    const result = room.transferHost(hostUser.id, participant1.id);
    expect(result.success).toBe(true);

    const newHost = room.getHost();
    expect(newHost?.userId).toBe(participant1.id);
    expect(newHost?.getRole()).toBe(Role.HOST);

    // Alice should now be PARTICIPANT
    expect(room.getParticipant(hostUser.id)?.getRole()).toBe(Role.PARTICIPANT);
  });

  it('should allow Host to remove a participant', () => {
    room.addParticipant(participant1, 'socket-bob');
    expect(room.getParticipant(participant1.id)).toBeDefined();

    const result = room.removeUserByHost(hostUser.id, participant1.id);
    expect(result.success).toBe(true);
    expect(room.getParticipant(participant1.id)).toBeUndefined();
  });

  it('should prevent Host from removing themselves', () => {
    const result = room.removeUserByHost(hostUser.id, hostUser.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Host cannot remove themselves');
  });

  it('should handle chat messages and ring-buffer history', () => {
    const msgHandler = room.getMessageHandler();
    const msg1 = msgHandler.addMessage('m1', room.id, hostUser.id, hostUser.username, 'Welcome everyone!');
    expect(msg1).not.toBeNull();
    expect(msg1?.text).toBe('Welcome everyone!');

    const history = msgHandler.getRecentMessages();
    expect(history.length).toBe(1);
    expect(history[0].text).toBe('Welcome everyone!');
  });

  it('should handle reactions and reject invalid emojis', () => {
    const reactionHandler = room.getReactionHandler();
    const valid = reactionHandler.validateAndCreateReaction('r1', room.id, hostUser.id, hostUser.username, '🔥');
    expect(valid).not.toBeNull();
    expect(valid?.emoji).toBe('🔥');

    const invalid = reactionHandler.validateAndCreateReaction('r2', room.id, hostUser.id, hostUser.username, '👽');
    expect(invalid).toBeNull();
  });

  it('should generate complete RoomStatePayload for client hydration', () => {
    room.addParticipant(participant1, 'socket-bob');
    const state = room.getRoomStatePayload(participant1.id);

    expect(state.room.id).toBe('room-123');
    expect(state.room.shortCode).toBe('PARTY1');
    expect(state.playback.playState).toBe(PlayState.PAUSED);
    expect(state.participants.length).toBe(2);
    expect(state.userRole).toBe(Role.PARTICIPANT);
  });
});
