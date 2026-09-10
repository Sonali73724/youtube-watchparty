import { Role } from '@watchparty/shared';

export class PermissionService {
  /**
   * Playback Mutation Permissions
   */
  public static canPlay(role?: Role): boolean {
    return role === Role.HOST || role === Role.MODERATOR;
  }

  public static canPause(role?: Role): boolean {
    return role === Role.HOST || role === Role.MODERATOR;
  }

  public static canSeek(role?: Role): boolean {
    return role === Role.HOST || role === Role.MODERATOR;
  }

  public static canChangeVideo(role?: Role): boolean {
    return role === Role.HOST || role === Role.MODERATOR;
  }

  /**
   * Role Management Permissions
   */
  public static canAssignRole(actingRole?: Role, targetRole?: Role): boolean {
    if (actingRole !== Role.HOST) {
      return false;
    }
    // Host can assign MODERATOR or PARTICIPANT (HOST transfer has its own dedicated method)
    return targetRole === Role.MODERATOR || targetRole === Role.PARTICIPANT;
  }

  /**
   * Participant Removal Permissions
   */
  public static canRemoveParticipant(actingRole?: Role, targetParticipantRole?: Role): boolean {
    if (actingRole !== Role.HOST) {
      return false;
    }
    // Host cannot kick another host
    return targetParticipantRole !== Role.HOST;
  }

  /**
   * Host Transfer Permissions
   */
  public static canTransferHost(actingRole?: Role): boolean {
    return actingRole === Role.HOST;
  }

  /**
   * Communication Permissions
   */
  public static canSendMessage(role?: Role): boolean {
    return role === Role.HOST || role === Role.MODERATOR || role === Role.PARTICIPANT;
  }

  public static canSendReaction(role?: Role): boolean {
    return role === Role.HOST || role === Role.MODERATOR || role === Role.PARTICIPANT;
  }
}
