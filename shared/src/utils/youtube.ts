/**
 * Extracts a YouTube Video ID from various URL formats or raw video IDs.
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - Raw 11-character video ID
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // If directly passed an 11-char YouTube ID (alphanumeric, dash, underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    // Handle URLs without protocol (e.g. youtube.com/watch?v=...)
    const urlString = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

    const parsedUrl = new URL(urlString);
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');

    // youtube.com / m.youtube.com
    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      // /watch?v=VIDEO_ID
      if (parsedUrl.pathname === '/watch') {
        const v = parsedUrl.searchParams.get('v');
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
          return v;
        }
      }

      // /shorts/VIDEO_ID
      if (parsedUrl.pathname.startsWith('/shorts/')) {
        const parts = parsedUrl.pathname.split('/');
        const id = parts[2];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return id;
        }
      }

      // /embed/VIDEO_ID
      if (parsedUrl.pathname.startsWith('/embed/')) {
        const parts = parsedUrl.pathname.split('/');
        const id = parts[2];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return id;
        }
      }

      // /v/VIDEO_ID
      if (parsedUrl.pathname.startsWith('/v/')) {
        const parts = parsedUrl.pathname.split('/');
        const id = parts[2];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return id;
        }
      }
    }

    // youtu.be/VIDEO_ID
    if (hostname === 'youtu.be') {
      const id = parsedUrl.pathname.slice(1).split('/')[0]?.split('?')[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return id;
      }
    }
  } catch {
    // If URL parsing fails, fallback to regex search
  }

  // Fallback regex pattern matching
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
  const match = trimmed.match(regex);
  if (match && match[1] && /^[a-zA-Z0-9_-]{11}$/.test(match[1])) {
    return match[1];
  }

  return null;
}

export function isValidYouTubeId(id: string): boolean {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id.trim());
}

export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
