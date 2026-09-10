import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
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
    <div className="flex flex-col h-full bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-rose-500" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">Party Chat</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">{messages.length} messages</span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[220px] max-h-[420px] lg:max-h-none">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
            <p className="text-xs">No messages yet.</p>
            <p className="text-[11px] text-slate-600 mt-0.5">Say hello to start the party!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                  <span className={`font-semibold ${isMe ? 'text-rose-400' : 'text-slate-300'}`}>
                    {isMe ? 'You' : msg.username}
                  </span>
                  <span className="text-[10px] text-slate-500">{formatMessageTime(msg.createdAt)}</span>
                </div>
                <div
                  className={`px-3.5 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed ${
                    isMe
                      ? 'bg-rose-600 text-white rounded-br-none shadow-md shadow-rose-600/20'
                      : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
        <input
          type="text"
          placeholder="Send a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          maxLength={CONSTANTS.MAX_MESSAGE_LENGTH}
          className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-md shadow-rose-600/20"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
