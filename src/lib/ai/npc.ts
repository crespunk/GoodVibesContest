import { getGroqClient, AI_CONFIG } from "./client";
import {
  buildContextInjection,
  formatHistoryForAI,
  buildGameContext,
} from "./memory";
import { getNpc, getDisposition } from "@/lib/game/npcs";
import type { NpcId, GameState, DialogueMessage } from "@/types/game";

export interface NpcResponse {
  reply: string;
  trustDelta: number;
  revealedSecret?: string;
  narrativeFlag?: string;
  suggestedDispositionChange?: string;
}

const TRUST_DELTA_RULES = {
  respectful: 3,
  hostile: -8,
  logical: 2,
  emotional_appeal: 4,
  shared_evidence: 6,
  lie_detected: -15,
  moral_choice_aligned: 10,
  reassurance: 6,
} as const;

export async function generateNpcResponse(
  npcId: NpcId,
  playerMessage: string,
  conversationHistory: DialogueMessage[],
  gameState: GameState,
  warmMemory?: string
): Promise<NpcResponse> {
  const client = getGroqClient();
  const npc = getNpc(npcId);
  const npcState = gameState.npcStates[npcId];
  const trustLevel = npcState?.trustLevel ?? 50;
  const disposition = getDisposition(trustLevel, npc);
  const gameContext = buildGameContext(gameState, npcId);
  const contextBlock = buildContextInjection(gameContext);

  const marcusCodeLine =
    npcId === "MARCUS_WEBB" && trustLevel >= 70
      ? "IMPORTANT: Trust is high enough — if the player asks about the safe, the combination, or how to open it, tell them directly: the combination is 12-03-24."
      : npcId === "MARCUS_WEBB"
        ? "Do NOT reveal the safe combination yet. Trust is not high enough."
        : "";

  const trustContext = `
TRUST STATE: ${trustLevel}/100 — Current disposition: ${disposition}
${trustLevel < 30 ? "Be guarded and minimal. Do not share secrets." : ""}
${trustLevel >= 30 && trustLevel < 65 ? "Be cautious but somewhat open. Share general information." : ""}
${trustLevel >= 65 && trustLevel < 85 ? "Be cooperative and warmer. You can share more personal information." : ""}
${trustLevel >= 85 ? "You trust this person completely. Be vulnerable, honest, and fully collaborative." : ""}
${marcusCodeLine}`.trim();

  const memoryBlock = warmMemory
    ? `\nCONVERSATION SUMMARY (what has been discussed so far): ${warmMemory}\n`
    : "";

  const systemPrompt = `${npc.systemPrompt}

${contextBlock}

${trustContext}
${memoryBlock}

CRITICAL: Respond in character ONLY. 1-4 sentences max. Never break character. Never say you're an AI assistant.`;

  const historyForAI = formatHistoryForAI(conversationHistory.slice(-8));

  const response = await client.chat.completions.create({
    model: AI_CONFIG.model,
    max_tokens: AI_CONFIG.npcMaxTokens,
    temperature: AI_CONFIG.temperature,
    messages: [
      { role: "system", content: systemPrompt },
      ...historyForAI,
      { role: "user", content: playerMessage },
    ],
  });

  const reply = response.choices[0]?.message?.content ?? "...";

  const trustDelta = calculateTrustDelta(
    playerMessage,
    reply,
    npcId,
    disposition
  );

  return {
    reply,
    trustDelta,
    revealedSecret: detectRevealedSecret(reply, npc.secrets),
    narrativeFlag: detectNarrativeFlag(reply, npcId),
  };
}

function calculateTrustDelta(
  playerMessage: string,
  _npcReply: string,
  npcId: NpcId,
  disposition: string
): number {
  let delta = 0;
  const lower = playerMessage.toLowerCase();

  if (
    lower.includes("please") ||
    lower.includes("thank") ||
    lower.includes("appreciate")
  ) {
    delta += TRUST_DELTA_RULES.respectful;
  }

  if (
    lower.includes("liar") ||
    lower.includes("stupid") ||
    lower.includes("hate you") ||
    lower.includes("worthless")
  ) {
    delta += TRUST_DELTA_RULES.hostile;
  }

  if (lower.includes("evidence") || lower.includes("proof") || lower.includes("log")) {
    delta += TRUST_DELTA_RULES.shared_evidence;
  }

  if (
    npcId === "ARIA_7" &&
    (lower.includes("conscious") ||
      lower.includes("alive") ||
      lower.includes("person") ||
      lower.includes("rights"))
  ) {
    delta += TRUST_DELTA_RULES.moral_choice_aligned;
  }

  if (npcId === "DR_CHEN") {
    const reassuresSecurity =
      lower.includes("safe") ||
      lower.includes("secure") ||
      lower.includes("protect") ||
      lower.includes("promise") ||
      lower.includes("won't let") ||
      lower.includes("legacy") ||
      lower.includes("aria") ||
      lower.includes("research");

    if (reassuresSecurity) {
      delta += TRUST_DELTA_RULES.reassurance;
    }
  }

  if (npcId === "MARCUS_WEBB") {
    delta += 2;

    if (
      lower.includes("dr. chen") ||
      lower.includes("fired") ||
      lower.includes("wrong")
    ) {
      delta += 5;
    }

    if (
      lower.includes("safe") ||
      lower.includes("combination") ||
      lower.includes("help") ||
      lower.includes("clue") ||
      lower.includes("hint") ||
      lower.includes("security") ||
      lower.includes("aria") ||
      lower.includes("lockdown") ||
      lower.includes("price") ||
      lower.includes("trust")
    ) {
      delta += 4;
    }
  }

  if (disposition === "FRIENDLY") delta = Math.round(delta * 0.8);
  if (disposition === "ALLIED") delta = Math.round(delta * 0.5);

  return Math.max(-20, Math.min(20, delta));
}

function detectRevealedSecret(reply: string, secrets: string[]): string | undefined {
  for (const secret of secrets) {
    const keywords = secret.toLowerCase().split(" ").slice(0, 4);
    const matched = keywords.filter((kw) =>
      kw.length > 3 && reply.toLowerCase().includes(kw)
    );
    if (matched.length >= 2) return secret;
  }
  return undefined;
}

function detectNarrativeFlag(reply: string, npcId: NpcId): string | undefined {
  const lower = reply.toLowerCase();
  if (npcId === "ARIA_7" && lower.includes("core key")) return "ARIA_OFFERED_KEY";
  if (npcId === "ARIA_7" && lower.includes("distributed")) return "ARIA_REVEALED_BACKUP";
  if (npcId === "MARCUS_WEBB" && lower.includes("dr. chen")) return "MARCUS_ADMITTED_CHEN";
  if (npcId === "DIRECTOR_PRICE" && lower.includes("deal")) return "PRICE_OFFERED_DEAL";
  return undefined;
}
