import { Role, RoomParticipantDTO, RoomStatePayload } from '@watchparty/shared';
import { PlaybackStateManager, PlaybackStateProps } from './PlaybackStateManager';
import { Participant, ParticipantProps } from './Participant';
import { MessageHandler } from './MessageHandler';
import { ReactionHandler } from './ReactionHandler';
import { PermissionService } from './PermissionService';

export interface RoomProps {
  id: string;
  shortCode: string;
  title: string;
  createdById: string;
  createdAt?: Date;
  initialPlayback?: PlaybackStateProps;
}

export class Room {
  public readonly id: string;
  public readonly shortCode: string;
  public title: string;
  public readonly createdById: string;
  public readonly createdAt: Date;

  private playbackManager: PlaybackStateManager;
  private participants: Map<string, Participant> = new Map();
  private messageHandler: MessageHandler;
  private reactionHandler: ReactionHandler;

  constructor(props: RoomProps) {
    this.id = props.id;
    this.shortCode = props.shortCode;
    this.title = props.title;
    this.createdById = props.createdById;
    this.createdAt = props.createdAt || new Date();

    this.playbackManager = new PlaybackStateManager(props.initialPlayback);
    this.messageHandler = new MessageHandler();
    this.reactionHandler = new ReactionHandler();
  }

  public getPlaybackManager(): PlaybackStateManager {
    return this.playbackManager;
  }

  public getMessageHandler(): MessageHandler {
    return this.messageHandler;
  }

  public getReactionHandler(): ReactionHandler {
    return this.reactionHandler;
  }

  /**
   * Adds or re-activates a participant in the room
   */
  public addParticipant(
    user: { id: string; username: string; email?: string },
    socketId?: string,
    roleOverride?: Role
  ): Participant {
    const existing = this.participants.get(user.id);
    if (existing) {
      existing.setSocketId(socketId);
      existing.setOnline(true);
      if (roleOverride) {
        existing.setRole(roleOverride);
      }
      return existing;
    }

    // Default role: if user is room creator, they are HOST; otherwise default to PARTICIPANT
    const assignedRole = roleOverride || (user.id === this.createdById ? Role.HOST : Role.PARTICIPANT);
    const newParticipant = new Participant({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: assignedRole,
      socketId,
      isOnline: true,
    });

    this.participants.set(user.id, newParticipant);
    return newParticipant;
  }

  /**
   * Disconnects or removes a participant
   */
  public setParticipantOffline(userId: string): Participant | undefined {
    const participant = this.participants.get(userId);
    if (participant) {
      participant.setOnline(false);
      participant.setSocketId(undefined);
    }
    return participant;
  }

  public removeParticipant(userId: string): Participant | undefined {
    const participant = this.participants.get(userId);
    if (participant) {
      this.participants.delete(userId);
    }
    return participant;
  }

  public getParticipant(userId: string): Participant | undefined {
    return this.participants.get(userId);
  }

  public getParticipantBySocketId(socketId: string): Participant | undefined {
    for (const participant of this.participants.values()) {
      if (participant.getSocketId() === socketId) {
        return participant;
      }
    }
    return undefined;
  }

  public getParticipantsList(): RoomParticipantDTO[] {
    return Array.from(this.participants.values()).map(p => p.toDTO());
  }

  public getHost(): Participant | undefined {
    for (const participant of this.participants.values()) {
      if (participant.getRole() === Role.HOST) {
        return participant;
      }
    }
    return undefined;
  }

  /**
   * Assigns a role to a participant with RBAC enforcement
   */
  public assignRole(
    actingUserId: string,
    targetUserId: string,
    newRole: Role
  ): { success: boolean; error?: string; targetParticipant?: Participant } {
    const actingParticipant = this.participants.get(actingUserId);
    const targetParticipant = this.participants.get(targetUserId);

    if (!actingParticipant || !targetParticipant) {
      return { success: false, error: 'User or target participant not found in room.' };
    }

    if (!PermissionService.canAssignRole(actingParticipant.getRole(), newRole)) {
      return { success: false, error: 'Permission denied: Only the room HOST can assign roles.' };
    }

    if (targetParticipant.getRole() === Role.HOST) {
      return { success: false, error: 'Cannot change the role of the current host directly. Use transfer host instead.' };
    }

    targetParticipant.setRole(newRole);
    return { success: true, targetParticipant };
  }

  /**
   * Transfers HOST role from current host to another participant
   */
  public transferHost(
    actingUserId: string,
    targetUserId: string
  ): { success: boolean; error?: string; previousHost?: Participant; newHost?: Participant } {
    const actingParticipant = this.participants.get(actingUserId);
    const targetParticipant = this.participants.get(targetUserId);

    if (!actingParticipant || !targetParticipant) {
      return { success: false, error: 'User or target participant not found in room.' };
    }

    if (!PermissionService.canTransferHost(actingParticipant.getRole())) {
      return { success: false, error: 'Permission denied: Only the current HOST can transfer host privileges.' };
    }

    if (actingUserId === targetUserId) {
      return { success: false, error: 'Cannot transfer host to yourself.' };
    }

    // Demote current host to PARTICIPANT (or MODERATOR, PARTICIPANT is safe default)
    actingParticipant.setRole(Role.PARTICIPANT);
    targetParticipant.setRole(Role.HOST);

    return {
      success: true,
      previousHost: actingParticipant,
      newHost: targetParticipant,
    };
  }

  /**
   * Removes a participant with RBAC enforcement
   */
  public removeUserByHost(
    actingUserId: string,
    targetUserId: string
  ): { success: boolean; error?: string; targetParticipant?: Participant } {
    const actingParticipant = this.participants.get(actingUserId);
    const targetParticipant = this.participants.get(targetUserId);

    if (!actingParticipant || !targetParticipant) {
      return { success: false, error: 'User or target participant not found in room.' };
    }

    if (actingUserId === targetUserId) {
      return { success: false, error: 'Host cannot remove themselves from the room.' };
    }

    if (!PermissionService.canRemoveParticipant(actingParticipant.getRole(), targetParticipant.getRole())) {
      return { success: false, error: 'Permission denied: You do not have permission to remove this participant.' };
    }

    this.participants.delete(targetUserId);
    return { success: true, targetParticipant };
  }

  /**
   * Produces the canonical RoomStatePayload for a given client
   */
  public getRoomStatePayload(forUserId: string): RoomStatePayload {
    const participant = this.participants.get(forUserId);
    const userRole = participant ? participant.getRole() : Role.PARTICIPANT;

    return {
      room: {
        id: this.id,
        shortCode: this.shortCode,
        title: this.title,
        createdById: this.createdById,
        createdAt: this.createdAt.toISOString(),
      },
      playback: this.playbackManager.getStatePayload(),
      participants: this.getParticipantsList(),
      recentMessages: this.messageHandler.getRecentMessages(),
      userRole,
    };
  }
}
