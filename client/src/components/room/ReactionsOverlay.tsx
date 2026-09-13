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
            className="absolute animate-floating-emoji flex flex-col items-center pointer-events-none"
          >
            <span className="text-3xl sm:text-4xl filter drop-shadow-lg select-none">
              {particle.emoji}
            </span>
            <span
              style={{
                backgroundColor: 'var(--ink)',
                color: 'var(--paper)',
                border: '1px solid var(--hair)',
              }}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full select-none mt-1 opacity-90 shadow"
            >
              {particle.username}
            </span>
          </div>
        ))}
      </div>

      {/* Quick Reactions Bar from design/room.html */}
      <div className="reactions">
        {CONSTANTS.ALLOWED_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSendReaction(emoji)}
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
};
