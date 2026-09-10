import { PlayState, PlaybackStatePayload, CONSTANTS } from '@watchparty/shared';

export interface PlaybackStateProps {
  videoId?: string;
  playState?: PlayState;
  currentTime?: number;
  serverUpdatedAt?: number;
  updatedByUserId?: string;
  updatedByUsername?: string;
}

export class PlaybackStateManager {
  private videoId: string;
  private playState: PlayState;
  private currentTime: number; // in seconds
  private serverUpdatedAt: number; // Unix timestamp in ms
  private updatedByUserId?: string;
  private updatedByUsername?: string;

  constructor(initial?: PlaybackStateProps) {
    this.videoId = initial?.videoId || CONSTANTS.DEFAULT_VIDEO_ID;
    this.playState = initial?.playState || PlayState.PAUSED;
    this.currentTime = Math.max(0, initial?.currentTime || 0);
    this.serverUpdatedAt = initial?.serverUpdatedAt || Date.now();
    this.updatedByUserId = initial?.updatedByUserId;
    this.updatedByUsername = initial?.updatedByUsername;
  }

  /**
   * Calculates the authoritative current playback time in seconds.
   * If playing, accounts for elapsed real time since the last server update.
   */
  public getCurrentTime(): number {
    if (this.playState === PlayState.PLAYING) {
      const elapsedMs = Math.max(0, Date.now() - this.serverUpdatedAt);
      const elapsedSec = elapsedMs / 1000;
      return this.currentTime + elapsedSec;
    }
    return this.currentTime;
  }

  public getVideoId(): string {
    return this.videoId;
  }

  public getPlayState(): PlayState {
    return this.playState;
  }

  public getServerUpdatedAt(): number {
    return this.serverUpdatedAt;
  }

  /**
   * Applies an authoritative Play event
   */
  public play(clientTime?: number, userId?: string, username?: string): PlaybackStatePayload {
    const time = typeof clientTime === 'number' && !isNaN(clientTime) && clientTime >= 0
      ? clientTime
      : this.getCurrentTime();

    this.currentTime = Math.max(0, time);
    this.playState = PlayState.PLAYING;
    this.serverUpdatedAt = Date.now();
    this.updatedByUserId = userId;
    this.updatedByUsername = username;

    return this.getStatePayload();
  }

  /**
   * Applies an authoritative Pause event
   */
  public pause(clientTime?: number, userId?: string, username?: string): PlaybackStatePayload {
    const time = typeof clientTime === 'number' && !isNaN(clientTime) && clientTime >= 0
      ? clientTime
      : this.getCurrentTime();

    this.currentTime = Math.max(0, time);
    this.playState = PlayState.PAUSED;
    this.serverUpdatedAt = Date.now();
    this.updatedByUserId = userId;
    this.updatedByUsername = username;

    return this.getStatePayload();
  }

  /**
   * Applies an authoritative Seek event
   */
  public seek(targetTime: number, userId?: string, username?: string): PlaybackStatePayload {
    const validTime = Math.max(0, isNaN(targetTime) ? 0 : targetTime);
    this.currentTime = validTime;
    this.serverUpdatedAt = Date.now();
    this.updatedByUserId = userId;
    this.updatedByUsername = username;

    return this.getStatePayload();
  }

  /**
   * Changes the video ID, resets playback time to 0, and sets state to PAUSED
   */
  public changeVideo(newVideoId: string, userId?: string, username?: string): PlaybackStatePayload {
    this.videoId = newVideoId;
    this.currentTime = 0;
    this.playState = PlayState.PAUSED;
    this.serverUpdatedAt = Date.now();
    this.updatedByUserId = userId;
    this.updatedByUsername = username;

    return this.getStatePayload();
  }

  /**
   * Checks if a client's reported time has drifted beyond acceptable threshold
   */
  public isDriftExceeded(clientTime: number, threshold: number = CONSTANTS.MAX_ALLOWED_DRIFT_SECONDS): boolean {
    const authoritativeTime = this.getCurrentTime();
    return Math.abs(clientTime - authoritativeTime) > threshold;
  }

  /**
   * Returns canonical state snapshot
   */
  public getStatePayload(): PlaybackStatePayload {
    return {
      videoId: this.videoId,
      playState: this.playState,
      currentTime: Number(this.getCurrentTime().toFixed(2)),
      serverUpdatedAt: this.serverUpdatedAt,
      updatedByUserId: this.updatedByUserId,
      updatedByUsername: this.updatedByUsername,
    };
  }
}
