export enum Role {
  HOST = 'HOST',
  MODERATOR = 'MODERATOR',
  PARTICIPANT = 'PARTICIPANT'
}

export enum PlayState {
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  BUFFERING = 'BUFFERING',
  ENDED = 'ENDED'
}

export interface UserDTO {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: UserDTO;
  token: string;
}

export interface RoomParticipantDTO {
  userId: string;
  username: string;
  role: Role;
  joinedAt: string;
  isOnline: boolean;
}

export interface PlaybackStatePayload {
  videoId: string;
  playState: PlayState;
  currentTime: number;
  serverUpdatedAt: number; // Unix timestamp in ms
  updatedByUserId?: string;
  updatedByUsername?: string;
}

export interface ChatMessageDTO {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}

export interface ReactionDTO {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  emoji: string;
  createdAt: string;
}

export interface RoomStatePayload {
  room: {
    id: string;
    shortCode: string;
    title: string;
    createdById: string;
    createdAt: string;
  };
  playback: PlaybackStatePayload;
  participants: RoomParticipantDTO[];
  recentMessages: ChatMessageDTO[];
  userRole: Role;
}

export interface SocketResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Client to Server Events
export interface ClientToServerEvents {
  join_room: (payload: { roomIdOrCode: string }, callback?: (response: SocketResponse<RoomStatePayload>) => void) => void;
  leave_room: (payload: { roomId: string }) => void;
  play: (payload: { roomId: string; currentTime: number }) => void;
  pause: (payload: { roomId: string; currentTime: number }) => void;
  seek: (payload: { roomId: string; currentTime: number }) => void;
  change_video: (payload: { roomId: string; videoUrlOrId: string }) => void;
  assign_role: (payload: { roomId: string; targetUserId: string; newRole: Role }) => void;
  remove_participant: (payload: { roomId: string; targetUserId: string }) => void;
  transfer_host: (payload: { roomId: string; targetUserId: string }) => void;
  send_message: (payload: { roomId: string; text: string }) => void;
  send_reaction: (payload: { roomId: string; emoji: string }) => void;
  request_sync: (payload: { roomId: string }) => void;
}

// Server to Client Events
export interface ServerToClientEvents {
  sync_state: (payload: RoomStatePayload) => void;
  user_joined: (payload: { participant: RoomParticipantDTO; message?: string }) => void;
  user_left: (payload: { userId: string; username: string }) => void;
  role_assigned: (payload: { targetUserId: string; targetUsername: string; newRole: Role; updatedBy: string }) => void;
  participant_removed: (payload: { targetUserId: string; reason?: string }) => void;
  playback_updated: (payload: PlaybackStatePayload) => void;
  video_changed: (payload: { videoId: string; changedBy: string; state: PlaybackStatePayload }) => void;
  message_received: (payload: ChatMessageDTO) => void;
  reaction_received: (payload: ReactionDTO) => void;
  host_transferred: (payload: { previousHostId: string; newHostId: string; newHostUsername: string }) => void;
  error_event: (payload: { code: string; message: string; details?: unknown }) => void;
}

// Inter-server Events for Redis adapter
export interface InterServerEvents {
  ping: () => void;
}

// Socket Data
export interface SocketData {
  user: {
    id: string;
    username: string;
    email: string;
  };
  currentRoomId?: string;
}
