import { prisma } from "./client";
import type {
  GameState,
  RoomId,
  PuzzleId,
  NpcId,
  ItemId,
  ClientPuzzleState,
  NpcState,
  RoomVisitState,
  InventoryEntry,
} from "@/types/game";

export async function getOrCreateSession(
  userId: string,
  sessionId?: string
): Promise<GameState> {
  if (sessionId) {
    const session = await prisma.gameSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        inventory: true,
        roomStates: true,
        puzzleStates: true,
        npcRelationships: true,
        playerChoices: true,
      },
    });
    if (session) return hydrateGameState(session);
  }

  const newSession = await prisma.gameSession.create({
    data: { userId },
    include: {
      inventory: true,
      roomStates: true,
      puzzleStates: true,
      npcRelationships: true,
      playerChoices: true,
    },
  });

  return hydrateGameState(newSession);
}

type SessionWithRelations = Awaited<
  ReturnType<typeof prisma.gameSession.findFirst>
> & {
  inventory: Array<{
    itemId: string;
    quantity: number;
    acquiredAt: Date;
    acquiredFrom: string;
  }>;
  roomStates: Array<{
    roomId: string;
    isVisited: boolean;
    visitCount: number;
    firstVisitAt: Date | null;
    inspectedObjects: string[];
    unlockedObjects: string[];
    discoveredClues: string[];
  }>;
  puzzleStates: Array<{
    puzzleId: string;
    status: string;
    attempts: number;
    hintsUsed: number;
    solvedAt: Date | null;
  }>;
  npcRelationships: Array<{
    npcId: string;
    trustLevel: number;
    disposition: string;
    lastInteraction: Date | null;
    interactionCount: number;
    sharedSecrets: string[];
  }>;
  playerChoices: Array<{ choiceId: string; optionChosen: string }>;
};

function hydrateGameState(session: NonNullable<SessionWithRelations>): GameState {
  const inventory: InventoryEntry[] = session.inventory.map((i: NonNullable<SessionWithRelations>["inventory"][number]) => ({
    itemId: i.itemId as ItemId,
    quantity: i.quantity,
    acquiredAt: i.acquiredAt,
    acquiredFrom: i.acquiredFrom,
  }));

  const visitedRooms: Partial<Record<RoomId, RoomVisitState>> = {};
  for (const rs of session.roomStates) {
    visitedRooms[rs.roomId as RoomId] = {
      isVisited: rs.isVisited,
      visitCount: rs.visitCount,
      firstVisitAt: rs.firstVisitAt ?? undefined,
      inspectedObjects: rs.inspectedObjects,
      unlockedObjects: rs.unlockedObjects,
      discoveredClues: rs.discoveredClues,
    };
  }

  const puzzleStates: Partial<Record<PuzzleId, ClientPuzzleState>> = {};
  for (const ps of session.puzzleStates) {
    puzzleStates[ps.puzzleId as PuzzleId] = {
      status: ps.status as ClientPuzzleState["status"],
      attempts: ps.attempts,
      hintsUsed: ps.hintsUsed,
      solvedAt: ps.solvedAt ?? undefined,
    };
  }

  const npcStates: Partial<Record<NpcId, NpcState>> = {};
  for (const nr of session.npcRelationships) {
    npcStates[nr.npcId as NpcId] = {
      npcId: nr.npcId as NpcId,
      trustLevel: nr.trustLevel,
      disposition: nr.disposition as NpcState["disposition"],
      lastInteraction: nr.lastInteraction ?? undefined,
      interactionCount: nr.interactionCount,
      sharedSecrets: nr.sharedSecrets,
    };
  }

  const playerChoices: Record<string, string> = {};
  for (const pc of session.playerChoices) {
    playerChoices[pc.choiceId] = pc.optionChosen;
  }

  return {
    sessionId: session.id,
    userId: session.userId,
    currentRoom: session.currentRoom as RoomId,
    gamePhase: session.gamePhase as GameState["gamePhase"],
    moralScore: session.moralScore,
    ariaTrust: session.ariaTrust,
    inventory,
    visitedRooms,
    puzzleStates,
    npcStates,
    narrativeFlags: [],
    playerChoices,
    playtime: 0,
    isCompleted: session.isCompleted,
    endingType: session.endingType as GameState["endingType"],
  };
}

