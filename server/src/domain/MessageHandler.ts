import { ChatMessageDTO, CONSTANTS, sanitizeText } from '@watchparty/shared';

export class MessageHandler {
  private recentMessages: ChatMessageDTO[] = [];
  private readonly maxLimit: number;
  private userMessageTimestamps: Map<string, number[]> = new Map();

  constructor(maxLimit: number = CONSTANTS.MAX_CHAT_HISTORY_LIMIT) {
    this.maxLimit = maxLimit;
  }

  /**
   * Validates and adds a message to the buffer.
   * Returns sanitized DTO or null if validation fails.
   */
  public addMessage(
    id: string,
    roomId: string,
    userId: string,
    username: string,
    rawText: string,
    createdAt: string = new Date().toISOString()
  ): ChatMessageDTO | null {
    const text = sanitizeText(rawText);
    if (!text || text.length === 0 || text.length > CONSTANTS.MAX_MESSAGE_LENGTH) {
      return null;
    }

    // Rate-limiting check (max 5 messages per 2 seconds per user)
    const now = Date.now();
    const timestamps = this.userMessageTimestamps.get(userId) || [];
    const windowStart = now - 2000;
    const recentCount = timestamps.filter(t => t > windowStart);
    if (recentCount.length >= 5) {
      return null; // Rate limited
    }
    recentCount.push(now);
    this.userMessageTimestamps.set(userId, recentCount);

    const messageDto: ChatMessageDTO = {
      id,
      roomId,
      userId,
      username,
      text,
      createdAt,
    };

    this.recentMessages.push(messageDto);
    if (this.recentMessages.length > this.maxLimit) {
      this.recentMessages.shift();
    }

    return messageDto;
  }

  public getRecentMessages(): ChatMessageDTO[] {
    return [...this.recentMessages];
  }

  public seedHistory(messages: ChatMessageDTO[]): void {
    this.recentMessages = messages.slice(-this.maxLimit);
  }
}
