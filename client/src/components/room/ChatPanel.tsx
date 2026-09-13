import React, { useState, useRef, useEffect } from 'react';
import { ChatMessageDTO, CONSTANTS } from '@watchparty/shared';
import { useAuth } from '../../context/AuthContext';

interface ChatPanelProps {
  messages: ChatMessageDTO[];
  onSendMessage: (text: string) => void;
}

function formatMessageTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage }) => {
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInputText('');
  };

  return (
    <div className="side__section side__section--chat">
      <div className="side__head">
        <h3>Chat</h3>
        <span className="side__count">Live</span>
      </div>

      <div className="chat">
        <div className="chat__log">
          {messages.length === 0 ? (
            <div className="msg msg--system" style={{ margin: 'auto' }}>
              <span className="msg__text">No messages yet. Say hello!</span>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.userId === user?.id;
              const initials = msg.username.slice(0, 2).toUpperCase();

              return (
                <div
                  key={msg.id}
                  className={`msg ${isMe ? 'msg--self' : ''}`}
                >
                  <span className="msg__avatar">{initials}</span>
                  <div className="msg__body">
                    <div className="msg__meta">
                      <span className="msg__name">{isMe ? 'You' : msg.username}</span>
                      <span className="msg__time">{formatMessageTime(msg.createdAt)}</span>
                    </div>
                    <p className="msg__text">{msg.text}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat__form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Say something…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            maxLength={CONSTANTS.MAX_MESSAGE_LENGTH}
          />
          <button
            type="submit"
            className="chat__send"
            title="Send"
            disabled={!inputText.trim()}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M1.5 7.5L13.5 1.5L9 13.5L6.5 8.5L1.5 7.5Z" fill="#221A08" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};
