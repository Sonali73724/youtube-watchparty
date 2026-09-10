import React, { useState } from 'react';
import { Crown, Shield, User, MoreVertical, ShieldCheck, ArrowRightLeft, UserX } from 'lucide-react';
import { RoomParticipantDTO, Role } from '@watchparty/shared';
import { useAuth } from '../../context/AuthContext';

interface ParticipantsPanelProps {
  participants: RoomParticipantDTO[];
  userRole: Role;
  onAssignRole: (targetUserId: string, newRole: Role) => void;
  onTransferHost: (targetUserId: string) => void;
  onRemoveParticipant: (targetUserId: string) => void;
}

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
  participants,
  userRole,
  onAssignRole,
  onTransferHost,
  onRemoveParticipant,
}) => {
  const { user } = useAuth();
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);

  const isHost = userRole === Role.HOST;

  const renderRoleBadge = (role: Role) => {
    switch (role) {
      case Role.HOST:
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
            Host
          </span>
        );
      case Role.MODERATOR:
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30">
            <Shield className="w-3 h-3 text-sky-400" />
            Mod
          </span>
        );
      case Role.PARTICIPANT:
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400 px-1.5 py-0.5">
            <User className="w-3 h-3 text-slate-500" />
            Viewer
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">Participants</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
          {participants.length} online
        </span>
      </div>

      {/* Participants List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2 min-h-[160px] max-h-[300px]">
        {participants.map((p) => {
          const isMe = p.userId === user?.id;
          const isTargetHost = p.role === Role.HOST;
          const showActions = isHost && !isMe && !isTargetHost;

          return (
            <div
              key={p.userId}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                isMe
                  ? 'bg-slate-800/80 border-slate-700/80'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* User info */}
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-rose-300">
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                      p.isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">{p.username}</span>
                    {isMe && <span className="text-[10px] text-rose-400 font-bold">(You)</span>}
                  </div>
                  <div className="mt-0.5">{renderRoleBadge(p.role)}</div>
                </div>
              </div>

              {/* Host Action Controls */}
              {showActions && (
                <div className="relative">
                  <button
                    onClick={() => setActiveMenuUserId(activeMenuUserId === p.userId ? null : p.userId)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {activeMenuUserId === p.userId && (
                    <div className="absolute right-0 top-8 z-30 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-1 space-y-1">
                      {p.role === Role.PARTICIPANT ? (
                        <button
                          onClick={() => {
                            onAssignRole(p.userId, Role.MODERATOR);
                            setActiveMenuUserId(null);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-sky-300 hover:bg-slate-700 rounded-lg transition-colors text-left"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                          Make Moderator
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            onAssignRole(p.userId, Role.PARTICIPANT);
                            setActiveMenuUserId(null);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700 rounded-lg transition-colors text-left"
                        >
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          Demote to Viewer
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (window.confirm(`Transfer HOST privileges to ${p.username}? You will become a participant.`)) {
                            onTransferHost(p.userId);
                            setActiveMenuUserId(null);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-amber-300 hover:bg-slate-700 rounded-lg transition-colors text-left"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                        Transfer Host
                      </button>

                      <div className="h-px bg-slate-700 my-1" />

                      <button
                        onClick={() => {
                          if (window.confirm(`Kick ${p.username} from the room?`)) {
                            onRemoveParticipant(p.userId);
                            setActiveMenuUserId(null);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors text-left"
                      >
                        <UserX className="w-3.5 h-3.5 text-rose-400" />
                        Remove User
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
