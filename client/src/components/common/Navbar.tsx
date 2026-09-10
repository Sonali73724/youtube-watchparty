import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, LogOut, Radio, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { status } = useSocket();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/20 group-hover:scale-105 transition-transform">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-rose-300 bg-clip-text text-transparent">
              WatchParty
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Live
            </span>
          </div>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Connection Status Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <Radio className={`w-3.5 h-3.5 ${
                  status === 'connected' ? 'text-emerald-400 animate-pulse' :
                  status === 'connecting' || status === 'reconnecting' ? 'text-amber-400 animate-spin' :
                  'text-rose-400'
                }`} />
                <span className="capitalize">{status}</span>
              </div>

              <Link
                to="/dashboard"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>

              {/* User Menu */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm">
                <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 font-bold flex items-center justify-center text-xs">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-slate-200">{user.username}</span>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
