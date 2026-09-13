import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Role,
  PlayState,
  RoomStatePayload,
  RoomParticipantDTO,
  ChatMessageDTO,
  ReactionDTO,
  PlaybackStatePayload,
  CONSTANTS,
} from '@watchparty/shared';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import { CustomControls } from '../components/room/CustomControls';
import { ChatPanel } from '../components/room/ChatPanel';
import { ParticipantsPanel } from '../components/room/ParticipantsPanel';
import { ReactionsOverlay } from '../components/room/ReactionsOverlay';

export const RoomPage: React.FC = () => {
  const { idOrCode } = useParams<{ idOrCode: string }>();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Room State
  const [roomData, setRoomData] = useState<RoomStatePayload['room'] | null>(null);
  const [userRole, setUserRole] = useState<Role>(Role.PARTICIPANT);
  const [participants, setParticipants] = useState<RoomParticipantDTO[]>([]);
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [currentPlayState, setCurrentPlayState] = useState<PlayState>(PlayState.PAUSED);
  const [currentVideoId, setCurrentVideoId] = useState<string>(CONSTANTS.DEFAULT_VIDEO_ID);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [latestReaction, setLatestReaction] = useState<ReactionDTO | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Keep latest references
  const roomDataRef = useRef<RoomStatePayload['room'] | null>(null);
  const userRoleRef = useRef<Role>(Role.PARTICIPANT);
  const userRef = useRef(user);
  const latestPlaybackRef = useRef<{ playState: PlayState; currentTime: number; serverUpdatedAt: number }>({
    playState: PlayState.PAUSED,
    currentTime: 0,
    serverUpdatedAt: Date.now(),
  });

  useEffect(() => {
    roomDataRef.current = roomData;
    userRoleRef.current = userRole;
    userRef.current = user;
  }, [roomData, userRole, user]);

  // Local Action Callbacks for YouTube Player
  const handleLocalPlay = useCallback((time: number) => {
    if (!socket || !roomDataRef.current) return;
    const role = userRoleRef.current;
    if (role === Role.HOST || role === Role.MODERATOR) {
      socket.emit('play', { roomId: roomDataRef.current.id, currentTime: time });
    }
  }, [socket]);

  const handleLocalPause = useCallback((time: number) => {
    if (!socket || !roomDataRef.current) return;
    const role = userRoleRef.current;
    if (role === Role.HOST || role === Role.MODERATOR) {
      socket.emit('pause', { roomId: roomDataRef.current.id, currentTime: time });
    }
  }, [socket]);

  // YouTube Player Hook
  const {
    isReady,
    loadVideo,
    applyRemoteState,
    playVideo,
    pauseVideo,
    seekTo,
    getCurrentTime: getPlayerCurrentTime,
    getDuration: getPlayerDuration,
  } = useYouTubePlayer({
    elementId: 'yt-player-container',
    initialVideoId: currentVideoId,
    onLocalPlay: handleLocalPlay,
    onLocalPause: handleLocalPause,
    onPlayerError: (code) => {
      if (code === 150 || code === 101) {
        showToast('This video cannot be played in embedded players due to YouTube restrictions. Please change the video.', 'error');
      } else if (code === 2 || code === 100) {
        showToast('Invalid or deleted YouTube video ID.', 'error');
      }
    },
  });

  // Track player time updates locally for smooth slider
  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(() => {
      const t = getPlayerCurrentTime();
      const d = getPlayerDuration();
      setCurrentTime(t);
      if (d > 0) setDuration(d);
    }, 400);

    return () => clearInterval(interval);
  }, [isReady, getPlayerCurrentTime, getPlayerDuration]);

  // Join Room & Register Realtime Listeners
  useEffect(() => {
    if (!socket || !idOrCode) return;

    // Emit join_room once
    socket.emit('join_room', { roomIdOrCode: idOrCode }, (response) => {
      if (!response.success || !response.data) {
        showToast(response.error || 'Failed to join room', 'error');
        navigate('/dashboard');
      }
    });

    // 1. Sync State
    const handleSyncState = (payload: RoomStatePayload) => {
      setRoomData(payload.room);
      setUserRole(payload.userRole);
      setParticipants(payload.participants);
      setMessages(payload.recentMessages);
      setCurrentPlayState(payload.playback.playState);
      setCurrentVideoId(payload.playback.videoId);
      setLoading(false);

      latestPlaybackRef.current = {
        playState: payload.playback.playState,
        currentTime: payload.playback.currentTime,
        serverUpdatedAt: payload.playback.serverUpdatedAt,
      };

      let authoritativeTime = payload.playback.currentTime;
      if (payload.playback.playState === PlayState.PLAYING) {
        const elapsed = (Date.now() - payload.playback.serverUpdatedAt) / 1000;
        authoritativeTime += Math.max(0, elapsed);
      }

      applyRemoteState(payload.playback.playState, authoritativeTime, payload.playback.videoId);
    };

    // 2. Playback Updated
    const handlePlaybackUpdated = (payload: PlaybackStatePayload) => {
      setCurrentPlayState(payload.playState);

      latestPlaybackRef.current = {
        playState: payload.playState,
        currentTime: payload.currentTime,
        serverUpdatedAt: payload.serverUpdatedAt,
      };

      let targetTime = payload.currentTime;
      if (payload.playState === PlayState.PLAYING) {
        const elapsed = (Date.now() - payload.serverUpdatedAt) / 1000;
        targetTime += Math.max(0, elapsed);
      }

      applyRemoteState(payload.playState, targetTime, payload.videoId);
    };

    // 3. Video Changed
    const handleVideoChanged = (payload: { videoId: string; changedBy: string; state: PlaybackStatePayload }) => {
      setCurrentVideoId(payload.videoId);
      loadVideo(payload.videoId, 0);
      showToast(`${payload.changedBy} changed the video.`, 'info');
    };

    // 4. User Joined
    const handleUserJoined = (payload: { participant: RoomParticipantDTO; message?: string }) => {
      setParticipants((prev) => {
        const exists = prev.find((p) => p.userId === payload.participant.userId);
        if (exists) {
          return prev.map((p) => (p.userId === payload.participant.userId ? payload.participant : p));
        }
        return [...prev, payload.participant];
      });
      if (payload.message) {
        showToast(payload.message, 'info');
      }
    };

    // 5. User Left
    const handleUserLeft = (payload: { userId: string; username: string }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.userId === payload.userId ? { ...p, isOnline: false } : p))
      );
    };

    // 6. Role Assigned
    const handleRoleAssigned = (payload: { targetUserId: string; targetUsername: string; newRole: Role; updatedBy: string }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.userId === payload.targetUserId ? { ...p, role: payload.newRole } : p))
      );
      if (payload.targetUserId === userRef.current?.id) {
        setUserRole(payload.newRole);
        showToast(`You have been promoted to ${payload.newRole}!`, 'success');
      } else {
        showToast(`${payload.targetUsername} was assigned ${payload.newRole}`, 'info');
      }
    };

    // 7. Participant Removed
    const handleParticipantRemoved = (payload: { targetUserId: string; reason?: string }) => {
      if (payload.targetUserId === userRef.current?.id) {
        showToast('You have been removed from this room by the host.', 'error');
        navigate('/dashboard');
        return;
      }
      setParticipants((prev) => prev.filter((p) => p.userId !== payload.targetUserId));
    };

    // 8. Host Transferred
    const handleHostTransferred = (payload: { previousHostId: string; newHostId: string; newHostUsername: string }) => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.userId === payload.previousHostId) return { ...p, role: Role.PARTICIPANT };
          if (p.userId === payload.newHostId) return { ...p, role: Role.HOST };
          return p;
        })
      );

      if (payload.newHostId === userRef.current?.id) {
        setUserRole(Role.HOST);
        showToast('You are now the Host of this watch party!', 'success');
      } else if (payload.previousHostId === userRef.current?.id) {
        setUserRole(Role.PARTICIPANT);
        showToast(`Host transferred to ${payload.newHostUsername}`, 'info');
      } else {
        showToast(`${payload.newHostUsername} is now the Host`, 'info');
      }
    };

    // 9. Message Received
    const handleMessageReceived = (msg: ChatMessageDTO) => {
      setMessages((prev) => [...prev, msg]);
    };

    // 10. Reaction Received
    const handleReactionReceived = (reaction: ReactionDTO) => {
      setLatestReaction(reaction);
    };

    // 11. Error Event
    const handleErrorEvent = (err: { code: string; message: string }) => {
      if (err.code === 'KICKED_FROM_ROOM') {
        showToast(err.message, 'error');
        navigate('/dashboard');
      } else {
        showToast(err.message, 'error');
      }
    };

    socket.on('sync_state', handleSyncState);
    socket.on('playback_updated', handlePlaybackUpdated);
    socket.on('video_changed', handleVideoChanged);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('role_assigned', handleRoleAssigned);
    socket.on('participant_removed', handleParticipantRemoved);
    socket.on('host_transferred', handleHostTransferred);
    socket.on('message_received', handleMessageReceived);
    socket.on('reaction_received', handleReactionReceived);
    socket.on('error_event', handleErrorEvent);

    return () => {
      socket.off('sync_state', handleSyncState);
      socket.off('playback_updated', handlePlaybackUpdated);
      socket.off('video_changed', handleVideoChanged);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('role_assigned', handleRoleAssigned);
      socket.off('participant_removed', handleParticipantRemoved);
      socket.off('host_transferred', handleHostTransferred);
      socket.off('message_received', handleMessageReceived);
      socket.off('reaction_received', handleReactionReceived);
      socket.off('error_event', handleErrorEvent);

      if (roomDataRef.current) {
        socket.emit('leave_room', { roomId: roomDataRef.current.id });
      }
    };
  }, [socket, idOrCode, applyRemoteState, loadVideo, navigate, showToast]);

  // Host / Moderator Playback Actions
  const handlePlay = () => {
    playVideo();
    if (!socket || !roomDataRef.current) return;
    const time = getPlayerCurrentTime();
    socket.emit('play', { roomId: roomDataRef.current.id, currentTime: time });
  };

  const handlePause = () => {
    pauseVideo();
    if (!socket || !roomDataRef.current) return;
    const time = getPlayerCurrentTime();
    socket.emit('pause', { roomId: roomDataRef.current.id, currentTime: time });
  };

  const handleSeek = (time: number) => {
    seekTo(time, true);
    if (!socket || !roomDataRef.current) return;
    socket.emit('seek', { roomId: roomDataRef.current.id, currentTime: time });
  };

  const handleChangeVideo = (urlOrId: string) => {
    if (!socket || !roomDataRef.current) return;
    socket.emit('change_video', { roomId: roomDataRef.current.id, videoUrlOrId: urlOrId });
  };

  const handleResync = () => {
    const { playState, currentTime: baseTime, serverUpdatedAt } = latestPlaybackRef.current;
    let targetTime = baseTime;
    if (playState === PlayState.PLAYING) {
      const elapsed = (Date.now() - serverUpdatedAt) / 1000;
      targetTime += Math.max(0, elapsed);
    }

    seekTo(targetTime, true);
    if (playState === PlayState.PLAYING) {
      playVideo();
    } else {
      pauseVideo();
    }

    if (socket && roomDataRef.current) {
      socket.emit('request_sync', { roomId: roomDataRef.current.id });
    }
    showToast(`Synced to ${Math.floor(targetTime)}s!`, 'info');
  };

  // Host Management Actions
  const handleAssignRole = (targetUserId: string, newRole: Role) => {
    if (!socket || !roomDataRef.current) return;
    socket.emit('assign_role', { roomId: roomDataRef.current.id, targetUserId, newRole });
  };

  const handleTransferHost = (targetUserId: string) => {
    if (!socket || !roomDataRef.current) return;
    socket.emit('transfer_host', { roomId: roomDataRef.current.id, targetUserId });
  };

  const handleRemoveParticipant = (targetUserId: string) => {
    if (!socket || !roomDataRef.current) return;
    socket.emit('remove_participant', { roomId: roomDataRef.current.id, targetUserId });
  };

  // Chat & Reaction Actions
  const handleSendMessage = (text: string) => {
    if (!socket || !roomDataRef.current) return;
    socket.emit('send_message', { roomId: roomDataRef.current.id, text });
  };

  const handleSendReaction = (emoji: string) => {
    if (!socket || !roomDataRef.current) return;
    socket.emit('send_reaction', { roomId: roomDataRef.current.id, emoji });
  };

  const copyRoomCode = () => {
    if (!roomData) return;
    navigator.clipboard.writeText(roomData.shortCode);
    setCopiedCode(true);
    showToast(`Room code ${roomData.shortCode} copied!`, 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyShareLink = () => {
    if (!roomData) return;
    const url = `${window.location.origin}/room/${roomData.shortCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast('Shareable party link copied!', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const canControl = userRole === Role.HOST || userRole === Role.MODERATOR;

  return (
    <div className="room">
      {/* MAIN STAGE */}
      <section className="stage-col">
        <div className="stage-head">
          <div className="room-title">
            <h1>{roomData?.title || 'Watch Room'}</h1>
            <button
              type="button"
              onClick={copyRoomCode}
              className="code-chip"
              title="Click to copy room code"
              style={{ cursor: 'pointer' }}
            >
              Room · {roomData?.shortCode || idOrCode} {copiedCode ? '✓' : ''}
            </button>
          </div>
          <div className="stage-head__actions">
            <button type="button" className="btn-ghost" onClick={copyShareLink}>
              {copiedLink ? 'Copied link!' : 'Copy invite'}
            </button>
            {canControl && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowVideoModal(true)}
              >
                Change video
              </button>
            )}
          </div>
        </div>

        {/* Video Player */}
        <div className="player">
          <div id="yt-player-container" className="w-full h-full" />

          {loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 30,
                background: 'rgba(18, 12, 7, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid var(--hair)',
                  borderTopColor: 'var(--gold)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--paper-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                Connecting to room...
              </p>
            </div>
          )}

          <ReactionsOverlay
            incomingReaction={latestReaction}
            onSendReaction={handleSendReaction}
          />
        </div>

        {/* Custom Controls */}
        <CustomControls
          playState={currentPlayState}
          currentTime={currentTime}
          duration={duration}
          userRole={userRole}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          onChangeVideo={handleChangeVideo}
          onResync={handleResync}
          showVideoModal={showVideoModal}
          setShowVideoModal={setShowVideoModal}
        />

        {/* Role Queue Note from design/room.html */}
        <div className="queue-note">
          <span className="role-tag">
            {userRole === Role.HOST ? 'Host' : userRole === Role.MODERATOR ? 'Moderator' : 'Viewer'}
          </span>
          <span>
            {userRole === Role.HOST
              ? 'You control play, pause, seek and video changes for this room.'
              : userRole === Role.MODERATOR
              ? 'You have moderator controls for playback and video selection.'
              : 'You are viewing in synchronized mode with the host.'}
          </span>
        </div>
      </section>

      {/* SIDEBAR */}
      <aside className="side">
        <ParticipantsPanel
          participants={participants}
          userRole={userRole}
          onAssignRole={handleAssignRole}
          onTransferHost={handleTransferHost}
          onRemoveParticipant={handleRemoveParticipant}
        />
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
        />
      </aside>
    </div>
  );
};
