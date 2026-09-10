import { ReactionDTO, CONSTANTS, AllowedEmoji } from '@watchparty/shared';

export class ReactionHandler {
  private userLastReactionTime: Map<string, number> = new Map();

  public validateAndCreateReaction(
    id: string,
    roomId: string,
    userId: string,
    username: string,
    emoji: string
  ): ReactionDTO | null {
    // Validate emoji is in allowed set
    if (!CONSTANTS.ALLOWED_EMOJIS.includes(emoji as AllowedEmoji)) {
      return null;
    }

    // Rate limiting per user
    const now = Date.now();
    const lastTime = this.userLastReactionTime.get(userId) || 0;
    if (now - lastTime < CONSTANTS.REACTION_RATE_LIMIT_MS) {
      return null; // Throttled
    }

    this.userLastReactionTime.set(userId, now);

    return {
      id,
      roomId,
      userId,
      username,
      emoji,
      createdAt: new Date().toISOString(),
    };
  }
}
