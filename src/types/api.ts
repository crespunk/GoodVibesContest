import type { GameState, RoomId, PuzzleId, NpcId, ItemId } from "./game";

// ─── Generic API Response ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
  };
  token: string;
}

// ─── Game Session ─────────────────────────────────────────────────────────────

export interface CreateSessionRequest {
  slotNumber?: number;
}

export interface LoadSessionRequest {
  sessionId: string;
}

export interface GameStateResponse {
  gameState: GameState;
}

// ─── Room ─────────────────────────────────────────────────────────────────────

export interface InspectObjectRequest {
  sessionId: string;
  roomId: RoomId;
  objectId: string;
}

export interface InspectObjectResponse {
  examineText: string;
  itemObtained?: ItemId;
  puzzleTriggered?: PuzzleId;
  npcTriggered?: NpcId;
  eventTriggered?: string;
  narrativeUpdate?: string;
}

export interface MoveRoomRequest {
  sessionId: string;
  targetRoom: RoomId;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface CombineItemsRequest {
  sessionId: string;
  itemId1: ItemId;
  itemId2: ItemId;
}

export interface CombineItemsResponse {
  success: boolean;
  resultItem?: ItemId;
  message: string;
}

export interface UseItemRequest {
  sessionId: string;
  itemId: ItemId;
  targetObjectId?: string;
  targetPuzzleId?: PuzzleId;
}

// ─── Puzzle ───────────────────────────────────────────────────────────────────

export interface SubmitPuzzleRequest {
  sessionId: string;
  puzzleId: PuzzleId;
  answer: string | Record<string, string>;
}

export interface SubmitPuzzleResponse {
  correct: boolean;
  message: string;
  reward?: {
    items?: ItemId[];
    unlockedRooms?: RoomId[];
    narrativeFlag?: string;
  };
  attemptsRemaining?: number;
}

// ─── AI / NPC ─────────────────────────────────────────────────────────────────

export interface NpcMessageRequest {
  sessionId: string;
  npcId: NpcId;
  message: string;
  roomId: RoomId;
}

export interface NpcMessageResponse {
  reply: string;
  trustDelta: number;
  revealedSecrets?: string[];
  narrativeFlag?: string;
  dispositionChanged?: boolean;
}

// ─── Hints ────────────────────────────────────────────────────────────────────

export interface HintRequestBody {
  sessionId: string;
  puzzleId: PuzzleId;
}

export interface HintApiResponse {
  hint: string;
  level: number;
  hasMore: boolean;
}

// ─── Save / Load ──────────────────────────────────────────────────────────────

export interface SaveGameRequest {
  sessionId: string;
  slotNumber: 1 | 2 | 3;
  saveName?: string;
}

export interface SaveSlotInfo {
  slotNumber: number;
  saveName: string;
  roomId: RoomId;
  savedAt: string;
  playtime: number;
  sessionId: string;
}

// ─── Player Choice ────────────────────────────────────────────────────────────

export interface MakeChoiceRequest {
  sessionId: string;
  choiceId: string;
  optionId: string;
}

export interface MakeChoiceResponse {
  consequence: string;
  moralScore: number;
  ariaTrust: number;
  narrativeUpdate?: string;
}
