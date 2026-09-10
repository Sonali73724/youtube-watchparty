import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaybackStateManager } from '../../src/domain/PlaybackStateManager';
import { PlayState, CONSTANTS } from '@watchparty/shared';

describe('PlaybackStateManager - Authoritative Playback Synchronization', () => {
  let manager: PlaybackStateManager;

  beforeEach(() => {
    vi.useRealTimers();
    manager = new PlaybackStateManager({
      videoId: 'test_video_1',
      playState: PlayState.PAUSED,
      currentTime: 10.0,
      serverUpdatedAt: Date.now(),
    });
  });

  it('should initialize with provided state', () => {
    expect(manager.getVideoId()).toBe('test_video_1');
    expect(manager.getPlayState()).toBe(PlayState.PAUSED);
    expect(manager.getCurrentTime()).toBe(10.0);
  });

  it('should transition to PLAYING and advance time based on elapsed clock', () => {
    const startTime = 1000000;
    vi.useFakeTimers();
    vi.setSystemTime(startTime);

    manager = new PlaybackStateManager({
      videoId: 'test_video_1',
      playState: PlayState.PAUSED,
      currentTime: 15.0,
      serverUpdatedAt: startTime,
    });

    // Play at 15.0s
    manager.play(15.0, 'user-1', 'Alice');
    expect(manager.getPlayState()).toBe(PlayState.PLAYING);

    // Fast-forward 5 seconds in real time
    vi.advanceTimersByTime(5000);

    expect(manager.getCurrentTime()).toBe(20.0);
    expect(manager.getStatePayload().currentTime).toBe(20.0);
    expect(manager.getStatePayload().playState).toBe(PlayState.PLAYING);
  });

  it('should transition to PAUSED and freeze playback time', () => {
    const startTime = 1000000;
    vi.useFakeTimers();
    vi.setSystemTime(startTime);

    manager = new PlaybackStateManager({
      videoId: 'test_video_1',
      playState: PlayState.PAUSED,
      currentTime: 0,
      serverUpdatedAt: startTime,
    });

    manager.play(0, 'user-1', 'Alice');
    vi.advanceTimersByTime(10000); // 10s elapsed

    manager.pause(10.0, 'user-1', 'Alice');
    expect(manager.getPlayState()).toBe(PlayState.PAUSED);

    // Advance more time while paused
    vi.advanceTimersByTime(5000);
    expect(manager.getCurrentTime()).toBe(10.0);
  });

  it('should apply seek correctly', () => {
    manager.seek(45.5, 'user-1', 'Alice');
    expect(manager.getCurrentTime()).toBe(45.5);
    expect(manager.getStatePayload().currentTime).toBe(45.5);
  });

  it('should reset time to 0 and pause when changing video', () => {
    manager.play(30.0);
    const result = manager.changeVideo('new_video_id_99', 'user-1', 'Alice');

    expect(result.videoId).toBe('new_video_id_99');
    expect(result.currentTime).toBe(0.0);
    expect(result.playState).toBe(PlayState.PAUSED);
    expect(manager.getVideoId()).toBe('new_video_id_99');
    expect(manager.getCurrentTime()).toBe(0.0);
  });

  it('should detect drift beyond MAX_ALLOWED_DRIFT_SECONDS', () => {
    manager = new PlaybackStateManager({
      videoId: 'test_video_1',
      playState: PlayState.PAUSED,
      currentTime: 20.0,
      serverUpdatedAt: Date.now(),
    });

    // Client at 20.5s -> drift 0.5s <= 1.5s threshold -> OK
    expect(manager.isDriftExceeded(20.5)).toBe(false);

    // Client at 22.0s -> drift 2.0s > 1.5s threshold -> DRIFT EXCEEDED
    expect(manager.isDriftExceeded(22.0)).toBe(true);

    // Client at 18.0s -> drift 2.0s > 1.5s threshold -> DRIFT EXCEEDED
    expect(manager.isDriftExceeded(18.0)).toBe(true);
  });
});
