/**
 * AICIS Core Memory Management
 * Handles context assembly, summarization, and token estimation
 */

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_est?: number;
  created_at?: Date;
}

export interface SessionSummary {
  key_topics: string[];
  domains_discussed: string[];
  last_metrics?: Record<string, number>;
}

/**
 * Estimate tokens (rough approximation: 1 token ≈ 4 chars)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build context window from recent messages
 * @param messages - Full message history
 * @param maxTokens - Maximum tokens to include (default: 4000)
 */
export function buildContextWindow(
  messages: ChatMessage[],
  maxTokens: number = 4000
): ChatMessage[] {
  const result: ChatMessage[] = [];
  let tokenCount = 0;

  // Add system messages first
  const systemMessages = messages.filter(m => m.role === 'system');
  for (const msg of systemMessages) {
    const tokens = msg.tokens_est || estimateTokens(msg.content);
    if (tokenCount + tokens <= maxTokens) {
      result.push(msg);
      tokenCount += tokens;
    }
  }

  // Add recent messages (reverse chronological)
  const nonSystemMessages = messages.filter(m => m.role !== 'system').reverse();
  for (const msg of nonSystemMessages) {
    const tokens = msg.tokens_est || estimateTokens(msg.content);
    if (tokenCount + tokens <= maxTokens) {
      result.unshift(msg); // Add to front to maintain order
      tokenCount += tokens;
    } else {
      break;
    }
  }

  return result;
}

/**
 * Generate session summary from messages
 */
export function generateSessionSummary(messages: ChatMessage[]): string {
  const userMessages = messages.filter(m => m.role === 'user');
  const domains = new Set<string>();
  const topics = new Set<string>();

  // Extract domains and topics from user queries
  userMessages.forEach(msg => {
    const content = msg.content.toLowerCase();
    
    // Domain detection
    if (content.includes('food') || content.includes('agriculture')) domains.add('food');
    if (content.includes('health') || content.includes('medical')) domains.add('health');
    if (content.includes('finance') || content.includes('economic')) domains.add('finance');
    if (content.includes('energy') || content.includes('power')) domains.add('energy');
    if (content.includes('security') || content.includes('threat')) domains.add('security');
    if (content.includes('climate') || content.includes('weather')) domains.add('climate');
    
    // Extract key topics (words longer than 5 chars that appear multiple times)
    const words = content.match(/\b\w{6,}\b/g) || [];
    words.forEach(w => topics.add(w));
  });

  const summary: SessionSummary = {
    key_topics: Array.from(topics).slice(0, 10),
    domains_discussed: Array.from(domains),
  };

  return `Previous session context: Analyzed ${Array.from(domains).join(', ')} domains. Key topics: ${Array.from(topics).slice(0, 5).join(', ')}.`;
}

/**
 * Save messages to session storage (fallback for non-authenticated users)
 */
export function saveToSessionStorage(sessionId: string, messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(`aicis_session_${sessionId}`, JSON.stringify(messages));
  } catch (error) {
    console.warn('Failed to save to session storage:', error);
  }
}

/**
 * Load messages from session storage
 */
export function loadFromSessionStorage(sessionId: string): ChatMessage[] | null {
  try {
    const data = sessionStorage.getItem(`aicis_session_${sessionId}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn('Failed to load from session storage:', error);
    return null;
  }
}

/**
 * Clear session storage
 */
export function clearSessionStorage(sessionId?: string) {
  try {
    if (sessionId) {
      sessionStorage.removeItem(`aicis_session_${sessionId}`);
    } else {
      // Clear all AICIS sessions
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('aicis_session_')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.warn('Failed to clear session storage:', error);
  }
}
