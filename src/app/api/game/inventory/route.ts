import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/session";
import { combineItemsSchema } from "@/lib/utils/validation";
import { combineInventoryItems, getOrCreateSession } from "@/lib/db/game";
import { getCombinationResult } from "@/lib/game/items";
import type { ItemId } from "@/types/game";

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl;
  const action = url.searchParams.get("action");

  if (action === "combine") {
    return handleCombine(req, user.userId);
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}

async function handleCombine(req: NextRequest, userId: string) {
  try {
    const body = await req.json();
    const parsed = combineItemsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { sessionId, itemId1, itemId2 } = parsed.data;
    const gameState = await getOrCreateSession(userId, sessionId);

    if (gameState.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const hasBoth =
      gameState.inventory.some((i) => i.itemId === itemId1) &&
      gameState.inventory.some((i) => i.itemId === itemId2);
    if (!hasBoth) {
      return NextResponse.json({ success: false, error: "You don't have both items" }, { status: 400 });
    }

    const resultItemId = getCombinationResult(itemId1 as ItemId, itemId2 as ItemId);
    if (!resultItemId) {
      return NextResponse.json({ success: true, data: { resultItemId: null } });
    }

    await combineInventoryItems(sessionId, [itemId1 as ItemId, itemId2 as ItemId], resultItemId);

    return NextResponse.json({ success: true, data: { resultItemId } });
  } catch (err) {
    console.error("Combine items error:", err);
    return NextResponse.json({ success: false, error: "Combine failed" }, { status: 500 });
  }
}
