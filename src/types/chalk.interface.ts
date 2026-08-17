/** A Chalk conversation. */
export interface ChalkThread {
  id: string;
  /** Derived from the opening message; null only for a thread with no messages. */
  title: string | null;
  createdAt: string;
  lastMessageAt: string;
}

export type ChalkMessageRole = 'user' | 'assistant';

/**
 * 'aborted' and 'error' rows keep whatever text arrived, so a partial answer is
 * rendered rather than dropped.
 */
export type ChalkMessageStatus = 'complete' | 'error' | 'aborted';

export interface ChalkMessage {
  id: string;
  threadId: string;
  role: ChalkMessageRole;
  content: string;
  status: ChalkMessageStatus;
  error: string | null;
  createdAt: string;
}

/** What the chalk-chat function returns on a successful turn. */
export interface ChalkChatResponse {
  thread_id: string;
  user_message_id: string;
  assistant_message_id: string;
  reply: string;
}
