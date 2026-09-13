import React, { useState } from 'react';
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

  return (
    <div className="side__section side__section--participants">
      <div className="side__head">
        <h3>Participants</h3>
        <span className="side__count">
          {participants.length} {participants.length === 1 ? 'here' : 'here'}
        </span>
      </div>

      <ul className="plist">
        {participants.map((p) => {
          const isMe = p.userId === user?.id;
          const isTargetHost = p.role === Role.HOST;
          const showActions = isHost && !isMe && !isTargetHost;
          const initials = p.username.slice(0, 2).toUpperCase();

          return (
            <li key={p.userId} style={{ position: 'relative' }}>
              <span className="p-avatar">{initials}</span>
              <span className="p-name">
                {p.username} {isMe && <small style={{ color: 'var(--gold)', fontSize: '0.7rem' }}>(You)</small>}
              </span>
              <span
                className={`p-role ${
                  p.role === Role.HOST
                    ? 'p-role--host'
                    : p.role === Role.MODERATOR
                    ? 'pill'
                    : ''
                }`}
              >
                {p.role === Role.HOST ? 'Host' : p.role === Role.MODERATOR ? 'Moderator' : 'Viewer'}
              </span>

              {showActions && (
                <button
                  type="button"
                  onClick={() => setActiveMenuUserId(activeMenuUserId === p.userId ? null : p.userId)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--paper-faint)',
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontSize: '0.9rem',
                  }}
                  title="Manage user"
                >
                  ⋮
                </button>
              )}

              {/* Host dropdown menu */}
              {activeMenuUserId === p.userId && (
                <div
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '32px',
                    zIndex: 30,
                    background: 'var(--panel-2)',
                    border: '1px solid var(--hair)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
                    padding: '4px',
                    minWidth: '150px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  {p.role === Role.PARTICIPANT ? (
                    <button
                      type="button"
                      onClick={() => {
                        onAssignRole(p.userId, Role.MODERATOR);
                        setActiveMenuUserId(null);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--gold)',
                        padding: '6px 10px',
                        fontSize: '0.78rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '4px',
                      }}
                    >
                      Make Moderator
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onAssignRole(p.userId, Role.PARTICIPANT);
                        setActiveMenuUserId(null);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--paper-dim)',
                        padding: '6px 10px',
                        fontSize: '0.78rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '4px',
                      }}
                    >
                      Demote to Viewer
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Transfer HOST privileges to ${p.username}? You will become a participant.`)) {
                        onTransferHost(p.userId);
                        setActiveMenuUserId(null);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--paper)',
                      padding: '6px 10px',
                      fontSize: '0.78rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                  >
                    Transfer Host
                  </button>

                  <div style={{ height: '1px', background: 'var(--hair)', margin: '2px 0' }} />

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Remove ${p.username} from this room?`)) {
                        onRemoveParticipant(p.userId);
                        setActiveMenuUserId(null);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--err)',
                      padding: '6px 10px',
                      fontSize: '0.78rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                  >
                    Remove User
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
