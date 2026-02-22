import type { ConversationHistoryConfig } from '../../types/index.js';
import type { ConversationMetrics } from './types.js';

export interface GenericMessage {
  role: string;
  content: unknown;
}

export interface TrimResult {
  trimmed: GenericMessage[];
  evicted: GenericMessage[];
  metrics: ConversationMetrics;
}

export type SummarizeCallback = (text: string) => Promise<string>;

const DEFAULT_MAX_MESSAGES = 100;
const DEFAULT_PRESERVE_FIRST_N = 1;
const DEFAULT_PRESERVE_LAST_N = 20;
const CHARS_PER_TOKEN = 4;
const MIN_EVICTED_FOR_SUMMARY = 10;

export class ConversationWindow {
  private maxMessages: number;
  private preserveFirstN: number;
  private preserveLastN: number;
  private summarizeOnTrim: boolean;
  private summarizeCallback?: SummarizeCallback;
  private evictedSinceLastSummary: number = 0;

  constructor(config: ConversationHistoryConfig = {}, summarizeCallback?: SummarizeCallback) {
    this.maxMessages = config.max_messages ?? DEFAULT_MAX_MESSAGES;
    this.preserveFirstN = config.preserve_first_n ?? DEFAULT_PRESERVE_FIRST_N;
    this.preserveLastN = config.preserve_last_n ?? DEFAULT_PRESERVE_LAST_N;
    this.summarizeOnTrim = config.summarize_on_trim ?? false;
    this.summarizeCallback = summarizeCallback;
  }

  async trim(messages: GenericMessage[]): Promise<TrimResult> {
    if (this.maxMessages <= 0 || messages.length <= this.maxMessages) {
      return {
        trimmed: messages,
        evicted: [],
        metrics: {
          totalMessages: messages.length,
          preservedMessages: messages.length,
          evictedMessages: 0,
          estimatedTokens: this.estimateTokens(messages),
        },
      };
    }

    const head = messages.slice(0, this.preserveFirstN);
    const tail = messages.slice(-this.preserveLastN);

    if (this.preserveFirstN + this.preserveLastN >= this.maxMessages) {
      const trimmed = [...head, ...tail];
      const evicted = messages.slice(
        this.preserveFirstN,
        messages.length - this.preserveLastN
      );
      return {
        trimmed,
        evicted,
        metrics: {
          totalMessages: messages.length,
          preservedMessages: trimmed.length,
          evictedMessages: evicted.length,
          estimatedTokens: this.estimateTokens(trimmed),
        },
      };
    }

    const middleStart = this.preserveFirstN;
    const middleEnd = messages.length - this.preserveLastN;
    const middleMessages = messages.slice(middleStart, middleEnd);

    const keepMiddle = this.maxMessages - this.preserveFirstN - this.preserveLastN;
    const evicted = middleMessages.slice(0, middleMessages.length - keepMiddle);
    const keptMiddle = middleMessages.slice(middleMessages.length - keepMiddle);

    this.evictedSinceLastSummary += evicted.length;

    let summaryMessage: GenericMessage | null = null;
    if (
      this.summarizeOnTrim &&
      this.summarizeCallback &&
      evicted.length > 0 &&
      this.evictedSinceLastSummary >= MIN_EVICTED_FOR_SUMMARY
    ) {
      summaryMessage = await this.tryGenerateSummary(evicted);
      if (summaryMessage) {
        this.evictedSinceLastSummary = 0;
      }
    }

    const trimmed = summaryMessage
      ? [...head, summaryMessage, ...keptMiddle, ...tail]
      : [...head, ...keptMiddle, ...tail];

    return {
      trimmed,
      evicted,
      metrics: {
        totalMessages: messages.length,
        preservedMessages: trimmed.length,
        evictedMessages: evicted.length,
        estimatedTokens: this.estimateTokens(trimmed),
      },
    };
  }

  estimateTokens(messages: GenericMessage[]): number {
    let totalChars = 0;
    for (const msg of messages) {
      totalChars += this.contentLength(msg.content);
    }
    return Math.ceil(totalChars / CHARS_PER_TOKEN);
  }

  private contentLength(content: unknown): number {
    if (typeof content === 'string') {
      return content.length;
    }
    if (Array.isArray(content)) {
      let len = 0;
      for (const item of content) {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          if (typeof obj.text === 'string') {
            len += obj.text.length;
          } else if (typeof obj.content === 'string') {
            len += obj.content.length;
          } else {
            len += JSON.stringify(obj).length;
          }
        } else if (typeof item === 'string') {
          len += item.length;
        }
      }
      return len;
    }
    if (typeof content === 'object' && content !== null) {
      return JSON.stringify(content).length;
    }
    return 0;
  }

  private extractTextFromMessages(messages: GenericMessage[]): string {
    const parts: string[] = [];
    for (const msg of messages) {
      const text = this.extractText(msg.content);
      if (text) {
        parts.push(`[${msg.role}]: ${text}`);
      }
    }
    return parts.join('\n');
  }

  private extractText(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>;
            if (typeof obj.text === 'string') return obj.text;
            if (typeof obj.content === 'string') return obj.content;
          }
          return '';
        })
        .filter(Boolean)
        .join(' ');
    }
    return '';
  }

  private async tryGenerateSummary(evicted: GenericMessage[]): Promise<GenericMessage | null> {
    if (!this.summarizeCallback) return null;

    const text = this.extractTextFromMessages(evicted);
    if (!text.trim()) return null;

    try {
      const summary = await this.summarizeCallback(text);
      return {
        role: 'assistant',
        content: `[Conversation Summary] ${summary}`,
      };
    } catch {
      return null;
    }
  }
}
