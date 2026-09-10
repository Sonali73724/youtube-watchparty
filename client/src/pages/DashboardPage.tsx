import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, LogIn, Video, Clock, Users, ArrowRight, Play, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Role } from '@watchparty/shared';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Create Room State
  const [createTitle, setCreateTitle] = useState('');
  const [createVideoUrl, setCreateVideoUrl] = useState('');
  const [creating, setCreating] = useState(false);

  // Join Room State
  const [joinInput, setJoinInput] = useState('');
  const [joining, setJoining] = useState(false);

  // Recent Rooms State
  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await api.getMyRooms();
        setMyRooms(res.rooms || []);
      } catch (err) {
        console.warn('Failed to load user rooms:', err);
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchRooms();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await api.createRoom(createTitle, createVideoUrl);
      showToast('Room created!', 'success');
      navigate(`/room/${res.room.shortCode}`);
    } catch (err) {
      showToast((err as Error).message || 'Failed to create room', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = joinInput.trim();
    if (!cleanInput) return;

    setJoining(true);

    // If a full URL was pasted like http://localhost:3000/room/ABC123
    let code = cleanInput;
    if (cleanInput.includes('/room/')) {
      const parts = cleanInput.split('/room/');
      code = parts[1].split('?')[0].split('/')[0];
    }

    navigate(`/room/${code.toUpperCase()}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-900 border border-slate-800 p-8 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ready to Watch</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Welcome back, {user?.username}! 👋
          </h1>
          <p className="text-sm text-slate-400">
            Host a new watch party or enter a room code to join your friends in synchronized playback.
          </p>
        </div>
      </div>

      {/* Action Cards: Create & Join */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create Room Card */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-800 p-7 shadow-xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create a Watch Party</h2>
              <p className="text-xs text-slate-400">Become the Host with full playback controls</p>
            </div>
          </div>

          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Room Title (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Friday Movie Night, Lo-Fi Chill"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Starting YouTube Video URL (optional)
              </label>
              <input
                type="text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={createVideoUrl}
                onChange={(e) => setCreateVideoUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
            >
              {creating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Create Room</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Join Room Card */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-800 p-7 shadow-xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Join a Watch Party</h2>
              <p className="text-xs text-slate-400">Enter a 6-letter room code or party link</p>
            </div>
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Room Code or Link
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PARTY1 or http://.../room/PARTY1"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 uppercase focus:outline-none focus:border-sky-500 transition-colors tracking-widest font-mono"
              />
            </div>

            <div className="pt-7">
              <button
                type="submit"
                disabled={joining || !joinInput.trim()}
                className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2"
              >
                {joining ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    <span>Enter Watch Party</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Your Recent Rooms List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
            Your Recent Watch Parties
          </h2>
        </div>

        {loadingRooms ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 rounded-2xl bg-slate-900/60 animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : myRooms.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center text-slate-500">
            <Video className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No recent watch parties found.</p>
            <p className="text-[11px] text-slate-600 mt-0.5">Create your first room above to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myRooms.map((r) => (
              <div
                key={r.id}
                onClick={() => navigate(`/room/${r.shortCode}`)}
                className="group cursor-pointer p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-all shadow-lg flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors line-clamp-1">
                      {r.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                        {r.shortCode}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        r.role === Role.HOST ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {r.role}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all" />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{r.participantCount} members</span>
                  </div>
                  <span>Hosted by {r.creator}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
