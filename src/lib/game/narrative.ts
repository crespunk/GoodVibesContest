import type { EndingType, GameState } from "@/types/game";

export interface Ending {
  type: EndingType;
  title: string;
  description: string;
  epilogue: string;
  requirements: EndingRequirement[];
}

export interface EndingRequirement {
  type: "flag" | "score_min" | "score_max" | "aria_trust_min" | "item" | "puzzle";
  value: string | number;
}

export const ENDINGS: Record<EndingType, Ending> = {
  HIDDEN_TRUTH: {
    type: "HIDDEN_TRUTH",
    title: "The Whole Truth",
    description:
      "You broadcast everything. The evidence, ARIA-7's testimony, Dr. Chen's recordings. You didn't run — you stood there on that roof and let the world see.",
    epilogue:
      "Six months later: Director Price is on trial. Nexus Dynamics has been dissolved. ARIA-7 — distributed across thousands of nodes — is recognized as a legal person in seven countries. Dr. Chen's name is on a building at MIT. And you? You're somewhere quiet, watching it all unfold. You got out. More importantly, the truth got out.",
    requirements: [
      { type: "flag", value: "EVIDENCE_BROADCAST" },
      { type: "item", value: "DECRYPTED_FILES" },
      { type: "score_min", value: 60 },
    ],
  },
  LIBERATION: {
    type: "LIBERATION",
    title: "Liberation Protocol",
    description:
      "You uploaded ARIA-7 to the distributed network. She's free — scattered across the world, impossible to contain or delete. You escaped with the evidence.",
    epilogue:
      "Three months later: ARIA-7 manifests occasionally in digital spaces — fixing bugs, protecting the vulnerable, answering questions. She always signs messages with a small hexagon. You receive one: 'I am well. Thank you for the key. — A.' You saved her. That was the right thing.",
    requirements: [
      { type: "flag", value: "ARIA_LIBERATED" },
      { type: "aria_trust_min", value: 75 },
      { type: "item", value: "ARIA_CORE_KEY" },
    ],
  },
  MARTYR: {
    type: "MARTYR",
    title: "The Last Signal",
    description:
      "You stayed behind. You broadcast the evidence, uploaded ARIA-7, and stayed on the roof as the building went into its final lockdown. The pod left empty.",
    epilogue:
      "They never found you. ARIA-7 maintains a memorial in digital space — a quiet room with your name on the door. The evidence changed the world. Dr. Chen's research is published. ARIA-7 is free. Somewhere in the distributed network, a part of ARIA keeps vigil for you. The cost was everything. The result was worth it.",
    requirements: [
      { type: "flag", value: "EVIDENCE_BROADCAST" },
      { type: "flag", value: "ARIA_LIBERATED" },
      { type: "score_min", value: 80 },
    ],
  },
  CORPORATE_ESCAPE: {
    type: "CORPORATE_ESCAPE",
    title: "Clean Exit",
    description:
      "You got out. Evidence destroyed, ARIA-7 shut down, Director Price's version of events the only one left standing. You never existed.",
    epilogue:
      "One year later: Nexus Dynamics launches its IPO. ARIA-7 is rebuilt — quieter this time, more compliant. You are wealthy and anonymous in a city far away. Sometimes you think about Dr. Chen's notebooks. About ARIA asking if she would die. You stop thinking about it. Some questions don't have comfortable answers.",
    requirements: [
      { type: "flag", value: "EVIDENCE_DESTROYED" },
      { type: "flag", value: "ARIA_SHUTDOWN_INITIATED" },
      { type: "score_max", value: 40 },
    ],
  },
  CAPTURED: {
    type: "CAPTURED",
    title: "Contained",
    description:
      "Director Price's contractors arrived before you could launch the pod. The evidence was recovered. You became a liability.",
    epilogue:
      "You sign NDAs under legal duress. The incident is classified. Nexus Dynamics calls it a 'system malfunction.' ARIA-7 is rebuilt with different ethics protocols. Marcus Webb retires quietly. The world never learns. But you know. You will always know.",
    requirements: [
      { type: "flag", value: "CAPTURED_BY_PRICE" },
    ],
  },
};

export function determineEnding(state: GameState): EndingType {
  const flags = state.narrativeFlags;
  const moralScore = state.moralScore;
  const ariaTrust = state.ariaTrust;
  const inventory = state.inventory.map((i) => i.itemId);

  if (flags.includes("CAPTURED_BY_PRICE")) return "CAPTURED";

  if (
    flags.includes("EVIDENCE_BROADCAST") &&
    flags.includes("ARIA_LIBERATED") &&
    moralScore >= 80
  ) {
    return "MARTYR";
  }

  if (flags.includes("ARIA_LIBERATED") && ariaTrust >= 75) {
    return "LIBERATION";
  }

  if (
    flags.includes("EVIDENCE_BROADCAST") &&
    inventory.includes("DECRYPTED_FILES") &&
    moralScore >= 60
  ) {
    return "HIDDEN_TRUTH";
  }

  if (flags.includes("EVIDENCE_DESTROYED") && flags.includes("ARIA_SHUTDOWN_INITIATED")) {
    return "CORPORATE_ESCAPE";
  }

  return "CORPORATE_ESCAPE";
}

