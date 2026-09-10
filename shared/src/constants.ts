export const CONSTANTS = {
  // YouTube Defaults
  DEFAULT_VIDEO_ID: 'dQw4w9WgXcQ', // Rick Astley - Never Gonna Give You Up (Classic reliable default)
  
  // Drift & Sync Configuration
  MAX_ALLOWED_DRIFT_SECONDS: 1.5, // Drift threshold for local client seeking
  DRIFT_CHECK_INTERVAL_MS: 3000,
  
  // Chat Constraints
  MAX_MESSAGE_LENGTH: 500,
  MAX_CHAT_HISTORY_LIMIT: 50,
  CHAT_RATE_LIMIT_MAX_PER_SEC: 5,

  // Reactions
  ALLOWED_EMOJIS: ['❤️', '😂', '😮', '👏', '🔥', '🎉', '🍿'] as const,
  REACTION_RATE_LIMIT_MS: 300,

  // Room Configuration
  ROOM_CODE_LENGTH: 6,
  MAX_ROOM_TITLE_LENGTH: 60,

  // Auth Constraints
  MIN_PASSWORD_LENGTH: 6,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 30,
} as const;

export type AllowedEmoji = typeof CONSTANTS.ALLOWED_EMOJIS[number];
