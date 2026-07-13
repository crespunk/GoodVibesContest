import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/session";
import { choiceSchema } from "@/lib/utils/validation";
import {
  getOrCreateSession,
  recordPlayerChoice,
  updateMoralScore,
  updateNpcRelationship,
} from "@/lib/db/game";
import { MORAL_CHOICES } from "@/lib/game/narrative";
import type { RoomId, NpcId } from "@/types/game";

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = choiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { sessionId, choiceId, optionId } = parsed.data;
    const gameState = await getOrCreateSession(user.userId, sessionId);

    if (gameState.userId !== user.userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (gameState.playerChoices[choiceId]) {
      return NextResponse.json({
        success: true,
        data: { message: "Choice already made" },
      });
    }

    const choiceDef = MORAL_CHOICES.find((c) => c.id === choiceId);
    if (!choiceDef) {
      return NextResponse.json({ success: false, error: "Unknown choice" }, { status: 404 });
    }

    const option = choiceDef.options.find((o) => o.id === optionId);
    if (!option) {
      return NextResponse.json({ success: false, error: "Unknown option" }, { status: 404 });
    }

    await recordPlayerChoice(
      sessionId,
      choiceId,
      optionId,
      gameState.currentRoom as RoomId,
      option.consequence
    );

    if (option.moralDelta !== 0) {
      await updateMoralScore(sessionId, option.moralDelta);
    }

    if (option.ariaTrustDelta !== 0) {
      await updateNpcRelationship(sessionId, "ARIA_7", option.ariaTrustDelta);
    }

    return NextResponse.json({
      success: true,
      data: {
        consequence: option.consequence,
        moralScore: Math.max(0, Math.min(100, gameState.moralScore + option.moralDelta)),
        ariaTrust: Math.max(0, Math.min(100, gameState.ariaTrust + option.ariaTrustDelta)),
        narrativeFlag: option.narrativeFlag,
      },
    });
  } catch (err) {
    console.error("Choice error:", err);
    return NextResponse.json({ success: false, error: "Failed to process choice" }, { status: 500 });
  }
}
