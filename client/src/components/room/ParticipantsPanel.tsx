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
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            <Crown className="w-3 h-3 fill-current" />
            Host
          </span>
        );
      case Role.MODERATOR:
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
            <Shield className="w-3 h-3 text-indigo-600" />
            Mod
          </span>
        );
      case Role.PARTICIPANT:
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            <User className="w-3 h-3 text-slate-500" />
            Viewer
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-indigo-600" />
          <h3 className="font-bold text-sm text-slate-900">Participants</h3>
        </div>
        <span className="text-[11px] font-medium text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-full">
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
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                isMe
                  ? 'bg-indigo-50 border-indigo-100 shadow-sm'
                  : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
              }`}
            >
              {/* User info */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${isMe ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${
                      p.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-900">{p.username}</span>
                    {isMe && <span className="text-[10px] font-bold text-indigo-600">(You)</span>}
                  </div>
                  <div className="mt-1">{renderRoleBadge(p.role)}</div>
                </div>
              </div>

              {/* Host Action Controls */}
              {showActions && (
                <div className="relative">
                  <button
                    onClick={() => setActiveMenuUserId(activeMenuUserId === p.userId ? null : p.userId)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {activeMenuUserId === p.userId && (
                    <div className="absolute right-0 top-8 z-30 w-48 bg-white rounded-xl border border-slate-200 shadow-lg p-1 space-y-0.5">
                      {p.role === Role.PARTICIPANT ? (
                        <button
                          onClick={() => {
                            onAssignRole(p.userId, Role.MODERATOR);
                            setActiveMenuUserId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors text-left"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Make Moderator
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            onAssignRole(p.userId, Role.PARTICIPANT);
                            setActiveMenuUserId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left"
                        >
                          <User className="w-4 h-4" />
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-lg transition-colors text-left"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        Transfer Host
                      </button>

                      <div className="h-px bg-slate-100 my-1 mx-2" />

                      <button
                        onClick={() => {
                          if (window.confirm(`Kick ${p.username} from the room?`)) {
                            onRemoveParticipant(p.userId);
                            setActiveMenuUserId(null);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-left"
                      >
                        <UserX className="w-4 h-4" />
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
