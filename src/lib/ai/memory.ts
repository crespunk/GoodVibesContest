/**
 * AI Memory Management
 *
 * Architecture: Three-tier memory system
 * - HOT: Last 8 dialogue messages (always in context)
 * - WARM: AI-generated summary of conversation + key events (compressed, cached)
 * - COLD: Full history in DB (only retrieved for specific queries)
 *
 * Why this design:
 * - Keeps token costs low by not sending the full history every request
 * - Maintains continuity via compressed summaries
 * - Allows NPCs to "remember" without unlimited context windows
 */

import { getGroqClient, AI_CONFIG } from "./client";
import type { DialogueMessage, NpcId, GameState } from "@/types/game";

const SUMMARY_TRIGGER_COUNT = 10;
const HOT_MESSAGES_KEPT = 8;

export interface ConversationContext {
  npcId: NpcId;
  warmMemory: string;
  hotMessages: DialogueMessage[];
  gameContext: GameContextSummary;
}

export interface GameContextSummary {
  currentRoom: string;
  solvedPuzzles: string[];
  inventoryItems: string[];
  narrativeFlags: string[];
  moralScore: number;
  ariaTrust: number;
  npcDisposition: string;
}

export function buildGameContext(
  state: GameState,
  npcId: NpcId
): GameContextSummary {
  const solvedPuzzles = Object.entries(state.puzzleStates)
    .filter(([, ps]) => ps.status === "SOLVED")
    .map(([id]) => id);

  const inventoryItems = state.inventory.map((i) => i.itemId);
  const npcState = state.npcStates[npcId];

  return {
    currentRoom: state.currentRoom,
    solvedPuzzles,
    inventoryItems,
    narrativeFlags: state.narrativeFlags,
    moralScore: state.moralScore,
    ariaTrust: state.ariaTrust,
    npcDisposition: npcState?.disposition ?? "NEUTRAL",
  };
}

export function buildContextInjection(ctx: GameContextSummary): string {
  return `
CURRENT GAME STATE (USE THIS TO INFORM YOUR RESPONSES):
- Player location: ${ctx.currentRoom}
- Moral alignment: ${ctx.moralScore}/100 (${ctx.moralScore > 60 ? "leaning ethical" : ctx.moralScore < 40 ? "leaning self-interested" : "neutral"})
- ARIA-7 trust level: ${ctx.ariaTrust}/100
- Player's relationship with you: ${ctx.npcDisposition}
- Puzzles solved: ${ctx.solvedPuzzles.length > 0 ? ctx.solvedPuzzles.join(", ") : "none yet"}
- Items in inventory: ${ctx.inventoryItems.length > 0 ? ctx.inventoryItems.join(", ") : "none"}
- Story flags triggered: ${ctx.narrativeFlags.length > 0 ? ctx.narrativeFlags.join(", ") : "none"}

Adapt your responses based on this context. Reference specific items or achievements when relevant.`.trim();
}

export function shouldGenerateSummary(messageCount: number): boolean {
  return messageCount > 0 && messageCount % SUMMARY_TRIGGER_COUNT === 0;
}

export function getHotMessages(history: DialogueMessage[]): DialogueMessage[] {
  return history.slice(-HOT_MESSAGES_KEPT);
}

export async function generateConversationSummary(
  npcId: NpcId,
  npcName: string,
  history: DialogueMessage[],
  previousSummary?: string
): Promise<string> {
  const client = getGroqClient();
  const recentHistory = history
    .slice(-SUMMARY_TRIGGER_COUNT)
    .map((m) => `${m.role === "player" ? "Player" : npcName}: ${m.content}`)
    .join("\n");

  const prompt = previousSummary
    ? `Previous summary: ${previousSummary}\n\nNew dialogue to incorporate:\n${recentHistory}\n\nCreate an updated, concise summary (max 150 words) of the key points from this conversation: what was learned, what trust was built or lost, what important information was shared, and the current emotional/relational tone.`
    : `Summarize this dialogue (max 150 words) focusing on: key information exchanged, trust dynamics, emotional tone, and important revelations:\n\n${recentHistory}`;

  const response = await client.chat.completions.create({
    model: AI_CONFIG.model,
    max_tokens: AI_CONFIG.summaryMaxTokens,
    temperature: 0.5,
    messages: [
      { role: "system", content: "You are summarizing NPC dialogue for an AI escape room game. Be concise and focus on game-relevant details." },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0]?.message?.content ?? "No summary available.";
}

export function formatHistoryForAI(
  messages: DialogueMessage[]
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages.map((m) => ({
    role: m.role === "player" ? "user" : "assistant",
    content: m.content,
  }));
}
