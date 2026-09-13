import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const LandingPage: React.FC = () => {
  const { user, login, signup } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(identifier, password);
        showToast('Welcome back!', 'success');
      } else {
        await signup(username, email, password);
        showToast('Account created successfully!', 'success');
      }
      navigate('/dashboard');
    } catch (err) {
      showToast((err as Error).message || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stage">
      {/* LEFT: brand panel */}
      <section className="brand">
        <div className="brand__grain"></div>
        <div className="brand__rings" aria-hidden="true">
          <span className="ring ring--a"></span>
          <span className="ring ring--b"></span>
          <span className="ring ring--c"></span>
        </div>

        <div className="brand__top">
          <div className="mark">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <circle cx="15" cy="15" r="14" stroke="#E7B84B" strokeWidth="1.4" />
              <path d="M12 10L21 15L12 20V10Z" fill="#E7B84B" />
            </svg>
            <span>Watch Party</span>
          </div>
        </div>

        <div className="brand__body">
          <h1>
            Every play<br />
            button, pressed<br />
            together.
          </h1>
          <p>
            One room, one timeline. Queue a video, and everyone
            watching lands on the same frame — down to the second.
          </p>

          <div className="mock">
            <div className="mock__bar">
              <span className="dot dot--r"></span>
              <span className="dot dot--y"></span>
              <span className="dot dot--g"></span>
              <span className="mock__room">Room · 7F2KQ1</span>
            </div>
            <div className="mock__screen">
              <div className="mock__playhead">
                <span></span>
              </div>
            </div>
            <div className="mock__faces">
              <span className="face">SR</span>
              <span className="face">AK</span>
              <span className="face">MJ</span>
              <span className="face face--more">+6</span>
              <span className="mock__live">In sync</span>
            </div>
          </div>
        </div>

        <div className="brand__foot">
          <div className="stat">
            <strong>0.4s</strong>
            <small>Median drift</small>
          </div>
          <div className="stat">
            <strong>3</strong>
            <small>Roles, one room</small>
          </div>
          <div className="stat">
            <strong>∞</strong>
            <small>Replays together</small>
          </div>
        </div>
      </section>

      {/* RIGHT: auth card */}
      <section className="auth">
        <div className="auth__card">
          <div className="tabs">
            <button
              type="button"
              className={`tab ${isLogin ? 'tab--active' : ''}`}
              onClick={() => setIsLogin(true)}
            >
              Log in
            </button>
            <button
              type="button"
              className={`tab ${!isLogin ? 'tab--active' : ''}`}
              onClick={() => setIsLogin(false)}
            >
              Sign up
            </button>
            <div
              className="tabs__thumb"
              style={{
                transform: isLogin ? 'translateX(0)' : 'translateX(100%)',
              }}
            ></div>
          </div>

          {/* LOGIN */}
          {isLogin ? (
            <form className="panel panel--login" onSubmit={handleAuthSubmit} autoComplete="off">
              <h2>Welcome back</h2>
              <p className="lede">Pick up your room where you left off.</p>

              <label className="field">
                <span>Email or username</span>
                <input
                  type="text"
                  name="identifier"
                  className="field-underline"
                  placeholder="sonali@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  className="field-underline"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              <div className="row-between">
                <label className="check">
                  <input type="checkbox" name="remember" />
                  <span>Stay signed in</span>
                </label>
                <button
                  type="button"
                  className="link"
                  onClick={() => showToast('Password reset is not configured in this demo.', 'info')}
                >
                  Forgot password
                </button>
              </div>

              <button type="submit" className="cta" disabled={loading}>
                {loading ? 'Logging in...' : 'Log in'}
              </button>

              <p className="switch">
                New to Watch Party?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="link"
                >
                  Create an account
                </button>
              </p>
            </form>
          ) : (
            /* SIGN UP */
            <form className="panel panel--signup" onSubmit={handleAuthSubmit} autoComplete="off">
              <h2>Start a room</h2>
              <p className="lede">Takes under a minute — no card required.</p>

              <label className="field">
                <span>Username</span>
                <input
                  type="text"
                  name="username"
                  className="field-underline"
                  placeholder="sonali"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  className="field-underline"
                  placeholder="sonali@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  className="field-underline"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              <label className="check check--terms">
                <input type="checkbox" name="terms" required defaultChecked />
                <span>I agree to the Terms and Privacy Policy</span>
              </label>

              <button type="submit" className="cta" disabled={loading}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>

              <p className="switch">
                Already have a room?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="link"
                >
                  Log in
                </button>
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
