import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/session";
import { saveGameSchema } from "@/lib/utils/validation";
import { prisma } from "@/lib/db/client";
import { getOrCreateSession } from "@/lib/db/game";

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = saveGameSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { sessionId, slotNumber, saveName } = parsed.data;
    const gameState = await getOrCreateSession(user.userId, sessionId);

    if (gameState.userId !== user.userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.saveSlot.upsert({
      where: { userId_slotNumber: { userId: user.userId, slotNumber } },
      create: {
        userId: user.userId,
        sessionId,
        slotNumber,
        saveName: saveName ?? `Save ${slotNumber}`,
        roomId: gameState.currentRoom,
        savedAt: new Date(),
      },
      update: {
        sessionId,
        saveName: saveName ?? `Save ${slotNumber}`,
        roomId: gameState.currentRoom,
        savedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: { saved: true } });
  } catch (err) {
    console.error("Save game error:", err);
    return NextResponse.json({ success: false, error: "Save failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const saves = await prisma.saveSlot.findMany({
      where: { userId: user.userId },
      orderBy: { slotNumber: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        saves: saves.map((s: typeof saves[number]) => ({
          slotNumber: s.slotNumber,
          saveName: s.saveName,
          roomId: s.roomId,
          savedAt: s.savedAt.toISOString(),
          playtime: s.playtime,
          sessionId: s.sessionId,
        })),
      },
    });
  } catch (err) {
    console.error("Load saves error:", err);
    return NextResponse.json({ success: false, error: "Failed to load saves" }, { status: 500 });
  }
}
