/**
 * Hint System Design:
 * - 5 levels: subtle → explicit
 * - AI evaluates full game context before generating
 * - Cached by (puzzleId + hintLevel + keyState) to avoid repeat API calls
 * - Never gives the answer directly; level 5 gives it as a last resort
 */

import { getGroqClient, AI_CONFIG } from "./client";
import { getPuzzle } from "@/lib/game/puzzles";
import type { PuzzleId, ItemId } from "@/types/game";

export interface HintGenerationParams {
  puzzleId: PuzzleId;
  hintLevel: 1 | 2 | 3 | 4 | 5;
  currentAttempts: number;
  timeSpentSeconds: number;
  inventoryItems: ItemId[];
  previousHints: string[];
  narrativeFlags: string[];
}

const HINT_LEVEL_INSTRUCTIONS = [
  "", // padding for 1-indexed access
  "Give an extremely subtle atmospheric hint. Reference the room environment or a vague feeling. Do not reference the puzzle mechanism at all. 1-2 sentences.",
  "Give a gentle directional hint. Point toward the type of thinking needed (pattern, sequence, cipher, etc.) without specifics. 1-2 sentences.",
  "Give a more specific hint. Reference the actual clues the player has found and how they relate. 2-3 sentences.",
  "Give a guided hint. Walk through the logic step by step, stopping just before the answer. 2-3 sentences.",
  "Give the complete solution with a brief explanation of why this is the answer. Be direct and clear.",
];

export async function generateHint(
  params: HintGenerationParams
): Promise<string> {
  const client = getGroqClient();
  const puzzle = getPuzzle(params.puzzleId);
  const levelInstruction = HINT_LEVEL_INSTRUCTIONS[params.hintLevel];

  const contextBlock = `
PUZZLE: ${puzzle.title}
PUZZLE TYPE: ${puzzle.type}
PUZZLE DESCRIPTION: ${puzzle.description}
ROOM: ${puzzle.roomId}
HINT CONTEXT: ${puzzle.hintContext}
PLAYER ATTEMPTS: ${params.currentAttempts}
TIME SPENT: ${Math.round(params.timeSpentSeconds / 60)} minutes
INVENTORY ITEMS: ${params.inventoryItems.join(", ") || "none"}
NARRATIVE FLAGS: ${params.narrativeFlags.join(", ") || "none"}
PREVIOUS HINTS GIVEN: ${params.previousHints.length > 0 ? params.previousHints.join(" | ") : "none"}`.trim();

  const systemPrompt = `You are the AI hint system for "Nexus Protocol," an immersive escape room game.
Generate hints that feel like they come from the game world itself — atmospheric, immersive, never breaking the fourth wall.
Never say "hint" or "answer." Phrase it as an in-world observation or realization.
${levelInstruction}`;

  const response = await client.chat.completions.create({
    model: AI_CONFIG.model,
    max_tokens: AI_CONFIG.hintMaxTokens,
    temperature: AI_CONFIG.temperature,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Generate a level ${params.hintLevel} hint for:\n\n${contextBlock}`,
      },
    ],
  });

  return response.choices[0]?.message?.content ?? "The answer lies somewhere in what you've already discovered.";
}

export function getNextHintLevel(
  currentHintsUsed: number,
  attempts: number,
  timeSeconds: number
): 1 | 2 | 3 | 4 | 5 {
  const suggested = currentHintsUsed + 1;
  const urgency = Math.floor(attempts / 3) + Math.floor(timeSeconds / 300);
  const recommended = Math.min(5, Math.max(1, suggested + Math.floor(urgency / 2)));
  return Math.min(5, recommended) as 1 | 2 | 3 | 4 | 5;
}

const hintCache = new Map<string, { hint: string; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

export function getCacheKey(params: HintGenerationParams): string {
  return `${params.puzzleId}:${params.hintLevel}:${params.inventoryItems.sort().join(",")}`;
}

export function getCachedHint(key: string): string | null {
  const cached = hintCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    hintCache.delete(key);
    return null;
  }
  return cached.hint;
}

export function setCachedHint(key: string, hint: string): void {
  hintCache.set(key, { hint, timestamp: Date.now() });
}
