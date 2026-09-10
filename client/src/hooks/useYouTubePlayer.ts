import { useEffect, useRef, useState, useCallback } from 'react';
import { PlayState } from '@watchparty/shared';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface UseYouTubePlayerProps {
  elementId: string;
  initialVideoId: string;
  onLocalPlay?: (time: number) => void;
  onLocalPause?: (time: number) => void;
  onLocalSeek?: (time: number) => void;
  onPlayerError?: (errorCode: number) => void;
}

export function useYouTubePlayer({
  elementId,
  initialVideoId,
  onLocalPlay,
  onLocalPause,
  onPlayerError,
}: UseYouTubePlayerProps) {
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [currentVideoId, setCurrentVideoId] = useState<string>(initialVideoId);
  const currentVideoIdRef = useRef<string>(initialVideoId);
  const isRemoteUpdateRef = useRef<boolean>(false);
  const lastKnownTimeRef = useRef<number>(0);
  const pendingStateRef = useRef<{ playState: PlayState; targetTime: number; videoId?: string } | null>(null);

  // Store latest callbacks in refs so player event listener never captures stale closures
  const onLocalPlayRef = useRef(onLocalPlay);
  const onLocalPauseRef = useRef(onLocalPause);
  const onPlayerErrorRef = useRef(onPlayerError);
  useEffect(() => {
    onLocalPlayRef.current = onLocalPlay;
    onLocalPauseRef.current = onLocalPause;
    onPlayerErrorRef.current = onPlayerError;
  }, [onLocalPlay, onLocalPause, onPlayerError]);

  // Load YouTube IFrame API
  useEffect(() => {
    let checkInterval: any = null;

    function initPlayer() {
      if (playerRef.current) return;
      const container = document.getElementById(elementId);
      if (!container || !window.YT || !window.YT.Player) return;

      // Always create a fresh target child div inside container to prevent React DOM removal on destroy()
      container.innerHTML = '';
      const targetDiv = document.createElement('div');
      const targetId = `${elementId}-yt-target-${Date.now()}`;
      targetDiv.id = targetId;
      container.appendChild(targetDiv);

      const safeOrigin = typeof window !== 'undefined' ? window.location.origin : '';

      playerRef.current = new window.YT.Player(targetId, {
        host: 'https://www.youtube.com',
        videoId: currentVideoIdRef.current,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: safeOrigin,
        },
        events: {
          onReady: () => {
            setIsReady(true);
            // Apply any pending remote sync state that arrived while player was initializing
            if (pendingStateRef.current) {
              const { playState, targetTime, videoId } = pendingStateRef.current;
              pendingStateRef.current = null;
              executeRemoteState(playState, targetTime, videoId);
            } else if (playerRef.current && playerRef.current.cueVideoById) {
              try {
                playerRef.current.cueVideoById({
                  videoId: currentVideoIdRef.current,
                  startSeconds: 0,
                });
              } catch {}
            }
          },
          onStateChange: (event: any) => {
            if (!playerRef.current) return;
            const state = event.data;

            // If triggered by a remote sync command, suppress local broadcast
            if (isRemoteUpdateRef.current) {
              isRemoteUpdateRef.current = false;
              return;
            }

            const time = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
            lastKnownTimeRef.current = time;

            // YT.PlayerState.PLAYING === 1
            if (state === 1 && onLocalPlayRef.current) {
              onLocalPlayRef.current(time);
            }
            // YT.PlayerState.PAUSED === 2
            else if (state === 2 && onLocalPauseRef.current) {
              onLocalPauseRef.current(time);
            }
          },
          onError: (event: any) => {
            console.warn('⚠️ YouTube Player Error Code:', event.data);
            if (onPlayerErrorRef.current) {
              onPlayerErrorRef.current(event.data);
            }
          },
        },
      });
    }

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.getElementById('youtube-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const prevOnReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevOnReady) prevOnReady();
        initPlayer();
      };

      checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player && !playerRef.current) {
          initPlayer();
          if (checkInterval) clearInterval(checkInterval);
        }
      }, 200);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, [elementId]);

  /**
   * Internal helper to execute state application on ready player
   */
  const executeRemoteState = (playState: PlayState, targetTime: number, videoId?: string) => {
    if (!playerRef.current) return;

    // 1. Handle video switch if needed
    if (videoId && videoId !== currentVideoIdRef.current) {
      currentVideoIdRef.current = videoId;
      setCurrentVideoId(videoId);
      isRemoteUpdateRef.current = true;
      if (playerRef.current.loadVideoById) {
        playerRef.current.loadVideoById({
          videoId,
          startSeconds: Math.max(0, targetTime),
        });
      }
      if (playState === PlayState.PLAYING) {
        try { playerRef.current.playVideo?.(); } catch {}
      } else {
        try { playerRef.current.pauseVideo?.(); } catch {}
      }
      return;
    }

    // 2. Reconcile timestamp drift
    const currentTime = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
    const drift = Math.abs(currentTime - targetTime);

    if (drift > 1.2) {
      isRemoteUpdateRef.current = true;
      if (playerRef.current.seekTo) {
        playerRef.current.seekTo(Math.max(0, targetTime), true);
      }
    }

    // 3. Apply Play / Pause state
    const currentYtState = playerRef.current.getPlayerState ? playerRef.current.getPlayerState() : -1;

    if (playState === PlayState.PLAYING) {
      if (currentYtState !== 1) {
        isRemoteUpdateRef.current = true;
        try {
          const promise = playerRef.current.playVideo?.();
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {
              // Autoplay policy prevented playback until user interaction
            });
          }
        } catch {}
      }
    } else if (playState === PlayState.PAUSED) {
      if (currentYtState !== 2) {
        isRemoteUpdateRef.current = true;
        try { playerRef.current.pauseVideo?.(); } catch {}
      }
    }
  };

  /**
   * Remote Sync: Apply video change from server
   */
  const loadVideo = useCallback((videoId: string, startSeconds: number = 0) => {
    currentVideoIdRef.current = videoId;
    setCurrentVideoId(videoId);

    if (!playerRef.current || !isReady) {
      pendingStateRef.current = {
        playState: PlayState.PAUSED,
        targetTime: startSeconds,
        videoId,
      };
      return;
    }

    isRemoteUpdateRef.current = true;
    if (playerRef.current.loadVideoById) {
      playerRef.current.loadVideoById({
        videoId,
        startSeconds,
      });
    }
  }, [isReady]);

  /**
   * Remote Sync: Apply authoritative playback state
   */
  const applyRemoteState = useCallback((playState: PlayState, targetTime: number, videoId?: string) => {
    if (!playerRef.current || !isReady) {
      // Save pending state to be applied when onReady fires
      pendingStateRef.current = { playState, targetTime, videoId };
      return;
    }

    executeRemoteState(playState, targetTime, videoId);
  }, [isReady]);

  /**
   * Programmatic user actions
   */
  const playVideo = useCallback(() => {
    if (!playerRef.current) return;
    isRemoteUpdateRef.current = true;
    try { playerRef.current.playVideo?.(); } catch {}
  }, []);

  const pauseVideo = useCallback(() => {
    if (!playerRef.current) return;
    isRemoteUpdateRef.current = true;
    try { playerRef.current.pauseVideo?.(); } catch {}
  }, []);

  const seekTo = useCallback((seconds: number, isRemote: boolean = false) => {
    if (!playerRef.current) return;
    if (isRemote) {
      isRemoteUpdateRef.current = true;
    }
    try { playerRef.current.seekTo?.(Math.max(0, seconds), true); } catch {}
  }, []);

  const getCurrentTime = useCallback((): number => {
    if (!playerRef.current) return 0;
    return playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
  }, []);

  const getDuration = useCallback((): number => {
    if (!playerRef.current) return 0;
    return playerRef.current.getDuration ? playerRef.current.getDuration() : 0;
  }, []);

  return {
    isReady,
    currentVideoId,
    loadVideo,
    applyRemoteState,
    playVideo,
    pauseVideo,
    seekTo,
    getCurrentTime,
    getDuration,
  };
}
