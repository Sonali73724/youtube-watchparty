import { AuthResponse, RoomStatePayload, UserDTO } from '@watchparty/shared';

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:4000'
    : 'https://youtube-watchparty-9ep9.onrender.com');

const API_BASE = import.meta.env.VITE_API_BASE || `${SERVER_URL}/api`;
function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('watchparty_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  signup: (username: string, email: string, password: string): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),

  login: (identifier: string, password: string): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  getMe: (): Promise<{ user: UserDTO }> =>
    request<{ user: UserDTO }>('/auth/me'),

  // Rooms
  createRoom: (title?: string, videoUrlOrId?: string): Promise<{ room: { id: string; shortCode: string; title: string; createdById: string; videoId: string } }> =>
    request('/rooms', {
      method: 'POST',
      body: JSON.stringify({ title, videoUrlOrId }),
    }),

  getRoomDetails: (idOrCode: string): Promise<{ state: RoomStatePayload }> =>
    request(`/rooms/${idOrCode}`),

  getMyRooms: (): Promise<{ rooms: any[] }> =>
    request('/rooms/my-rooms'),
};
