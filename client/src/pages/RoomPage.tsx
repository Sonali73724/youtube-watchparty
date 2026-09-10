import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Check, LogOut, Crown, Shield } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(true);

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

  // Join Room & Register Realtime Listeners (Only runs once per socket/room mount)
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

  // Host / Moderator Playback Actions (Direct User Gestures + Socket Broadcast)
  const handlePlay = () => {
    playVideo(); // Direct local player action for gesture policy
    if (!socket || !roomDataRef.current) return;
    const time = getPlayerCurrentTime();
    socket.emit('play', { roomId: roomDataRef.current.id, currentTime: time });
  };

  const handlePause = () => {
    pauseVideo(); // Direct local pause
    if (!socket || !roomDataRef.current) return;
    const time = getPlayerCurrentTime();
    socket.emit('pause', { roomId: roomDataRef.current.id, currentTime: time });
  };

  const handleSeek = (time: number) => {
    seekTo(time, true); // Direct local seek
    if (!socket || !roomDataRef.current) return;
    socket.emit('seek', { roomId: roomDataRef.current.id, currentTime: time });
  };

  const handleChangeVideo = (urlOrId: string) => {
    if (!socket || !roomDataRef.current) return;
    socket.emit('change_video', { roomId: roomDataRef.current.id, videoUrlOrId: urlOrId });
  };

  const handleResync = () => {
    // Immediately calculate latest authoritative time and apply
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
    showToast(`Room code ${roomData.shortCode} copied to clipboard!`, 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyShareLink = () => {
    if (!roomData) return;
    const url = `${window.location.origin}/room/${roomData.shortCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast('Shareable party link copied to clipboard!', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-400">Connecting to Watch Party...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Room Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-xl font-extrabold text-white">
                {roomData?.title || 'Watch Party'}
              </h1>
              {userRole === Role.HOST && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                  Host
                </span>
              )}
              {userRole === Role.MODERATOR && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  <Shield className="w-3 h-3 text-sky-400" />
                  Moderator
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              <span>Code:</span>
              <button
                onClick={copyRoomCode}
                className="flex items-center gap-1 font-mono font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30 transition-colors"
                title="Click to copy code"
              >
                <span>{roomData?.shortCode}</span>
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyShareLink}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition-all shadow-md"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Copy Invite Link</span>
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-xs font-medium text-slate-400 border border-slate-700/80 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Video + Controls (Left) and Chat + Participants (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* Left Column: Video Player, Custom Controls, Reactions */}
        <div className="lg:col-span-8 space-y-4">
          {/* Video Container (16:9 Aspect Ratio) */}
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black border border-slate-800 shadow-2xl aspect-video group w-full">
            {/* Embedded YouTube Player IFrame Target */}
            <div id="yt-player-container" className="w-full h-full" />

            {/* Floating Reactions Overlay */}
            <ReactionsOverlay
              incomingReaction={latestReaction}
              onSendReaction={handleSendReaction}
            />
          </div>

          {/* Synchronized Custom Controls Bar */}
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
          />
        </div>

        {/* Right Column: Tabbed Chat & Participants */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          {/* Tab Buttons */}
          <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'chat'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Chat ({messages.length})
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'participants'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Participants ({participants.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="h-[460px] sm:h-[500px] lg:h-[540px]">
            {activeTab === 'chat' ? (
              <ChatPanel messages={messages} onSendMessage={handleSendMessage} />
            ) : (
              <ParticipantsPanel
                participants={participants}
                userRole={userRole}
                onAssignRole={handleAssignRole}
                onTransferHost={handleTransferHost}
                onRemoveParticipant={handleRemoveParticipant}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
