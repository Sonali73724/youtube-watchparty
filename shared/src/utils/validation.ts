import { CONSTANTS } from '../constants';

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // RFC 5322 standard simplified email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function isValidUsername(username: string): boolean {
  if (!username || typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (trimmed.length < CONSTANTS.MIN_USERNAME_LENGTH || trimmed.length > CONSTANTS.MAX_USERNAME_LENGTH) {
    return false;
  }
  // Alphanumeric with underscores and dashes
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

export function isValidPassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;
  return password.length >= CONSTANTS.MIN_PASSWORD_LENGTH;
}

export function sanitizeText(text: string, maxLength: number = CONSTANTS.MAX_MESSAGE_LENGTH): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    .slice(0, maxLength)
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/g, '');
}

export function generateRoomCode(length: number = CONSTANTS.ROOM_CODE_LENGTH): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like O, 0, I, 1
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
