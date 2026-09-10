import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CustomControls } from '../src/components/room/CustomControls';
import { PlayState, Role } from '@watchparty/shared';

describe('CustomControls - Role Based UI and Playback Actions', () => {
  it('should render Play button and Change Video button for HOST', () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const onSeek = vi.fn();
    const onChangeVideo = vi.fn();
    const onResync = vi.fn();

    render(
      <CustomControls
        playState={PlayState.PAUSED}
        currentTime={15}
        duration={120}
        userRole={Role.HOST}
        onPlay={onPlay}
        onPause={onPause}
        onSeek={onSeek}
        onChangeVideo={onChangeVideo}
        onResync={onResync}
      />
    );

    const playButton = screen.getByRole('button', { name: /play/i });
    expect(playButton).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change video/i })).toBeInTheDocument();

    fireEvent.click(playButton);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('should render Pause button when playing for MODERATOR', () => {
    const onPause = vi.fn();

    render(
      <CustomControls
        playState={PlayState.PLAYING}
        currentTime={30}
        duration={120}
        userRole={Role.MODERATOR}
        onPlay={vi.fn()}
        onPause={onPause}
        onSeek={vi.fn()}
        onChangeVideo={vi.fn()}
        onResync={vi.fn()}
      />
    );

    const pauseButton = screen.getByRole('button', { name: /pause/i });
    expect(pauseButton).toBeInTheDocument();

    fireEvent.click(pauseButton);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('should display Viewer Mode restriction badge for PARTICIPANT and hide playback controls', () => {
    render(
      <CustomControls
        playState={PlayState.PLAYING}
        currentTime={30}
        duration={120}
        userRole={Role.PARTICIPANT}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onSeek={vi.fn()}
        onChangeVideo={vi.fn()}
        onResync={vi.fn()}
      />
    );

    expect(screen.getByText(/viewer mode/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^play$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^pause$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change video/i })).not.toBeInTheDocument();
  });
});
