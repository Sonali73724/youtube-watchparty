import React, { useState, useRef } from 'react';
import { PlayState, Role, extractYouTubeVideoId } from '@watchparty/shared';

interface CustomControlsProps {
  playState: PlayState;
  currentTime: number;
  duration: number;
  userRole: Role;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onChangeVideo: (urlOrId: string) => void;
  onResync: () => void;
  showVideoModal?: boolean;
  setShowVideoModal?: (show: boolean) => void;
}

function formatTime(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const CustomControls: React.FC<CustomControlsProps> = ({
  playState,
  currentTime,
  duration,
  userRole,
  onPlay,
  onPause,
  onSeek,
  onChangeVideo,
  onResync,
  showVideoModal: controlledModal,
  setShowVideoModal: controlledSetModal,
}) => {
  const [internalModal, setInternalModal] = useState(false);
  const [videoInput, setVideoInput] = useState('');
  const [inputError, setInputError] = useState('');
  const progressBarRef = useRef<HTMLDivElement>(null);

  const showVideoModal = controlledModal !== undefined ? controlledModal : internalModal;
  const setShowVideoModal = controlledSetModal || setInternalModal;

  const canControl = userRole === Role.HOST || userRole === Role.MODERATOR;

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canControl || !progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(percent * duration);
  };

  const handleVideoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const extracted = extractYouTubeVideoId(videoInput);
    if (!extracted) {
      setInputError('Please enter a valid YouTube URL (watch, youtu.be, shorts) or 11-char ID.');
      return;
    }

    onChangeVideo(videoInput.trim());
    setVideoInput('');
    setInputError('');
    setShowVideoModal(false);
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <>
      <div className="controls">
        {/* Play / Pause Toggle */}
        <button
          type="button"
          className="controls__play"
          onClick={canControl ? (playState === PlayState.PLAYING ? onPause : onPlay) : undefined}
          title={canControl ? (playState === PlayState.PLAYING ? 'Pause' : 'Play') : 'Viewer Mode (Read-only)'}
          style={{ opacity: canControl ? 1 : 0.6, cursor: canControl ? 'pointer' : 'default' }}
        >
          {playState === PlayState.PLAYING ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1.5" y="1" width="3" height="10" fill="#221A08" />
              <rect x="7.5" y="1" width="3" height="10" fill="#221A08" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 1.5L10 6L2.5 10.5V1.5Z" fill="#221A08" />
            </svg>
          )}
        </button>

        {/* Time display */}
        <span className="controls__time">
          {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : '--:--'}
        </span>

        {/* Progress Bar */}
        <div
          ref={progressBarRef}
          className="controls__bar"
          onClick={handleBarClick}
          title={canControl ? 'Click to seek' : 'Viewer Mode'}
          style={{ cursor: canControl ? 'pointer' : 'default' }}
        >
          <span style={{ width: `${progressPercent}%` }}></span>
        </div>

        {/* Re-sync Button */}
        <button
          type="button"
          onClick={onResync}
          className="controls__vol btn-ghost"
          style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem' }}
          title="Force re-sync with server"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M13.6 8A5.6 5.6 0 1 1 12 4L13.5 2.5V6.5H9.5L11 5A4 4 0 1 0 12 8"
              stroke="#D3BE9A"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Sync</span>
        </button>
      </div>

      {/* Change Video Modal */}
      {showVideoModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            backgroundColor: 'rgba(18, 12, 7, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: '1.2rem', color: 'var(--paper)' }}>
                Change Room Video
              </h3>
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--paper-dim)',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVideoSubmit}>
              <label className="field">
                <span>YouTube URL or Video ID</span>
                <input
                  type="text"
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoInput}
                  onChange={(e) => {
                    setVideoInput(e.target.value);
                    setInputError('');
                  }}
                  autoFocus
                />
              </label>

              {inputError && (
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--err)' }}>
                  {inputError}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setShowVideoModal(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gold">
                  Load Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