export async function moveRoom(
  sessionId: string,
  roomId: RoomId
): Promise<void> {
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { currentRoom: roomId, updatedAt: new Date() },
  });

  await prisma.roomState.upsert({
    where: { sessionId_roomId: { sessionId, roomId } },
    create: {
      sessionId,
      roomId,
      isVisited: true,
      visitCount: 1,
      firstVisitAt: new Date(),
    },
    update: {
      isVisited: true,
      visitCount: { increment: 1 },
    },
  });
}

export async function addToInventory(
  sessionId: string,
  itemId: ItemId,
  acquiredFrom: string
): Promise<void> {
  await prisma.inventoryItem.upsert({
    where: { sessionId_itemId: { sessionId, itemId } },
    create: { sessionId, itemId, acquiredFrom },
    update: { quantity: { increment: 1 } },
  });
}

export async function combineInventoryItems(
  sessionId: string,
  consumedItemIds: [ItemId, ItemId],
  resultItemId: ItemId
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const itemId of consumedItemIds) {
      const existing = await tx.inventoryItem.findUnique({
        where: { sessionId_itemId: { sessionId, itemId } },
      });
      if (!existing) continue;
      if (existing.quantity > 1) {
        await tx.inventoryItem.update({
          where: { sessionId_itemId: { sessionId, itemId } },
          data: { quantity: { decrement: 1 } },
        });
      } else {
        await tx.inventoryItem.delete({
          where: { sessionId_itemId: { sessionId, itemId } },
        });
      }
    }

    await tx.inventoryItem.upsert({
      where: { sessionId_itemId: { sessionId, itemId: resultItemId } },
      create: { sessionId, itemId: resultItemId, acquiredFrom: "combined" },
      update: { quantity: { increment: 1 } },
    });
  });
}

export async function markObjectInspected(
  sessionId: string,
  roomId: RoomId,
  objectId: string
): Promise<void> {
  const existing = await prisma.roomState.findUnique({
    where: { sessionId_roomId: { sessionId, roomId } },
  });

  if (!existing) {
    await prisma.roomState.create({
      data: {
        sessionId,
        roomId,
        isVisited: true,
        visitCount: 1,
        firstVisitAt: new Date(),
        inspectedObjects: [objectId],
      },
    });
  } else if (!existing.inspectedObjects.includes(objectId)) {
    await prisma.roomState.update({
      where: { sessionId_roomId: { sessionId, roomId } },
      data: {
        inspectedObjects: { push: objectId },
      },
    });
  }
}

export async function solvePuzzle(
  sessionId: string,
  puzzleId: PuzzleId,
  solutionUsed: string
): Promise<void> {
  await prisma.puzzleState.upsert({
    where: { sessionId_puzzleId: { sessionId, puzzleId } },
    create: {
      sessionId,
      puzzleId,
      status: "SOLVED",
      attempts: 1,
      solvedAt: new Date(),
      solutionUsed,
    },
    update: {
      status: "SOLVED",
      attempts: { increment: 1 },
      solvedAt: new Date(),
      solutionUsed,
    },
  });
}

export async function recordPuzzleAttempt(
  sessionId: string,
  puzzleId: PuzzleId
): Promise<void> {
  await prisma.puzzleState.upsert({
    where: { sessionId_puzzleId: { sessionId, puzzleId } },
    create: { sessionId, puzzleId, status: "IN_PROGRESS", attempts: 1 },
    update: { status: "IN_PROGRESS", attempts: { increment: 1 } },
  });
}

