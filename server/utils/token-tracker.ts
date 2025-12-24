// Token usage tracking per room

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
  lastUpdated: Date;
}

export class TokenTracker {
  private roomTokenUsage: Map<string, TokenUsage>;

  constructor() {
    this.roomTokenUsage = new Map();
  }

  track(roomId: string, usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined): void {
    if (!usage) return;

    const existing = this.roomTokenUsage.get(roomId) || {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      callCount: 0,
      lastUpdated: new Date()
    };

    existing.promptTokens += usage.prompt_tokens || 0;
    existing.completionTokens += usage.completion_tokens || 0;
    existing.totalTokens += usage.total_tokens || 0;
    existing.callCount += 1;
    existing.lastUpdated = new Date();

    this.roomTokenUsage.set(roomId, existing);

    console.log(`[Token Usage] Room ${roomId}: +${usage.total_tokens || 0} tokens (total: ${existing.totalTokens}, calls: ${existing.callCount})`);
  }

  get(roomId: string): TokenUsage | undefined {
    return this.roomTokenUsage.get(roomId);
  }

  getAll(): Map<string, TokenUsage> {
    return new Map(this.roomTokenUsage);
  }
}

// Singleton instance
export const tokenTracker = new TokenTracker();

// Export type for use elsewhere
export type { TokenUsage };
