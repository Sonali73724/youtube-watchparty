import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // On the landing page, the brand header is integrated into the split stage layout
  if (location.pathname === '/') {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isInRoom = location.pathname.startsWith('/room');

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'SR';

  return (
    <header className="nav">
      <Link to={user ? "/dashboard" : "/"} className="mark">
        <svg width="26" height="26" viewBox="0 0 30 30" fill="none">
          <circle cx="15" cy="15" r="14" stroke="#E7B84B" strokeWidth="1.4" />
          <path d="M12 10L21 15L12 20V10Z" fill="#E7B84B" />
        </svg>
        <span>Watch Party</span>
      </Link>

      <div className="nav__right">
        {user ? (
          <>
            <div className="nav__user">
              <span className="avatar">{initials}</span>
              <span>{user.username}</span>
            </div>
            {isInRoom ? (
              <Link to="/dashboard" className="btn-ghost">
                Leave room
              </Link>
            ) : (
              <button onClick={handleLogout} className="btn-ghost">
                Log out
              </button>
            )}
          </>
        ) : (
          <Link to="/" className="btn-ghost">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
};
