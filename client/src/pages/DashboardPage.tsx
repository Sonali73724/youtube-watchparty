import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, LogIn, Users, ArrowRight, Play } from 'lucide-react';
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
      <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-md">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome, {user?.username}!
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Host a new watch party or enter a room code to join.
          </p>
        </div>
      </div>

      {/* Action Cards: Create & Join */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create Room Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7 shadow-lg shadow-slate-200/50 space-y-5 transition-all hover:shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-indigo-600 bg-indigo-50 border border-indigo-100">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Create Room</h2>
            </div>
          </div>

          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Room Title (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Movie Night"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Starting Video URL (optional)
              </label>
              <input
                type="text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={createVideoUrl}
                onChange={(e) => setCreateVideoUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3.5 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              {creating ? (
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Create</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Join Room Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7 shadow-lg shadow-slate-200/50 space-y-5 transition-all hover:shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-teal-600 bg-teal-50 border border-teal-100">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Join Room</h2>
            </div>
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Room Code or Link
              </label>
              <input
                type="text"
                required
                placeholder="PARTY1"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-mono uppercase tracking-widest"
              />
            </div>

            <div className="pt-7">
              <button
                type="submit"
                disabled={joining || !joinInput.trim()}
                className="w-full py-3.5 mt-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold shadow-lg shadow-teal-600/30 transition-all flex items-center justify-center gap-2"
              >
                {joining ? (
                  <div className="w-4 h-4 border-2 border-teal-400 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    <span>Join</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Your Recent Rooms List */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-700">
            Recent Rooms
          </h2>
        </div>

        {loadingRooms ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : myRooms.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-slate-500">
            <p className="text-sm font-medium">No recent rooms</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myRooms.map((r) => (
              <div
                key={r.id}
                onClick={() => navigate(`/room/${r.shortCode}`)}
                className="group cursor-pointer p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                      {r.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {r.shortCode}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        r.role === Role.HOST ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {r.role}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>

                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{r.participantCount} users</span>
                  </div>
                  <span>Host: {r.creator}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
