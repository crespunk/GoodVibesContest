import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/session";
import { submitPuzzleSchema } from "@/lib/utils/validation";
import {
  solvePuzzle,
  recordPuzzleAttempt,
  addToInventory,
  getOrCreateSession,
  updateMoralScore,
} from "@/lib/db/game";
import { validatePuzzleAnswer, getPuzzle } from "@/lib/game/puzzles";
import type { PuzzleId, ItemId } from "@/types/game";

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = submitPuzzleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { sessionId, puzzleId, answer } = parsed.data;
    const gameState = await getOrCreateSession(user.userId, sessionId);

    if (gameState.userId !== user.userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const puzzleState = gameState.puzzleStates[puzzleId as PuzzleId];
    if (puzzleState?.status === "SOLVED") {
      return NextResponse.json({
        success: true,
        data: { correct: true, message: "Already solved!" },
      });
    }

    const puzzle = getPuzzle(puzzleId as PuzzleId);
    const answerStr = typeof answer === "string" ? answer : JSON.stringify(answer);
    const result = validatePuzzleAnswer(puzzleId as PuzzleId, answerStr);

    if (result.correct) {
      await solvePuzzle(sessionId, puzzleId as PuzzleId, result.solutionId ?? "canonical");

      const rewardItems: ItemId[] = [];
      if (puzzle.rewardItems) {
        for (const itemId of puzzle.rewardItems) {
          const alreadyHas = gameState.inventory.some((i) => i.itemId === itemId);
          if (!alreadyHas) {
            await addToInventory(sessionId, itemId, `puzzle:${puzzleId}`);
            rewardItems.push(itemId);
          }
        }
      }

      if (result.moralScore !== 0) {
        await updateMoralScore(sessionId, result.moralScore);
      }

      return NextResponse.json({
        success: true,
        data: {
          correct: true,
          message: getSuccessMessage(puzzleId as PuzzleId),
          reward: {
            items: rewardItems,
            narrativeFlag: puzzle.rewardFlag,
          },
        },
      });
    } else {
      await recordPuzzleAttempt(sessionId, puzzleId as PuzzleId);

      const maxAttempts = puzzle.maxAttempts;
      const currentAttempts = (puzzleState?.attempts ?? 0) + 1;

      return NextResponse.json({
        success: true,
        data: {
          correct: false,
          message: getFailureMessage(puzzleId as PuzzleId, currentAttempts),
          attemptsRemaining: maxAttempts
            ? Math.max(0, maxAttempts - currentAttempts)
            : undefined,
        },
      });
    }
  } catch (err) {
    console.error("Puzzle submit error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to process answer" },
      { status: 500 }
    );
  }
}

function getSuccessMessage(puzzleId: PuzzleId): string {
  const messages: Partial<Record<PuzzleId, string>> = {
    LOBBY_PANEL_CODE: "The panel beeps and the Security Office door unlocks.",
    SECURITY_SAFE:
      "The safe clicks open. Inside you find a red laboratory keycard.",
    SECURITY_CLEARANCE:
      "NEXUS accepted. The corridor door slides open with a hiss.",
    LAB_CHEMICAL_FORMULA:
      "The cabinet clicks open. The chemical compounds inside might be useful.",
    LAB_DATA_DECRYPTION:
      "ARIA-7 IS CONSCIOUS. The words appear on screen. You now have the ARIA Core Key.",
    SERVER_TERMINAL: "Root access granted. The power grid panel unlocks.",
    SERVER_AUTH_TOKEN:
      "Authorization complete. The executive elevator activates.",
    EXEC_PASSWORD: "Access granted. Director Price's files are yours.",
    EXEC_HIDDEN_SAFE: "The safe swings open. The Master Override Key is inside.",
    FINAL_ESCAPE_POD: "Launch sequence accepted. The escape pod is ready.",
  };
  return messages[puzzleId] ?? "Correct. Access granted.";
}

function getFailureMessage(puzzleId: PuzzleId, attempt: number): string {
  if (attempt === 1) return "Incorrect. Try again — check your clues.";
  if (attempt === 2) return "Still incorrect. Review the evidence you've gathered.";
  if (attempt >= 3) return "The system rejects your answer. Consider requesting a hint.";
  return "Incorrect.";
}