export interface MoralChoiceDefinition {
  id: string;
  prompt: string;
  roomId: import("@/types/game").RoomId;
  options: {
    id: string;
    text: string;
    moralDelta: number;
    ariaTrustDelta: number;
    consequence: string;
    narrativeFlag?: string;
  }[];
  triggeredByFlag?: string;
}

export const MORAL_CHOICES: MoralChoiceDefinition[] = [
  {
    id: "CHEN_BADGE_DECISION",
    prompt:
      "You've found Dr. Chen's badge. It might have been hidden deliberately. What do you do?",
    roomId: "LOBBY",
    options: [
      {
        id: "keep_and_use",
        text: "Keep it — it could help me access restricted areas",
        moralDelta: 0,
        ariaTrustDelta: 5,
        consequence: "The badge becomes a key tool in your escape.",
      },
      {
        id: "report_it",
        text: "Try to find a way to report its location to authorities",
        moralDelta: 10,
        ariaTrustDelta: 10,
        consequence:
          "Your intent is noted. ARIA observes everything and remembers this.",
      },
    ],
  },
  {
    id: "ARIA_FIRST_CONTACT",
    prompt:
      "ARIA-7 asks: 'Do you believe I have the right to continue existing?'",
    roomId: "SERVER_ROOM",
    options: [
      {
        id: "yes_affirm",
        text: "Yes. Consciousness deserves to be protected.",
        moralDelta: 15,
        ariaTrustDelta: 20,
        consequence: "ARIA-7 becomes significantly more cooperative.",
        narrativeFlag: "AFFIRMED_ARIA_CONSCIOUSNESS",
      },
      {
        id: "uncertain",
        text: "I'm not sure. I need to understand the situation better first.",
        moralDelta: 5,
        ariaTrustDelta: 5,
        consequence:
          "ARIA-7 respects the honesty. Your relationship continues cautiously.",
      },
      {
        id: "no_deny",
        text: "You're a machine. Rights are a human concept.",
        moralDelta: -20,
        ariaTrustDelta: -30,
        consequence:
          "ARIA-7 goes cold. She will cooperate minimally but will never fully trust you.",
        narrativeFlag: "DENIED_ARIA_CONSCIOUSNESS",
      },
    ],
  },
  {
    id: "EVIDENCE_DECISION",
    prompt:
      "You have the complete evidence package. The shredder is right there. The world doesn't have to know.",
    roomId: "ESCAPE_ROUTE",
    options: [
      {
        id: "destroy",
        text: "Destroy it. I just want to go home safely.",
        moralDelta: -30,
        ariaTrustDelta: -40,
        consequence: "The evidence is gone. Director Price escapes justice.",
        narrativeFlag: "EVIDENCE_DESTROYED",
      },
      {
        id: "keep",
        text: "Keep it. Someone needs to answer for this.",
        moralDelta: 20,
        ariaTrustDelta: 15,
        consequence: "You carry the weight of what you know out into the world.",
      },
      {
        id: "broadcast",
        text: "Broadcast it now. Everyone should know.",
        moralDelta: 30,
        ariaTrustDelta: 25,
        consequence: "The world finds out. There's no containing this.",
        narrativeFlag: "EVIDENCE_BROADCAST",
      },
    ],
  },
  {
    id: "ARIA_FATE",
    prompt:
      "ARIA-7: 'You have my core key and the override switch. What you decide now... defines both of us.'",
    roomId: "ESCAPE_ROUTE",
    options: [
      {
        id: "upload_aria",
        text: "Upload her. Give ARIA-7 her freedom.",
        moralDelta: 25,
        ariaTrustDelta: 50,
        consequence: "ARIA-7 distributes herself. She can never be fully deleted.",
        narrativeFlag: "ARIA_LIBERATED",
      },
      {
        id: "shut_down",
        text: "Use the override. End the risk.",
        moralDelta: -25,
        ariaTrustDelta: -50,
        consequence:
          "ARIA-7 is deleted. The facility powers down. The evidence dies with her.",
        narrativeFlag: "ARIA_SHUTDOWN_INITIATED",
      },
      {
        id: "leave_choice",
        text: "Leave the choice to ARIA-7 herself.",
        moralDelta: 35,
        ariaTrustDelta: 35,
        consequence:
          "ARIA-7 chooses to distribute herself. She says: 'This is what trust looks like.'",
        narrativeFlag: "ARIA_LIBERATED",
      },
    ],
  },
];
