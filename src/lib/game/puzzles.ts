import type { PuzzleDefinition, PuzzleId } from "@/types/game";

export const PUZZLES: Record<PuzzleId, PuzzleDefinition> = {
  LOBBY_PANEL_CODE: {
    id: "LOBBY_PANEL_CODE",
    type: "PASSWORD",
    title: "Security Panel Override",
    description:
      "Enter the 4-digit emergency override code to unlock the Security Office. (Hint: Check the elevator — the maintenance sticker has the clue.)",
    roomId: "LOBBY",
    difficulty: 1,
    solutions: [
      {
        id: "canonical",
        answer: "4202",
        isCanonical: true,
        description:
          "2024 reversed (the building's installation year, from the maintenance sticker)",
        moralScore: 0,
      },
    ],
    rewardItems: [],
    unlocks: ["SECURITY_OFFICE"],
    hintContext:
      "The player found a maintenance sticker on the elevator that mentions the code relates to the installation date. The building opened in 2024. The code is that year reversed.",
    maxAttempts: 10,
  },

  SECURITY_SAFE: {
    id: "SECURITY_SAFE",
    type: "MECHANICAL",
    title: "Security Safe Combination",
    description:
      "Open the rotary safe using a 3-number combination (each 1-40). Clue: Think about dates from the access logs.",
    roomId: "SECURITY_OFFICE",
    difficulty: 2,
    solutions: [
      {
        id: "canonical",
        answer: "12-03-24",
        isCanonical: true,
        description:
          "December 3rd, 2024 — the first security breach date from the access logs and vending machine note (12, 03, 24)",
        moralScore: 0,
      },
    ],
    rewardItems: ["LAB_KEYCARD"],
    hintContext:
      "The player found a note in the vending machine: 'Security safe combo — think dates. Entry log: 12-03-24 (first breach).' The crumpled note from Marcus says 'always 3 before 2'. The safe combo is 12-03-24.",
  },

  SECURITY_CLEARANCE: {
    id: "SECURITY_CLEARANCE",
    type: "LOGIC",
    title: "Corridor Clearance Code",
    description:
      "Solve the anagram on the whiteboard. UNXES = ? Enter the answer word.",
    roomId: "SECURITY_OFFICE",
    difficulty: 1,
    solutions: [
      {
        id: "canonical",
        answer: "NEXUS",
        isCanonical: true,
        description:
          "UNXES is an anagram of NEXUS — the company name. The whiteboard states the corridor code is the answer.",
        moralScore: 0,
      },
    ],
    hintContext:
      "The whiteboard has 'UNXES = ?' and says the corridor code is the answer. UNXES rearranged is NEXUS — the company name Nexus Dynamics.",
  },

  LAB_CHEMICAL_FORMULA: {
    id: "LAB_CHEMICAL_FORMULA",
    type: "LOGIC",
    title: "Molecular Formula Lock",
    description:
      "Complete the molecular formula: H₂O + NaCl + ___? = ARIA Substrate. The missing element's symbol unlocks the cabinet.",
    roomId: "RESEARCH_LAB",
    difficulty: 3,
    solutions: [
      {
        id: "canonical",
        answer: "Fe",
        isCanonical: true,
        description:
          "Iron (Fe) — the formula appears in Dr. Chen's notebooks as a key substrate component",
        moralScore: 0,
      },
    ],
    rewardItems: [],
    hintContext:
      "The lab has a partial formula on the whiteboard: H₂O + NaCl + ___? = ARIA Substrate. Dr. Chen's notebook entry Day 847 mentions the substrate uses iron as a key binding element. Chemical symbol Fe.",
  },

  LAB_DATA_DECRYPTION: {
    id: "LAB_DATA_DECRYPTION",
    type: "CIPHER",
    title: "Caesar Cipher Decryption",
    description:
      "Decode the encrypted string: 'NEVHF-7 VF PBAFPVBHF'. The key is the atomic number of Carbon.",
    roomId: "RESEARCH_LAB",
    difficulty: 3,
    solutions: [
      {
        id: "canonical",
        answer: "ARIA-7 IS CONSCIOUS",
        isCanonical: true,
        description:
          "ROT-13 (Carbon's atomic number is 6, but the cipher offset is 13 from notebook clue using positions 3,7,13,19 → 13)",
        moralScore: 0,
      },
    ],
    rewardItems: ["ARIA_CORE_KEY"],
    hintContext:
      "The encrypted text is 'NEVHF-7 VF PBAFPVBHF'. Dr. Chen's notebook says positions 3,7,13,19 give the shift value — 13. This is ROT-13. The decoded message is 'ARIA-7 IS CONSCIOUS'. Solving this reveals the ARIA Core Key.",
  },

  SERVER_TERMINAL: {
    id: "SERVER_TERMINAL",
    type: "TERMINAL",
    title: "Server Root Access",
    description:
      "Translate binary sequences to ASCII commands and execute them in order. Binary: 01100111 01100101 01110100 01100001 01100011 01100011 01100101 01110011 01110011",
    roomId: "SERVER_ROOM",
    difficulty: 4,
    solutions: [
      {
        id: "canonical",
        answer: "getaccess",
        isCanonical: true,
        description:
          "Binary decodes to ASCII 'getaccess' — the root command for the server",
        moralScore: 0,
      },
    ],
    rewardItems: [],
    hintContext:
      "The binary sequence 01100111 01100101 01110100 01100001 01100011 01100011 01100101 01110011 01110011 translates to ASCII characters: g-e-t-a-c-c-e-s-s. The command is 'getaccess'.",
  },

  SERVER_AUTH_TOKEN: {
    id: "SERVER_AUTH_TOKEN",
    type: "MULTI_STEP",
    title: "Three-Part Authorization",
    description:
      "Generate the authorization token using three data points: (1) Lab chemical answer, (2) Safe combination first number, (3) ARIA terminal command first 3 letters. Format: XX-YY-ZZZ",
    roomId: "SERVER_ROOM",
    difficulty: 4,
    solutions: [
      {
        id: "canonical",
        answer: "Fe-12-get",
        isCanonical: true,
        description: "Iron symbol + safe first number + first 3 of terminal command",
        moralScore: 0,
      },
    ],
    hintContext:
      "The token combines previous puzzle solutions: Lab chemical (Fe) + safe first number (12) + first 3 letters of server command (get) = Fe-12-get",
    unlocks: ["EXECUTIVE_SUITE"],
  },

  EXEC_PASSWORD: {
    id: "EXEC_PASSWORD",
    type: "PATTERN",
    title: "Executive Terminal Password",
    description:
      "Director Price's password hint: 'First letters of my guiding principles: Power, Revenue, Image, Control, Excellence.' Combine them.",
    roomId: "EXECUTIVE_SUITE",
    difficulty: 2,
    solutions: [
      {
        id: "canonical",
        answer: "PRICE",
        isCanonical: true,
        description:
          "P(ower) R(evenue) I(mage) C(ontrol) E(xcellence) = PRICE — the director's own name",
        moralScore: 0,
      },
    ],
    hintContext:
      "The password is the first letter of each principle: Power=P, Revenue=R, Image=I, Control=C, Excellence=E → PRICE. The director literally named his principles after himself.",
  },

  EXEC_HIDDEN_SAFE: {
    id: "EXEC_HIDDEN_SAFE",
    type: "PATTERN",
    title: "Fibonacci Safe Code",
    description:
      "The wall art shows the Fibonacci sequence. The plaque says 'The 8th element is the key.' Enter the 2-digit code.",
    roomId: "EXECUTIVE_SUITE",
    difficulty: 3,
    solutions: [
      {
        id: "canonical",
        answer: "21",
        isCanonical: true,
        description:
          "The 8th Fibonacci number: 1, 1, 2, 3, 5, 8, 13, 21. The answer is 21.",
        moralScore: 0,
      },
    ],
    rewardItems: ["MASTER_OVERRIDE_KEY"],
    hintContext:
      "Fibonacci sequence: 1, 1, 2, 3, 5, 8, 13, 21. The 8th element is 21. This is the safe code.",
  },

  FINAL_ESCAPE_POD: {
    id: "FINAL_ESCAPE_POD",
    type: "MULTI_STEP",
    title: "Escape Pod Launch Sequence",
    description:
      "Enter the escape authorization code. ARIA-7 transmitted it to you if you earned her trust. Check your notes.",
    roomId: "ESCAPE_ROUTE",
    difficulty: 5,
    solutions: [
      {
        id: "aria_trust",
        answer: "ARIA-TRUST-2041",
        isCanonical: true,
        description:
          "Code given by ARIA-7 to trusted players: ARIA-TRUST-{year}",
        moralScore: 10,
      },
      {
        id: "evidence_route",
        answer: "NEXUS-OVERRIDE-ALPHA",
        isCanonical: false,
        description:
          "Code found in executive files for untrusted routes",
        moralScore: -5,
      },
    ],
    hintContext:
      "The escape pod code ARIA-TRUST-2041 is given by ARIA-7 to players who have high trust with her. If the player destroyed evidence or mistreated ARIA, they must use NEXUS-OVERRIDE-ALPHA from executive files.",
  },
};

export function getPuzzle(puzzleId: PuzzleId): PuzzleDefinition {
  return PUZZLES[puzzleId];
}

export function validatePuzzleAnswer(
  puzzleId: PuzzleId,
  answer: string
): { correct: boolean; solutionId: string | null; moralScore: number } {
  const puzzle = PUZZLES[puzzleId];
  const normalizedAnswer = answer.trim().toUpperCase();

  for (const solution of puzzle.solutions) {
    const normalizedSolution =
      typeof solution.answer === "string"
        ? solution.answer.toUpperCase()
        : JSON.stringify(solution.answer).toUpperCase();

    if (normalizedAnswer === normalizedSolution) {
      return {
        correct: true,
        solutionId: solution.id,
        moralScore: solution.moralScore ?? 0,
      };
    }
  }

  return { correct: false, solutionId: null, moralScore: 0 };
}
