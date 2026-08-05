/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PLACEHOLDER DATA — replace with the real Copilot Studio embed before release
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The seeded conversation and the canned reply below exist so the widget can be
 * demonstrated end to end. Nothing here talks to Copilot Studio, and no answer
 * is real — the "assistant" returns the same placeholder every time, whatever
 * it is asked.
 *
 * This module is deliberately NOT behind `AccountService`. Routing it through
 * the Dataverse-bound service layer would imply this content comes from the
 * same pipeline as accounts and contracts, which it does not and never will —
 * Copilot Studio replaces this file wholesale.
 *
 * See README → "Copilot Studio widget" for what to delete when the real bot is
 * wired up.
 */

export type ChatRole = 'assistant' | 'user';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Set on seeded messages so they can be staggered in on first open. */
  seeded?: boolean;
}

/** PLACEHOLDER — an invented opening exchange, not a real Copilot transcript. */
export const SEEDED_CONVERSATION: ChatMessage[] = [
  {
    id: 'seed-1',
    role: 'assistant',
    text: 'Hello. I’m the SAIP assistant — I can pull together account context, spend history and contract detail so you don’t have to go looking for it.',
    seeded: true,
  },
  {
    id: 'seed-2',
    role: 'user',
    text: 'Which of my accounts have contracts renewing soon?',
    seeded: true,
  },
  {
    id: 'seed-3',
    role: 'assistant',
    text: 'Three accounts have contracts inside the 90-day renewal window. Caledonia Energy is the most urgent — Foundation Care 24x7 in Aberdeen renews in 11 days and there’s been no spend review for five months.',
    seeded: true,
  },
];

/** PLACEHOLDER — prompt chips offered under the seeded conversation. */
export const SUGGESTED_PROMPTS: string[] = [
  'Summarise Northwind Logistics',
  'Where is my SLA spend lowest?',
  'Who haven’t I met in 90 days?',
];

/**
 * PLACEHOLDER — the single canned reply.
 *
 * Every message gets this same response, by design: it quotes the question back
 * so the round trip is visibly working, then states plainly that it is not a
 * real answer. A convincing fake answer here would be worse than useless — it
 * would get screenshotted and mistaken for a working assistant.
 */
export function placeholderReply(question: string): string {
  const trimmed = question.trim();
  const quoted = trimmed.length > 90 ? `${trimmed.slice(0, 90)}…` : trimmed;
  return `You asked: “${quoted}”. This is a placeholder response — the SAIP assistant isn’t connected to Copilot Studio yet, so every reply is this same canned message. Once the bot is configured, real answers will appear here.`;
}

/** How long the typing indicator shows before the reply lands, in ms. */
export const TYPING_DELAY_MS = 1100;