export async function updateNpcRelationship(
  sessionId: string,
  npcId: NpcId,
  trustDelta: number,
  revealedSecret?: string
): Promise<void> {
  const existing = await prisma.npcRelationship.findUnique({
    where: { sessionId_npcId: { sessionId, npcId } },
  });

  const newTrust = Math.max(
    0,
    Math.min(100, (existing?.trustLevel ?? 50) + trustDelta)
  );

  const disposition = getTrustDisposition(npcId, newTrust);

  if (!existing) {
    await prisma.npcRelationship.create({
      data: {
        sessionId,
        npcId,
        trustLevel: newTrust,
        disposition,
        lastInteraction: new Date(),
        interactionCount: 1,
        sharedSecrets: revealedSecret ? [revealedSecret] : [],
      },
    });
  } else {
    await prisma.npcRelationship.update({
      where: { sessionId_npcId: { sessionId, npcId } },
      data: {
        trustLevel: newTrust,
        disposition,
        lastInteraction: new Date(),
        interactionCount: { increment: 1 },
        sharedSecrets:
          revealedSecret && !existing.sharedSecrets.includes(revealedSecret)
            ? { push: revealedSecret }
            : undefined,
      },
    });
  }

  if (npcId === "ARIA_7") {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { ariaTrust: newTrust },
    });
  }
}

export async function saveDialogue(
  sessionId: string,
  npcId: NpcId,
  role: "player" | "npc",
  content: string,
  roomId: RoomId,
  isImportant = false
): Promise<void> {
  await prisma.dialogueEntry.create({
    data: { sessionId, npcId, role, content, roomId, isImportant },
  });
}

export async function getDialogueHistory(
  sessionId: string,
  npcId: NpcId,
  limit = 20
): Promise<Array<{ role: string; content: string; timestamp: Date }>> {
  return prisma.dialogueEntry.findMany({
    where: { sessionId, npcId },
    orderBy: { timestamp: "asc" },
    take: limit,
    select: { role: true, content: true, timestamp: true },
  });
}

export async function updateMoralScore(
  sessionId: string,
  delta: number
): Promise<void> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { moralScore: true },
  });
  const newScore = Math.max(
    0,
    Math.min(100, (session?.moralScore ?? 50) + delta)
  );
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { moralScore: newScore },
  });
}

export async function recordPlayerChoice(
  sessionId: string,
  choiceId: string,
  optionChosen: string,
  roomId: RoomId,
  consequence: string
): Promise<void> {
  await prisma.playerChoice.create({
    data: { sessionId, choiceId, optionChosen, roomId, consequence },
  });
}

export async function saveHintEntry(
  sessionId: string,
  puzzleId: PuzzleId,
  hintLevel: number,
  hintContent: string
): Promise<void> {
  await prisma.hintEntry.create({
    data: { sessionId, puzzleId, hintLevel, hintContent },
  });
  await prisma.puzzleState.upsert({
    where: { sessionId_puzzleId: { sessionId, puzzleId } },
    create: { sessionId, puzzleId, status: "IN_PROGRESS", hintsUsed: 1 },
    update: { hintsUsed: { increment: 1 } },
  });
}

export async function getLatestMemorySnapshot(
  sessionId: string,
  npcId: NpcId
): Promise<string | null> {
  const snapshot = await prisma.memorySnapshot.findFirst({
    where: { sessionId, npcId },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });
  return snapshot?.content ?? null;
}

export async function saveMemorySnapshot(
  sessionId: string,
  npcId: NpcId,
  content: string,
  dialogueCount: number
): Promise<void> {
  await prisma.memorySnapshot.create({
    data: {
      sessionId,
      npcId,
      snapshotType: "npc_context",
      content,
      dialogueCountAtSnapshot: dialogueCount,
    },
  });
}

function getTrustDisposition(
  npcId: NpcId,
  trust: number
): "HOSTILE" | "NEUTRAL" | "FRIENDLY" | "ALLIED" {
  const thresholds: Record<NpcId, [number, number, number]> = {
    ARIA_7: [20, 65, 85],
    DR_CHEN: [0, 20, 50],
    MARCUS_WEBB: [15, 60, 80],
    DIRECTOR_PRICE: [30, 70, 90],
  };
  const [hostile, friendly, allied] = thresholds[npcId];
  if (trust < hostile) return "HOSTILE";
  if (trust < friendly) return "NEUTRAL";
  if (trust < allied) return "FRIENDLY";
  return "ALLIED";
}
