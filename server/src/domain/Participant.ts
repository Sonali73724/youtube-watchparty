import { Role, RoomParticipantDTO } from '@watchparty/shared';

export interface ParticipantProps {
  userId: string;
  username: string;
  email?: string;
  role?: Role;
  socketId?: string;
  joinedAt?: Date;
  isOnline?: boolean;
}

export class Participant {
  public readonly userId: string;
  public readonly username: string;
  public readonly email?: string;
  private role: Role;
  private socketId?: string;
  public readonly joinedAt: Date;
  private isOnline: boolean;
  private lastSeenAt: Date;

  constructor(props: ParticipantProps) {
    this.userId = props.userId;
    this.username = props.username;
    this.email = props.email;
    this.role = props.role || Role.PARTICIPANT;
    this.socketId = props.socketId;
    this.joinedAt = props.joinedAt || new Date();
    this.isOnline = props.isOnline !== undefined ? props.isOnline : true;
    this.lastSeenAt = new Date();
  }

  public getRole(): Role {
    return this.role;
  }

  public setRole(newRole: Role): void {
    this.role = newRole;
  }

  public getSocketId(): string | undefined {
    return this.socketId;
  }

  public setSocketId(socketId?: string): void {
    this.socketId = socketId;
    if (socketId) {
      this.isOnline = true;
    }
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public setOnline(isOnline: boolean): void {
    this.isOnline = isOnline;
    this.lastSeenAt = new Date();
  }

  public touch(): void {
    this.lastSeenAt = new Date();
  }

  public getLastSeenAt(): Date {
    return this.lastSeenAt;
  }

  public toDTO(): RoomParticipantDTO {
    return {
      userId: this.userId,
      username: this.username,
      role: this.role,
      joinedAt: this.joinedAt.toISOString(),
      isOnline: this.isOnline,
    };
  }
}
