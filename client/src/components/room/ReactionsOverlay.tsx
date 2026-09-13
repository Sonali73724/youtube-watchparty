import React, { useState, useEffect } from 'react';
import { CONSTANTS, ReactionDTO } from '@watchparty/shared';

interface ReactionParticle {
  id: string;
  emoji: string;
  username: string;
  leftPercent: number;
}

interface ReactionsOverlayProps {
  incomingReaction: ReactionDTO | null;
  onSendReaction: (emoji: string) => void;
}

export const ReactionsOverlay: React.FC<ReactionsOverlayProps> = ({
  incomingReaction,
  onSendReaction,
}) => {
  const [particles, setParticles] = useState<ReactionParticle[]>([]);

  // Add floating particle when a reaction is received
  useEffect(() => {
    if (!incomingReaction) return;

    const newParticle: ReactionParticle = {
      id: incomingReaction.id || Math.random().toString(),
      emoji: incomingReaction.emoji,
      username: incomingReaction.username,
      leftPercent: 15 + Math.random() * 70, // Random horizontal position between 15% and 85%
    };

    setParticles((prev) => [...prev.slice(-15), newParticle]);

    const timer = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
    }, 2400);

    return () => clearTimeout(timer);
  }, [incomingReaction]);

  return (
    <>
      {/* Floating Particles Area (Overlaid on top of video container) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {particles.map((particle) => (
          <div
            key={particle.id}
            style={{ left: `${particle.leftPercent}%`, bottom: '20%' }}
            className="absolute animate-floating-emoji flex flex-col items-center"
          >
            <span className="text-3xl sm:text-4xl filter drop-shadow-lg select-none">
              {particle.emoji}
            </span>
            <span className="text-[10px] font-bold text-white/90 bg-slate-900/60 px-2 py-0.5 rounded-full backdrop-blur-sm select-none mt-1">
              {particle.username}
            </span>
          </div>
        ))}
      </div>

      {/* Quick Reactions Bar */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 p-2 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl">
        <span className="text-xs font-semibold text-slate-400 mr-1 hidden sm:inline">React:</span>
        {CONSTANTS.ALLOWED_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSendReaction(emoji)}
            className="text-xl sm:text-2xl p-1.5 rounded-xl hover:bg-slate-800 hover:scale-125 active:scale-95 transition-all select-none"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
};
