import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/session";
import { getOrCreateSession } from "@/lib/db/game";
import { prisma } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const gameState = await getOrCreateSession(user.userId);
    return NextResponse.json({ success: true, data: { gameState } });
  } catch (err) {
    console.error("Create session error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create session" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "sessionId required" }, { status: 400 });
    }

    const gameState = await getOrCreateSession(user.userId, sessionId);
    return NextResponse.json({ success: true, data: { gameState } });
  } catch (err) {
    console.error("Get session error:", err);
    return NextResponse.json(
      { success: false, error: "Session not found" },
      { status: 404 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ success: false, error: "sessionId required" }, { status: 400 });
  }

  await prisma.gameSession.deleteMany({
    where: { id: sessionId, userId: user.userId },
  });

  return NextResponse.json({ success: true });
}
