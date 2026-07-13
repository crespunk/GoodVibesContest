import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/session";
import { moveRoomSchema } from "@/lib/utils/validation";
import {
  moveRoom,
  markObjectInspected,
  addToInventory,
  getOrCreateSession,
} from "@/lib/db/game";
import { getRoom, getRoomObject } from "@/lib/game/rooms";
import { getPuzzle } from "@/lib/game/puzzles";
import type { RoomId, ItemId, PuzzleId, NpcId } from "@/types/game";
import { z } from "zod";

const inspectSchema = z.object({
  sessionId: z.string().cuid(),
  roomId: z.string().min(1).max(64),
  objectId: z.string().min(1).max(64),
  interactionId: z.string().min(1).max(64).optional(),
});

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl;
  const action = url.searchParams.get("action");

  if (action === "move") {
    return handleMove(req, user.userId);
  }
  if (action === "inspect") {
    return handleInspect(req, user.userId);
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}

async function handleMove(req: NextRequest, userId: string) {
  try {
    const body = await req.json();
    const parsed = moveRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { sessionId, targetRoom } = parsed.data;
    const gameState = await getOrCreateSession(userId, sessionId);

    if (gameState.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const room = getRoom(gameState.currentRoom as RoomId);
    const exit = room.exits.find((e) => e.to === targetRoom);

    if (!exit) {
      return NextResponse.json(
        { success: false, error: "No exit to that room from here" },
        { status: 400 }
      );
    }

    if (exit.isLocked) {
      if (exit.requiresItem) {
        const hasItem = gameState.inventory.some((i) => i.itemId === exit.requiresItem);
        if (!hasItem) {
          return NextResponse.json({
            success: false,
            error: exit.lockedMessage,
            code: "LOCKED",
          });
        }
      }
      if (exit.requiresPuzzleSolved) {
        const ps = gameState.puzzleStates[exit.requiresPuzzleSolved as PuzzleId];
        if (ps?.status !== "SOLVED") {
          return NextResponse.json({
            success: false,
            error: exit.lockedMessage,
            code: "LOCKED",
          });
        }
      }
    }

    await moveRoom(sessionId, targetRoom as RoomId);

    const isFirstVisit = !gameState.visitedRooms[targetRoom as RoomId]?.isVisited;
    const targetRoomDef = getRoom(targetRoom as RoomId);

    return NextResponse.json({
      success: true,
      data: {
        newRoom: targetRoom,
        isFirstVisit,
        narrative: isFirstVisit ? targetRoomDef.firstVisitNarrative : null,
      },
    });
  } catch (err) {
    console.error("Move room error:", err);
    return NextResponse.json({ success: false, error: "Move failed" }, { status: 500 });
  }
}

async function handleInspect(req: NextRequest, userId: string) {
  try {
    const body = await req.json();
    const parsed = inspectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { sessionId, roomId, objectId, interactionId } = parsed.data;
    const gameState = await getOrCreateSession(userId, sessionId);

    if (gameState.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const obj = getRoomObject(roomId as RoomId, objectId);
    if (!obj) {
      return NextResponse.json({ success: false, error: "Object not found" }, { status: 404 });
    }

    if (obj.requiresItem) {
      const hasItem = gameState.inventory.some((i) => i.itemId === obj.requiresItem);
      if (!hasItem) {
        return NextResponse.json({
          success: true,
          data: {
            examineText: `You need ${obj.requiresItem?.replace(/_/g, " ").toLowerCase()} to interact with this.`,
          },
        });
      }
    }

    await markObjectInspected(sessionId, roomId as RoomId, objectId);

    // If no interactionId, just return the object's examine text (panel open phase)
    if (!interactionId) {
      return NextResponse.json({
        success: true,
        data: { examineText: obj.examineText },
      });
    }

    const interaction = obj.interactions.find((i) => i.id === interactionId);
    if (!interaction) {
      return NextResponse.json({ success: false, error: "Interaction not found" }, { status: 404 });
    }

    // Check interaction-level puzzle requirement
    if (interaction.requiresPuzzleSolved) {
      const ps = gameState.puzzleStates[interaction.requiresPuzzleSolved as PuzzleId];
      if (ps?.status !== "SOLVED") {
        return NextResponse.json({
          success: true,
          data: { examineText: "You haven't solved the required puzzle yet." },
        });
      }
    }

    let itemObtained: ItemId | undefined;
    let puzzleTriggered: PuzzleId | undefined;
    let npcTriggered: NpcId | undefined;

    if (interaction.result.type === "take_item" && interaction.result.itemId) {
      const alreadyHas = gameState.inventory.some(
        (i) => i.itemId === interaction.result.itemId
      );
      if (!alreadyHas) {
        await addToInventory(
          sessionId,
          interaction.result.itemId as ItemId,
          `${roomId}:${objectId}`
        );
        itemObtained = interaction.result.itemId as ItemId;
      }
    }

    if (interaction.result.type === "open_puzzle") {
      puzzleTriggered = interaction.result.puzzleId as PuzzleId;
    }

    if (interaction.result.type === "open_dialogue") {
      npcTriggered = interaction.result.npcId as NpcId;
    }

    return NextResponse.json({
      success: true,
      data: {
        examineText: interaction.result.examineText ?? obj.examineText,
        itemObtained,
        puzzleTriggered,
        npcTriggered,
      },
    });
  } catch (err) {
    console.error("Inspect error:", err);
    return NextResponse.json({ success: false, error: "Inspect failed" }, { status: 500 });
  }
}
