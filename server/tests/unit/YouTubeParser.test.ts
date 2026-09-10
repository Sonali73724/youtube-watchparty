import { describe, it, expect } from 'vitest';
import { extractYouTubeVideoId, isValidYouTubeId, getYouTubeWatchUrl } from '@watchparty/shared';

describe('YouTube URL Parser & Validator', () => {
  it('should extract ID from standard watch URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('http://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('should extract ID from short youtu.be URL', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('http://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('should extract ID from shorts URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('should extract ID from embed and /v/ URLs', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('should extract ID from URLs with extra query parameters', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&feature=share')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=100')).toBe('dQw4w9WgXcQ');
  });

  it('should accept raw 11-char video IDs', () => {
    expect(extractYouTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('M7lc1UVf-VE')).toBe('M7lc1UVf-VE');
    expect(extractYouTubeVideoId('9bZkp7q19f0')).toBe('9bZkp7q19f0');
  });

  it('should return null for malformed or invalid inputs', () => {
    expect(extractYouTubeVideoId('')).toBeNull();
    expect(extractYouTubeVideoId('https://google.com')).toBeNull();
    expect(extractYouTubeVideoId('https://vimeo.com/123456')).toBeNull();
    expect(extractYouTubeVideoId('not_a_valid_id')).toBeNull();
    expect(extractYouTubeVideoId('<iframe>invalid</iframe>')).toBeNull();
  });

  it('should validate 11-char YouTube ID accurately', () => {
    expect(isValidYouTubeId('dQw4w9WgXcQ')).toBe(true);
    expect(isValidYouTubeId('short')).toBe(false);
    expect(isValidYouTubeId('too_long_youtube_id_12345')).toBe(false);
  });

  it('should format watch URL correctly', () => {
    expect(getYouTubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});
