import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ChatPanel } from '../src/components/room/ChatPanel';
import { ParticipantsPanel } from '../src/components/room/ParticipantsPanel';
import { Role } from '@watchparty/shared';
import { AuthProvider } from '../src/context/AuthContext';

describe('ChatPanel & ParticipantsPanel UI Tests', () => {
  it('should render chat messages and submit new message', () => {
    const onSendMessage = vi.fn();
    const messages = [
      {
        id: 'msg-1',
        roomId: 'room-1',
        userId: 'u1',
        username: 'Alice',
        text: 'Let us start the movie!',
        createdAt: new Date().toISOString(),
      },
    ];

    render(
      <AuthProvider>
        <ChatPanel messages={messages} onSendMessage={onSendMessage} />
      </AuthProvider>
    );

    expect(screen.getByText('Let us start the movie!')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/send a message/i);
    fireEvent.change(input, { target: { value: 'Great movie!' } });
    fireEvent.submit(input);

    expect(onSendMessage).toHaveBeenCalledWith('Great movie!');
  });

  it('should render participant list with Role badges (Host, Moderator, Viewer)', () => {
    const participants = [
      {
        userId: 'u1',
        username: 'HostAlice',
        role: Role.HOST,
        joinedAt: new Date().toISOString(),
        isOnline: true,
      },
      {
        userId: 'u2',
        username: 'ModBob',
        role: Role.MODERATOR,
        joinedAt: new Date().toISOString(),
        isOnline: true,
      },
      {
        userId: 'u3',
        username: 'ViewerCharlie',
        role: Role.PARTICIPANT,
        joinedAt: new Date().toISOString(),
        isOnline: false,
      },
    ];

    render(
      <AuthProvider>
        <ParticipantsPanel
          participants={participants}
          userRole={Role.HOST}
          onAssignRole={vi.fn()}
          onTransferHost={vi.fn()}
          onRemoveParticipant={vi.fn()}
        />
      </AuthProvider>
    );

    expect(screen.getByText('HostAlice')).toBeInTheDocument();
    expect(screen.getByText('ModBob')).toBeInTheDocument();
    expect(screen.getByText('ViewerCharlie')).toBeInTheDocument();

    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.getByText('Mod')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });
});
