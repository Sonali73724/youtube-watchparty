import React, { useState } from 'react';
import { Play, Pause, Link as LinkIcon, ShieldAlert, Check, RefreshCw } from 'lucide-react';
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
}) => {
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoInput, setVideoInput] = useState('');
  const [inputError, setInputError] = useState('');

  const canControl = userRole === Role.HOST || userRole === Role.MODERATOR;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canControl) return;
    const target = parseFloat(e.target.value);
    onSeek(target);
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

  return (
    <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 border border-slate-800 shadow-xl flex flex-col gap-3">
      {/* Progress & Time */}
      <div className="flex items-center gap-3 w-full">
        <span className="text-xs font-mono text-slate-400 min-w-[40px] text-right">
          {formatTime(currentTime)}
        </span>
        <div className="flex-1 relative group flex items-center">
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 100}
            step={0.5}
            value={currentTime}
            onChange={handleSeekChange}
            disabled={!canControl}
            className={`w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500 transition-all ${
              !canControl ? 'opacity-60 cursor-not-allowed' : 'hover:h-2.5'
            }`}
          />
        </div>
        <span className="text-xs font-mono text-slate-500 min-w-[40px]">
          {duration > 0 ? formatTime(duration) : '--:--'}
        </span>
      </div>

      {/* Control Buttons & Role Feedback */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          {/* Play / Pause */}
          {canControl ? (
            playState === PlayState.PLAYING ? (
              <button
                onClick={onPause}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all hover:scale-105 active:scale-95 shadow-md"
              >
                <Pause className="w-4 h-4 fill-white text-white" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                onClick={onPlay}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all hover:scale-105 active:scale-95 shadow-lg shadow-rose-600/30"
              >
                <Play className="w-4 h-4 fill-white text-white" />
                <span>Play</span>
              </button>
            )
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-400">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Viewer Mode (Host/Moderator controls playback)</span>
            </div>
          )}

          {/* Re-sync Button */}
          <button
            onClick={onResync}
            title="Force sync player with server"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700/60 transition-all hover:text-white"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Sync Time</span>
          </button>
        </div>

        {/* Change Video Button */}
        {canControl && (
          <button
            onClick={() => setShowVideoModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 transition-all hover:border-slate-600"
          >
            <LinkIcon className="w-3.5 h-3.5 text-rose-400" />
            <span>Change Video</span>
          </button>
        )}
      </div>

      {/* Change Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-rose-500" />
                Change Room Video
              </h3>
              <button
                onClick={() => setShowVideoModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Paste any YouTube URL or 11-character Video ID. All participants will instantly switch to this video in sync.
            </p>

            <form onSubmit={handleVideoSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={videoInput}
                  onChange={(e) => {
                    setVideoInput(e.target.value);
                    setInputError('');
                  }}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
                {inputError && <p className="text-xs text-rose-400 mt-1.5">{inputError}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVideoModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Load Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
