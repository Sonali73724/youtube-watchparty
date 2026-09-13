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
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
      {/* Progress & Time */}
      <div className="flex items-center gap-3 w-full">
        <span className="text-xs font-mono font-semibold text-slate-500 min-w-[40px] text-right">
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
            className={`w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600 transition-all ${
              !canControl ? 'opacity-60 cursor-not-allowed' : 'hover:h-2'
            }`}
          />
        </div>
        <span className="text-xs font-mono font-semibold text-slate-500 min-w-[40px]">
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
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold shadow-sm transition-colors"
              >
                <Pause className="w-4 h-4 fill-current text-slate-600" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                onClick={onPlay}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-600/20 transition-colors"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play</span>
              </button>
            )
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Viewer Mode</span>
            </div>
          )}

          {/* Re-sync Button */}
          <button
            onClick={onResync}
            title="Force sync player with server"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>

        {/* Change Video Button */}
        {canControl && (
          <button
            onClick={() => setShowVideoModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors shadow-sm"
          >
            <LinkIcon className="w-4 h-4 text-slate-500" />
            <span>Change Video</span>
          </button>
        )}
      </div>

      {/* Change Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-indigo-600" />
                Change Room Video
              </h3>
              <button
                onClick={() => setShowVideoModal(false)}
                className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg w-8 h-8 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVideoSubmit} className="space-y-4">
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
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                {inputError && <p className="text-xs font-medium text-rose-500 mt-1.5">{inputError}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVideoModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 transition-colors"
                >
                  <Check className="w-4 h-4" />
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
