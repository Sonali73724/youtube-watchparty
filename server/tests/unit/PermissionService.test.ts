import { describe, it, expect } from 'vitest';
import { PermissionService } from '../../src/domain/PermissionService';
import { Role } from '@watchparty/shared';

describe('PermissionService - Authoritative RBAC Matrix', () => {
  describe('Playback Controls (Play, Pause, Seek, Change Video)', () => {
    it('should allow HOST to control playback', () => {
      expect(PermissionService.canPlay(Role.HOST)).toBe(true);
      expect(PermissionService.canPause(Role.HOST)).toBe(true);
      expect(PermissionService.canSeek(Role.HOST)).toBe(true);
      expect(PermissionService.canChangeVideo(Role.HOST)).toBe(true);
    });

    it('should allow MODERATOR to control playback', () => {
      expect(PermissionService.canPlay(Role.MODERATOR)).toBe(true);
      expect(PermissionService.canPause(Role.MODERATOR)).toBe(true);
      expect(PermissionService.canSeek(Role.MODERATOR)).toBe(true);
      expect(PermissionService.canChangeVideo(Role.MODERATOR)).toBe(true);
    });

    it('should REJECT PARTICIPANT from controlling playback', () => {
      expect(PermissionService.canPlay(Role.PARTICIPANT)).toBe(false);
      expect(PermissionService.canPause(Role.PARTICIPANT)).toBe(false);
      expect(PermissionService.canSeek(Role.PARTICIPANT)).toBe(false);
      expect(PermissionService.canChangeVideo(Role.PARTICIPANT)).toBe(false);
    });

    it('should reject unauthenticated / undefined role from controlling playback', () => {
      expect(PermissionService.canPlay(undefined)).toBe(false);
      expect(PermissionService.canPause(undefined)).toBe(false);
      expect(PermissionService.canSeek(undefined)).toBe(false);
      expect(PermissionService.canChangeVideo(undefined)).toBe(false);
    });
  });

  describe('Role Management', () => {
    it('should allow HOST to assign MODERATOR or PARTICIPANT', () => {
      expect(PermissionService.canAssignRole(Role.HOST, Role.MODERATOR)).toBe(true);
      expect(PermissionService.canAssignRole(Role.HOST, Role.PARTICIPANT)).toBe(true);
    });

    it('should NOT allow HOST to assign HOST via assignRole (must use transferHost)', () => {
      expect(PermissionService.canAssignRole(Role.HOST, Role.HOST)).toBe(false);
    });

    it('should REJECT MODERATOR and PARTICIPANT from assigning roles', () => {
      expect(PermissionService.canAssignRole(Role.MODERATOR, Role.MODERATOR)).toBe(false);
      expect(PermissionService.canAssignRole(Role.MODERATOR, Role.PARTICIPANT)).toBe(false);
      expect(PermissionService.canAssignRole(Role.PARTICIPANT, Role.MODERATOR)).toBe(false);
    });
  });

  describe('Participant Removal', () => {
    it('should allow HOST to remove PARTICIPANT or MODERATOR', () => {
      expect(PermissionService.canRemoveParticipant(Role.HOST, Role.PARTICIPANT)).toBe(true);
      expect(PermissionService.canRemoveParticipant(Role.HOST, Role.MODERATOR)).toBe(true);
    });

    it('should NOT allow removing another HOST', () => {
      expect(PermissionService.canRemoveParticipant(Role.HOST, Role.HOST)).toBe(false);
    });

    it('should REJECT MODERATOR and PARTICIPANT from removing participants', () => {
      expect(PermissionService.canRemoveParticipant(Role.MODERATOR, Role.PARTICIPANT)).toBe(false);
      expect(PermissionService.canRemoveParticipant(Role.PARTICIPANT, Role.PARTICIPANT)).toBe(false);
    });
  });

  describe('Host Transfer', () => {
    it('should allow only HOST to initiate host transfer', () => {
      expect(PermissionService.canTransferHost(Role.HOST)).toBe(true);
      expect(PermissionService.canTransferHost(Role.MODERATOR)).toBe(false);
      expect(PermissionService.canTransferHost(Role.PARTICIPANT)).toBe(false);
      expect(PermissionService.canTransferHost(undefined)).toBe(false);
    });
  });

  describe('Chat and Reactions', () => {
    it('should allow HOST, MODERATOR, and PARTICIPANT to chat and react', () => {
      expect(PermissionService.canSendMessage(Role.HOST)).toBe(true);
      expect(PermissionService.canSendMessage(Role.MODERATOR)).toBe(true);
      expect(PermissionService.canSendMessage(Role.PARTICIPANT)).toBe(true);

      expect(PermissionService.canSendReaction(Role.HOST)).toBe(true);
      expect(PermissionService.canSendReaction(Role.MODERATOR)).toBe(true);
      expect(PermissionService.canSendReaction(Role.PARTICIPANT)).toBe(true);
    });
  });
});
