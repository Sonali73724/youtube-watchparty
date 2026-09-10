import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserDTO } from '@watchparty/shared';
import { api } from '../services/api';

interface AuthContextType {
  user: UserDTO | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('watchparty_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('watchparty_token');
      if (storedToken) {
        try {
          const res = await api.getMe();
          setUser(res.user);
        } catch {
          // Token expired or invalid
          localStorage.removeItem('watchparty_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await api.login(identifier, password);
    localStorage.setItem('watchparty_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const signup = async (username: string, email: string, password: string) => {
    const res = await api.signup(username, email, password);
    localStorage.setItem('watchparty_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('watchparty_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
