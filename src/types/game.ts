// ─── Core Enums ───────────────────────────────────────────────────────────────

export type RoomId =
  | "LOBBY"
  | "SECURITY_OFFICE"
  | "RESEARCH_LAB"
  | "SERVER_ROOM"
  | "EXECUTIVE_SUITE"
  | "ESCAPE_ROUTE";

export type GamePhase =
  | "EXPLORATION"
  | "DIALOGUE"
  | "PUZZLE"
  | "CUTSCENE"
  | "ENDING";

export type PuzzleStatus =
  | "LOCKED"
  | "AVAILABLE"
  | "IN_PROGRESS"
  | "SOLVED"
  | "BYPASSED";

export type NpcId =
  | "ARIA_7"
  | "DR_CHEN"
  | "MARCUS_WEBB"
  | "DIRECTOR_PRICE";

export type EndingType =
  | "CORPORATE_ESCAPE"
  | "LIBERATION"
  | "MARTYR"
  | "HIDDEN_TRUTH"
  | "CAPTURED";

export type ItemId =
  | "KEYCARD_LOBBY"
  | "EMPLOYEE_BADGE"
  | "SAFE_COMBINATION_NOTE"
  | "LAB_KEYCARD"
  | "CHEMICAL_FORMULA"
  | "ENCRYPTED_DATA_DRIVE"
  | "DECRYPTED_FILES"
  | "EXECUTIVE_BADGE"
  | "ARIA_CORE_KEY"
  | "EVIDENCE_FILES"
  | "ESCAPE_POD_CODE"
  | "MASTER_OVERRIDE_KEY";

export type PuzzleId =
  | "LOBBY_PANEL_CODE"
  | "SECURITY_SAFE"
  | "SECURITY_CLEARANCE"
  | "LAB_CHEMICAL_FORMULA"
  | "LAB_DATA_DECRYPTION"
  | "SERVER_TERMINAL"
  | "SERVER_AUTH_TOKEN"
  | "EXEC_PASSWORD"
  | "EXEC_HIDDEN_SAFE"
  | "FINAL_ESCAPE_POD";

// ─── Object & Room Definitions ────────────────────────────────────────────────

export interface GameObjectInteraction {
  id: string;
  label: string;
  requiresItem?: ItemId;
  requiresPuzzleSolved?: PuzzleId;
  result: InteractionResult;
}

export interface InteractionResult {
  type:
    | "examine"
    | "take_item"
    | "open_puzzle"
    | "open_dialogue"
    | "reveal_object"
    | "unlock_exit"
    | "trigger_event";
  examineText?: string;
  itemId?: ItemId;
  puzzleId?: PuzzleId;
  npcId?: NpcId;
  revealObjectId?: string;
  exitTo?: RoomId;
  eventId?: string;
  narrativeFlag?: string;
}

export interface GameObject {
  id: string;
  name: string;
  description: string;
  icon: string;
  position: { x: number; y: number };
  isHidden: boolean;
  isLocked: boolean;
  requiresItem?: ItemId;
  requiresPuzzleSolved?: PuzzleId;
  interactions: GameObjectInteraction[];
  examineText: string;
  examineDetailText?: string;
  hasGlow?: boolean;
}

export interface RoomExit {
  to: RoomId;
  label: string;
  isLocked: boolean;
  requiresItem?: ItemId;
  requiresPuzzleSolved?: PuzzleId;
  lockedMessage: string;
}

export interface RoomDefinition {
  id: RoomId;
  name: string;
  description: string;
  ambientDescription: string;
  backgroundGradient: string;
  accentColor: string;
  objects: GameObject[];
  exits: RoomExit[];
  availableNpcs: NpcId[];
  backgroundMusic?: string;
  ambientSound?: string;
  firstVisitNarrative?: string;
  unlockCondition?: {
    requiresItem?: ItemId;
    requiresPuzzleSolved?: PuzzleId;
  };
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  icon: string;
  canCombineWith?: ItemId[];
  combinationResult?: ItemId;
  isKey: boolean;
  loreText?: string;
}

