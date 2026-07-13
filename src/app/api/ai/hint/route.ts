import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/session";
import { hintRequestSchema } from "@/lib/utils/validation";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import {
  getOrCreateSession,
  saveHintEntry,
} from "@/lib/db/game";
import {
  generateHint,
  getNextHintLevel,
  getCacheKey,
  getCachedHint,
  setCachedHint,
} from "@/lib/ai/hints";
import { prisma } from "@/lib/db/client";
import type { PuzzleId, ItemId } from "@/types/game";

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = hintRequestSchema.safeParse({
    sessionId: searchParams.get("sessionId"),
    puzzleId: searchParams.get("puzzleId"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { sessionId, puzzleId } = parsed.data;

  try {
    const gameState = await getOrCreateSession(user.userId, sessionId);
    if (gameState.userId !== user.userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const puzzleState = gameState.puzzleStates[puzzleId as PuzzleId];

    const hintEntries = await prisma.hintEntry.findMany({
      where: { sessionId: gameState.sessionId, puzzleId },
      orderBy: { requestedAt: "asc" },
      select: { hintContent: true, hintLevel: true },
    });

    const hints = hintEntries.map((h: { hintContent: string; hintLevel: number }) => ({
      level: h.hintLevel,
      text: h.hintContent,
    }));

    const solved = puzzleState?.status === "SOLVED";
    const highestLevel = hints.length > 0 ? hints[hints.length - 1].level : 0;
    const hasMore = !solved && highestLevel < 5;

    return NextResponse.json({ success: true, data: { hints, hasMore } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Hint history error:", message);
    return NextResponse.json(
      { success: false, error: `Failed to load hints: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitKey = `hint:${user.userId}`;
  const rateResult = checkRateLimit(rateLimitKey);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many hint requests. Take a moment to think.", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = hintRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { sessionId, puzzleId } = parsed.data;
    const gameState = await getOrCreateSession(user.userId, sessionId);

    if (gameState.userId !== user.userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Use the resolved session ID (may differ from request if session wasn't found and a new one was created)
    const resolvedSessionId = gameState.sessionId;

    const puzzleState = gameState.puzzleStates[puzzleId as PuzzleId];
    if (puzzleState?.status === "SOLVED") {
      return NextResponse.json({
        success: true,
        data: { hint: "You've already solved this puzzle!", level: 0, hasMore: false },
      });
    }

    const hintsUsed = puzzleState?.hintsUsed ?? 0;
    const attempts = puzzleState?.attempts ?? 0;

    const previousHints = await prisma.hintEntry.findMany({
      where: { sessionId: resolvedSessionId, puzzleId },
      orderBy: { requestedAt: "asc" },
      select: { hintContent: true, hintLevel: true },
    });

    const previousHintTexts = previousHints.map((h: { hintContent: string }) => h.hintContent);
    const timeSpent = 0;

    const hintLevel = getNextHintLevel(hintsUsed, attempts, timeSpent);
    const inventoryItems = gameState.inventory.map((i) => i.itemId as ItemId);

    const cacheKey = getCacheKey({
      puzzleId: puzzleId as PuzzleId,
      hintLevel,
      currentAttempts: attempts,
      timeSpentSeconds: timeSpent,
      inventoryItems,
      previousHints: previousHintTexts,
      narrativeFlags: gameState.narrativeFlags,
    });

    let hint = getCachedHint(cacheKey);

    if (!hint) {
      hint = await generateHint({
        puzzleId: puzzleId as PuzzleId,
        hintLevel,
        currentAttempts: attempts,
        timeSpentSeconds: timeSpent,
        inventoryItems,
        previousHints: previousHintTexts,
        narrativeFlags: gameState.narrativeFlags,
      });
      setCachedHint(cacheKey, hint);
    }

    await saveHintEntry(resolvedSessionId, puzzleId as PuzzleId, hintLevel, hint);

    return NextResponse.json({
      success: true,
      data: {
        hint,
        level: hintLevel,
        hasMore: hintLevel < 5,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Hint error:", message);
    return NextResponse.json(
      { success: false, error: `Hint failed: ${message}` },
      { status: 500 }
    );
  }
}
