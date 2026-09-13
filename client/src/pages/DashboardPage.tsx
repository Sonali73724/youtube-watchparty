import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [visibility, setVisibility] = useState('Anyone with the link');
  const [maxViewers, setMaxViewers] = useState('25');
  const [creating, setCreating] = useState(false);

  // Join Room State
  const [joinInput, setJoinInput] = useState('');
  const [displayName, setDisplayName] = useState(user?.username || '');
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
    <main className="dash">
      <div className="dash__hero">
        <h1>Where should we watch tonight?</h1>
        <p>Start a fresh room and share the code, or drop into one a friend already opened.</p>
      </div>

      <div className="grid-2">
        {/* CREATE ROOM */}
        <section className="card">
          <div className="card__icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2V16M2 9H16" stroke="#E7B84B" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h2>Create a room</h2>
          <p>Paste any YouTube link. You'll be the host, so playback follows your lead.</p>

          <form onSubmit={handleCreateRoom}>
            <label className="field">
              <span>Room name</span>
              <input
                type="text"
                name="roomName"
                placeholder="Friday night watch"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
              />
            </label>

            <label className="field">
              <span>YouTube URL</span>
              <input
                type="text"
                name="videoUrl"
                placeholder="https://youtube.com/watch?v=…"
                value={createVideoUrl}
                onChange={(e) => setCreateVideoUrl(e.target.value)}
              />
            </label>

            <div className="row-2">
              <label className="field">
                <span>Visibility</span>
                <select
                  name="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  <option>Invite only</option>
                  <option>Anyone with the link</option>
                </select>
              </label>
              <label className="field">
                <span>Max viewers</span>
                <select
                  name="maxViewers"
                  value={maxViewers}
                  onChange={(e) => setMaxViewers(e.target.value)}
                >
                  <option>10</option>
                  <option>25</option>
                  <option>No limit</option>
                </select>
              </label>
            </div>

            <button type="submit" className="btn-gold" disabled={creating}>
              {creating ? 'Creating room...' : 'Create room'}
            </button>
            <p className="hint">A 6-character room code is generated once you create it.</p>
          </form>
        </section>

        {/* JOIN ROOM */}
        <section className="card">
          <div className="card__icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M3 9H15M15 9L10 4M15 9L10 14"
                stroke="#E7B84B"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2>Join a room</h2>
          <p>Enter the code your host shared, or paste the full invite link.</p>

          <form onSubmit={handleJoinRoom}>
            <label className="field">
              <span>Room code or link</span>
              <input
                type="text"
                name="roomCode"
                placeholder="7F2KQ1"
                required
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Display name</span>
              <input
                type="text"
                name="displayName"
                placeholder="How others will see you"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>

            <button
              type="submit"
              className="btn-gold"
              disabled={joining || !joinInput.trim()}
            >
              {joining ? 'Joining room...' : 'Join room'}
            </button>
            <p className="hint">You'll join as a participant unless the host promotes you.</p>
          </form>
        </section>
      </div>

      <div className="divider-label">Your recent rooms</div>

      {loadingRooms ? (
        <div className="recent">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="recent__item"
              style={{ opacity: 0.5, pointerEvents: 'none' }}
            >
              <div className="recent__top">
                <span className="recent__title">Loading room...</span>
              </div>
              <span className="recent__meta">Please wait</span>
            </div>
          ))}
        </div>
      ) : myRooms.length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--hair)',
            borderRadius: 'var(--radius)',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            color: 'var(--paper-dim)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.9rem' }}>No rooms yet. Create or join one above to get started!</p>
        </div>
      ) : (
        <div className="recent">
          {myRooms.map((r) => (
            <div
              key={r.id}
              className="recent__item"
              onClick={() => navigate(`/room/${r.shortCode}`)}
            >
              <div className="recent__top">
                <span className="recent__title">{r.title || 'Watch Room'}</span>
                <span className="pill">
                  {r.role === Role.HOST ? 'Host' : r.role === Role.MODERATOR ? 'Moderator' : 'Viewer'}
                </span>
              </div>
              <span className="recent__meta">
                {r.shortCode} · {r.participantCount} {r.participantCount === 1 ? 'member' : 'members'} · Host: {r.creator}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};