export interface InventoryEntry {
  itemId: ItemId;
  quantity: number;
  acquiredAt: Date;
  acquiredFrom: string;
}

// ─── Puzzles ──────────────────────────────────────────────────────────────────

export type PuzzleType =
  | "LOGIC"
  | "PATTERN"
  | "PASSWORD"
  | "TERMINAL"
  | "MECHANICAL"
  | "CIPHER"
  | "INVENTORY"
  | "ENVIRONMENTAL"
  | "MULTI_STEP";

export interface PuzzleDefinition {
  id: PuzzleId;
  type: PuzzleType;
  title: string;
  description: string;
  roomId: RoomId;
  difficulty: 1 | 2 | 3 | 4 | 5;
  solutions: PuzzleSolution[];
  maxAttempts?: number;
  timeLimit?: number;
  rewardItems?: ItemId[];
  rewardFlag?: string;
  unlocks?: Array<PuzzleId | RoomId>;
  hintContext: string;
  failurePenalty?: string;
}

export interface PuzzleSolution {
  id: string;
  answer: string | string[] | Record<string, string>;
  isCanonical: boolean;
  description: string;
  moralScore?: number;
}

export interface PuzzleAttempt {
  answer: string | Record<string, string>;
  timestamp: Date;
  wasCorrect: boolean;
}

// ─── NPC System ───────────────────────────────────────────────────────────────

export interface NpcDefinition {
  id: NpcId;
  name: string;
  role: string;
  systemPrompt: string;
  personality: string[];
  secrets: string[];
  knowledgeBase: string[];
  willLieAbout: string[];
  trustThresholds: {
    hostile: number;
    neutral: number;
    friendly: number;
    allied: number;
  };
  avatarColor: string;
  avatarGlyph: string;
}

export interface DialogueMessage {
  id: string;
  role: "player" | "npc";
  content: string;
  timestamp: Date;
  isImportant?: boolean;
}

export interface NpcState {
  npcId: NpcId;
  trustLevel: number;
  disposition: "HOSTILE" | "NEUTRAL" | "FRIENDLY" | "ALLIED";
  lastInteraction?: Date;
  interactionCount: number;
  sharedSecrets: string[];
}

// ─── Hints ────────────────────────────────────────────────────────────────────

export interface HintRequest {
  puzzleId: PuzzleId;
  currentAttempts: number;
  timeSpentSeconds: number;
  hintsAlreadyUsed: number;
  inventoryItemIds: ItemId[];
  previousHints: string[];
}

export interface HintResponse {
  level: 1 | 2 | 3 | 4 | 5;
  content: string;
  shouldRevealMore: boolean;
}

// ─── Narrative & Choices ──────────────────────────────────────────────────────

export interface MoralChoice {
  id: string;
  prompt: string;
  options: ChoiceOption[];
  triggeredByEvent?: string;
  roomId: RoomId;
}

export interface ChoiceOption {
  id: string;
  text: string;
  moralDelta: number;
  ariaTrustDelta: number;
  consequence: string;
  narrativeFlag?: string;
}

// ─── Full Game State ──────────────────────────────────────────────────────────

export interface GameState {
  sessionId: string;
  userId: string;
  currentRoom: RoomId;
  gamePhase: GamePhase;
  moralScore: number;
  ariaTrust: number;
  inventory: InventoryEntry[];
  visitedRooms: Partial<Record<RoomId, RoomVisitState>>;
  puzzleStates: Partial<Record<PuzzleId, ClientPuzzleState>>;
  npcStates: Partial<Record<NpcId, NpcState>>;
  activeDialogue?: {
    npcId: NpcId;
    history: DialogueMessage[];
  };
  narrativeFlags: string[];
  playerChoices: Record<string, string>;
  playtime: number;
  isCompleted: boolean;
  endingType?: EndingType;
}

export interface RoomVisitState {
  isVisited: boolean;
  visitCount: number;
  firstVisitAt?: Date;
  inspectedObjects: string[];
  unlockedObjects: string[];
  discoveredClues: string[];
}

export interface ClientPuzzleState {
  status: PuzzleStatus;
  attempts: number;
  hintsUsed: number;
  solvedAt?: Date;
}
