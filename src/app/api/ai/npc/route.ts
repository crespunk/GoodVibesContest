import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/session";
import { npcMessageSchema, sanitizeInput } from "@/lib/utils/validation";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import {
  getOrCreateSession,
  updateNpcRelationship,
  saveDialogue,
  getDialogueHistory,
  getLatestMemorySnapshot,
  saveMemorySnapshot,
} from "@/lib/db/game";
import { generateNpcResponse } from "@/lib/ai/npc";
import {
  generateConversationSummary,
  shouldGenerateSummary,
} from "@/lib/ai/memory";
import type { NpcId, RoomId, DialogueMessage } from "@/types/game";

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitKey = `npc:${user.userId}`;
  const rateResult = checkRateLimit(rateLimitKey);
  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests. Please wait before sending another message.",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateResult.resetAt.toString(),
        },
      }
    );
  }

  try {
    const body = await req.json();
    const parsed = npcMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { sessionId, npcId, message, roomId } = parsed.data;
    const sanitizedMessage = sanitizeInput(message);

    const gameState = await getOrCreateSession(user.userId, sessionId);
    if (gameState.userId !== user.userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const rawHistory = await getDialogueHistory(sessionId, npcId as NpcId, 30);
    const conversationHistory: DialogueMessage[] = rawHistory.map((h, i) => ({
      id: `hist-${i}`,
      role: h.role as "player" | "npc",
      content: h.content,
      timestamp: h.timestamp,
    }));

    const warmMemory = await getLatestMemorySnapshot(sessionId, npcId as NpcId);

    const response = await generateNpcResponse(
      npcId as NpcId,
      sanitizedMessage,
      conversationHistory,
      gameState,
      warmMemory ?? undefined
    );

    await saveDialogue(
      sessionId,
      npcId as NpcId,
      "player",
      sanitizedMessage,
      roomId as RoomId,
      false
    );

    await saveDialogue(
      sessionId,
      npcId as NpcId,
      "npc",
      response.reply,
      roomId as RoomId,
      !!response.revealedSecret
    );

    if (response.trustDelta !== 0) {
      await updateNpcRelationship(
        sessionId,
        npcId as NpcId,
        response.trustDelta,
        response.revealedSecret
      );
    }

    const totalMessages = conversationHistory.length + 2;
    if (shouldGenerateSummary(totalMessages)) {
      const allHistory: DialogueMessage[] = [
        ...conversationHistory,
        {
          id: "new-player",
          role: "player",
          content: sanitizedMessage,
          timestamp: new Date(),
        },
        {
          id: "new-npc",
          role: "npc",
          content: response.reply,
          timestamp: new Date(),
        },
      ];

      const npcName =
        npcId === "ARIA_7"
          ? "ARIA-7"
          : npcId === "DR_CHEN"
            ? "Dr. Chen"
            : npcId === "MARCUS_WEBB"
              ? "Marcus"
              : "Director Price";

      generateConversationSummary(
        npcId as NpcId,
        npcName,
        allHistory,
        warmMemory ?? undefined
      )
        .then((summary) =>
          saveMemorySnapshot(sessionId, npcId as NpcId, summary, totalMessages)
        )
        .catch((err) => console.error("Summary generation failed:", err));
    }

    return NextResponse.json({
      success: true,
      data: {
        reply: response.reply,
        trustDelta: response.trustDelta,
        revealedSecrets: response.revealedSecret ? [response.revealedSecret] : [],
        narrativeFlag: response.narrativeFlag,
      },
    });
  } catch (err) {
    console.error("NPC dialogue error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
