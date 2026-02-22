import { describe, it, expect, vi } from 'vitest';
import { ConversationWindow, type GenericMessage, type SummarizeCallback } from './conversation-window.js';

function makeMessages(count: number): GenericMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i}`,
  }));
}

describe('ConversationWindow', () => {
  describe('trim', () => {
    it('should return messages unchanged when under the cap', async () => {
      const window = new ConversationWindow({ max_messages: 10 });
      const messages = makeMessages(5);
      const result = await window.trim(messages);

      expect(result.trimmed).toEqual(messages);
      expect(result.evicted).toEqual([]);
      expect(result.metrics.evictedMessages).toBe(0);
    });

    it('should return messages unchanged when exactly at the cap', async () => {
      const window = new ConversationWindow({ max_messages: 5 });
      const messages = makeMessages(5);
      const result = await window.trim(messages);

      expect(result.trimmed).toHaveLength(5);
      expect(result.evicted).toHaveLength(0);
    });

    it('should return messages unchanged when max_messages is 0 (disabled)', async () => {
      const window = new ConversationWindow({ max_messages: 0 });
      const messages = makeMessages(200);
      const result = await window.trim(messages);

      expect(result.trimmed).toHaveLength(200);
      expect(result.evicted).toHaveLength(0);
    });

    it('should preserve first N and last N messages', async () => {
      const window = new ConversationWindow({
        max_messages: 10,
        preserve_first_n: 2,
        preserve_last_n: 3,
      });
      const messages = makeMessages(20);
      const result = await window.trim(messages);

      // First 2 should be preserved
      expect(result.trimmed[0]).toEqual(messages[0]);
      expect(result.trimmed[1]).toEqual(messages[1]);

      // Last 3 should be preserved
      expect(result.trimmed[result.trimmed.length - 1]).toEqual(messages[19]);
      expect(result.trimmed[result.trimmed.length - 2]).toEqual(messages[18]);
      expect(result.trimmed[result.trimmed.length - 3]).toEqual(messages[17]);
    });

    it('should evict oldest middle messages first', async () => {
      const window = new ConversationWindow({
        max_messages: 5,
        preserve_first_n: 1,
        preserve_last_n: 2,
      });
      const messages = makeMessages(10);
      const result = await window.trim(messages);

      // Should keep: [0], [6, 7] from middle (most recent), [8, 9] from tail
      expect(result.trimmed).toHaveLength(5);
      expect(result.trimmed[0]).toEqual(messages[0]); // head
      expect(result.trimmed[result.trimmed.length - 1]).toEqual(messages[9]); // tail
      expect(result.trimmed[result.trimmed.length - 2]).toEqual(messages[8]); // tail

      // Evicted should be the oldest middle messages
      expect(result.evicted.length).toBe(5);
      expect(result.evicted[0]).toEqual(messages[1]);
    });

    it('should handle when preserve_first_n + preserve_last_n >= max_messages', async () => {
      const window = new ConversationWindow({
        max_messages: 5,
        preserve_first_n: 3,
        preserve_last_n: 4,
      });
      const messages = makeMessages(20);
      const result = await window.trim(messages);

      // Should keep only head + tail, all middle evicted
      expect(result.trimmed).toHaveLength(7); // 3 + 4
      expect(result.trimmed[0]).toEqual(messages[0]);
      expect(result.trimmed[result.trimmed.length - 1]).toEqual(messages[19]);
    });

    it('should handle empty message array', async () => {
      const window = new ConversationWindow({ max_messages: 10 });
      const result = await window.trim([]);

      expect(result.trimmed).toHaveLength(0);
      expect(result.evicted).toHaveLength(0);
      expect(result.metrics.totalMessages).toBe(0);
    });

    it('should handle messages fewer than preserve_first_n + preserve_last_n', async () => {
      const window = new ConversationWindow({
        max_messages: 100,
        preserve_first_n: 5,
        preserve_last_n: 10,
      });
      const messages = makeMessages(3);
      const result = await window.trim(messages);

      expect(result.trimmed).toHaveLength(3);
      expect(result.evicted).toHaveLength(0);
    });

    it('should compute correct metrics after trimming', async () => {
      const window = new ConversationWindow({
        max_messages: 5,
        preserve_first_n: 1,
        preserve_last_n: 2,
      });
      const messages = makeMessages(10);
      const result = await window.trim(messages);

      expect(result.metrics.totalMessages).toBe(10);
      expect(result.metrics.preservedMessages).toBe(5);
      expect(result.metrics.evictedMessages).toBe(5);
      expect(result.metrics.estimatedTokens).toBeGreaterThan(0);
    });

    it('should apply config defaults when fields are omitted', async () => {
      const window = new ConversationWindow({});
      const messages = makeMessages(50);
      const result = await window.trim(messages);

      // Default max_messages is 100, so 50 messages should be unchanged
      expect(result.trimmed).toHaveLength(50);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for string content', () => {
      const window = new ConversationWindow();
      const messages: GenericMessage[] = [
        { role: 'user', content: 'Hello world' }, // 11 chars => ~3 tokens
      ];
      const tokens = window.estimateTokens(messages);
      expect(tokens).toBe(Math.ceil(11 / 4));
    });

    it('should estimate tokens for array content (Anthropic-style)', () => {
      const window = new ConversationWindow();
      const messages: GenericMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'World' },
          ],
        },
      ];
      const tokens = window.estimateTokens(messages);
      expect(tokens).toBe(Math.ceil(10 / 4)); // "Hello" + "World" = 10 chars
    });

    it('should estimate tokens for object content', () => {
      const window = new ConversationWindow();
      const messages: GenericMessage[] = [
        { role: 'user', content: { foo: 'bar' } },
      ];
      const tokens = window.estimateTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle mixed content types', () => {
      const window = new ConversationWindow();
      const messages: GenericMessage[] = [
        { role: 'user', content: 'plain text' },
        { role: 'assistant', content: [{ type: 'text', text: 'array text' }] },
        { role: 'user', content: null },
      ];
      const tokens = window.estimateTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should return 0 for empty messages', () => {
      const window = new ConversationWindow();
      expect(window.estimateTokens([])).toBe(0);
    });
  });

  describe('summarization', () => {
    it('should insert summary message when summarize_on_trim is enabled', async () => {
      const mockSummarize: SummarizeCallback = vi.fn().mockResolvedValue('Summary of conversation');

      const window = new ConversationWindow(
        { max_messages: 5, preserve_first_n: 1, preserve_last_n: 2, summarize_on_trim: true },
        mockSummarize
      );

      // Need at least 10 evicted for summary to trigger (MIN_EVICTED_FOR_SUMMARY)
      const messages = makeMessages(18);
      const result = await window.trim(messages);

      expect(mockSummarize).toHaveBeenCalled();
      // Summary message should be between head and tail
      const summaryMsg = result.trimmed.find(
        (m) => typeof m.content === 'string' && m.content.startsWith('[Conversation Summary]')
      );
      expect(summaryMsg).toBeDefined();
      expect(summaryMsg?.role).toBe('assistant');
    });

    it('should fall back to plain eviction when summarization fails', async () => {
      const mockSummarize: SummarizeCallback = vi.fn().mockRejectedValue(new Error('API Error'));

      const window = new ConversationWindow(
        { max_messages: 5, preserve_first_n: 1, preserve_last_n: 2, summarize_on_trim: true },
        mockSummarize
      );

      const messages = makeMessages(18);
      const result = await window.trim(messages);

      // Should still trim, just without summary
      expect(result.trimmed.length).toBeLessThanOrEqual(6); // max 5 + possible no summary
      const summaryMsg = result.trimmed.find(
        (m) => typeof m.content === 'string' && (m.content as string).startsWith('[Conversation Summary]')
      );
      expect(summaryMsg).toBeUndefined();
    });

    it('should not summarize when summarize_on_trim is false', async () => {
      const mockSummarize: SummarizeCallback = vi.fn();

      const window = new ConversationWindow(
        { max_messages: 5, preserve_first_n: 1, preserve_last_n: 2, summarize_on_trim: false },
        mockSummarize
      );

      const messages = makeMessages(18);
      await window.trim(messages);

      expect(mockSummarize).not.toHaveBeenCalled();
    });

    it('should rate-limit summarization to every 10 evicted messages', async () => {
      const mockSummarize: SummarizeCallback = vi.fn().mockResolvedValue('Summary');

      const window = new ConversationWindow(
        { max_messages: 8, preserve_first_n: 1, preserve_last_n: 2, summarize_on_trim: true },
        mockSummarize
      );

      // First trim: evicts only 3 messages (under threshold of 10)
      const messages1 = makeMessages(11);
      await window.trim(messages1);
      expect(mockSummarize).not.toHaveBeenCalled();
    });

    it('should skip summarization when evicted messages have no text', async () => {
      const mockSummarize: SummarizeCallback = vi.fn().mockResolvedValue('Summary');

      const window = new ConversationWindow(
        { max_messages: 3, preserve_first_n: 1, preserve_last_n: 1, summarize_on_trim: true },
        mockSummarize
      );

      // Messages with null content
      const messages: GenericMessage[] = [
        { role: 'user', content: 'initial' },
        ...Array.from({ length: 12 }, () => ({ role: 'assistant' as const, content: null })),
        { role: 'user', content: 'latest' },
      ];

      await window.trim(messages);

      // summarize is called but extractTextFromMessages returns empty, so tryGenerateSummary returns null
      // (the text.trim() check prevents the actual API call)
      // Actually mockSummarize won't be called because tryGenerateSummary returns null before calling it
      expect(mockSummarize).not.toHaveBeenCalled();
    });
  });
});
