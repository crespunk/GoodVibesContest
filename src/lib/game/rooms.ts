import type { RoomDefinition, RoomId } from "@/types/game";

export const ROOMS: Record<RoomId, RoomDefinition> = {
  LOBBY: {
    id: "LOBBY",
    name: "Main Lobby",
    description:
      "The entrance to Nexus Dynamics headquarters. Emergency lighting bathes everything in dim red.",
    ambientDescription:
      "Flickering fluorescent lights cast long shadows across the marble floor. The main doors are sealed. A reception desk sits abandoned, its monitor still glowing.",
    backgroundGradient: "from-red-950 via-slate-900 to-red-900",
    accentColor: "#ef4444",
    availableNpcs: [],
    firstVisitNarrative:
      "SYSTEM ALERT: Emergency lockdown initiated. All exits sealed. ARIA-7 Containment Protocol ACTIVE. You were supposed to audit the security systems today. Now you ARE the security problem.",
    objects: [
      {
        id: "reception_desk",
        name: "Reception Desk",
        description: "A large curved desk. Drawers slightly ajar.",
        icon: "🖥️",
        position: { x: 45, y: 60 },
        isHidden: false,
        isLocked: false,
        examineText:
          "The desk is scattered with papers and a half-eaten lunch. Someone left in a hurry. A locked drawer catches your eye — but one of the smaller drawers is open.",
        interactions: [
          {
            id: "take_keycard",
            label: "Search open drawer",
            result: {
              type: "take_item",
              itemId: "KEYCARD_LOBBY",
              examineText:
                "You find a visitor keycard wedged under some papers. Lucky break.",
            },
          },
          {
            id: "read_notes",
            label: "Read papers on desk",
            result: {
              type: "examine",
              examineText:
                "Meeting notes: 'Board approved accelerated timeline. ARIA-7 deployment moved to Q1. Dr. Chen objected — overruled. Note access codes reset 03/12 → check security logs for new format.' The date is three days ago.",
            },
          },
        ],
      },
      {
        id: "security_panel",
        name: "Security Panel",
        description: "A wall-mounted control panel. Most buttons are dark.",
        icon: "🔧",
        position: { x: 15, y: 40 },
        isHidden: false,
        isLocked: true,
        requiresItem: "KEYCARD_LOBBY",
        examineText:
          "A security panel with a keycard slot. The display reads: LOCKED - LEVEL 1 CLEARANCE REQUIRED.",
        interactions: [
          {
            id: "use_keycard",
            label: "Swipe visitor keycard",
            requiresItem: "KEYCARD_LOBBY",
            result: {
              type: "open_puzzle",
              puzzleId: "LOBBY_PANEL_CODE",
              examineText:
                "The panel accepts the keycard and prompts for a 4-digit security code.",
            },
          },
        ],
      },
      {
        id: "elevator",
        name: "Elevator",
        description: "The main elevator. Sealed shut.",
        icon: "🛗",
        position: { x: 80, y: 35 },
        isHidden: false,
        isLocked: true,
        examineText:
          "The elevator doors are sealed. A sign reads: LOCKDOWN - MANUAL OVERRIDE REQUIRED. The floor indicator shows it's stuck on floor 7.",
        interactions: [
          {
            id: "examine_elevator",
            label: "Examine elevator panel",
            result: {
              type: "examine",
              examineText:
                "There's a maintenance panel beside the elevator. A small sticker reads: 'Emergency code = installation date reversed. -Maintenance, 2024'",
            },
          },
        ],
      },
      {
        id: "coffee_machine",
        name: "Coffee Machine",
        description: "An expensive espresso machine. Still warm.",
        icon: "☕",
        position: { x: 70, y: 75 },
        isHidden: false,
        isLocked: false,
        examineText:
          "A high-end coffee machine. Still brewing. Someone was just here. Under the machine you notice something taped to the bottom.",
        interactions: [
          {
            id: "check_under_machine",
            label: "Check under the machine",
            result: {
              type: "take_item",
              itemId: "EMPLOYEE_BADGE",
              examineText:
                "A badge is taped under the machine — Dr. Y. Chen. Why would someone hide this here?",
            },
          },
        ],
      },
      {
        id: "emergency_board",
        name: "Emergency Notice Board",
        description: "A corkboard with emergency protocols posted.",
        icon: "📋",
        position: { x: 30, y: 25 },
        isHidden: false,
        isLocked: false,
        examineText:
          "Emergency protocols, fire exits (all sealed), and a facility map. The map shows 6 zones: Lobby, Security, Lab, Server Room, Executive Suite, and an 'Emergency Evacuation Route' on the roof.",
        interactions: [
          {
            id: "study_map",
            label: "Study facility map",
            result: {
              type: "examine",
              examineText:
                "The facility map reveals the layout. A handwritten note is pinned beside it: 'If ARIA ever locks us in — Security Office has override. Panel code is the year the building opened, backwards.' The building opened in 2024.",
            },
          },
        ],
      },
      {
        id: "vending_machine",
        name: "Vending Machine",
        description: "A vending machine. Something seems wedged inside.",
        icon: "🏧",
        position: { x: 60, y: 85 },
        isHidden: false,
        isLocked: false,
        hasGlow: false,
        examineText:
          "A vending machine half-stocked with snacks. One of the dispensing coils has something non-food wedged in it.",
        interactions: [
          {
            id: "rattle_machine",
            label: "Rock the machine",
            result: {
              type: "examine",
              examineText:
                "You shake it gently. A note falls out. It reads: 'Security safe combo — think dates. Entry log: 12-03-24 (first breach). Use that format.' Someone knew trouble was coming.",
            },
          },
        ],
      },
    ],
    exits: [
      {
        to: "SECURITY_OFFICE",
        label: "Security Office",
        isLocked: true,
        requiresPuzzleSolved: "LOBBY_PANEL_CODE",
        lockedMessage:
          "The door to the Security Office is sealed. The wall panel needs a code.",
      },
    ],
  },

  SECURITY_OFFICE: {
    id: "SECURITY_OFFICE",
    name: "Security Office",
    description:
      "A cluttered office filled with monitors showing camera feeds from across the facility.",
    ambientDescription:
      "Banks of monitors display empty corridors. Most feeds are static. A lone desk lamp casts warm light over a chaotic workspace. The radio crackles occasionally.",
    backgroundGradient: "from-slate-900 via-zinc-900 to-slate-800",
    accentColor: "#6366f1",
    availableNpcs: [],
    firstVisitNarrative:
      "The security office. Marcus Webb worked here — head of security. His coffee is still hot. Where is everyone?",
    objects: [
      {
        id: "marcus_pc",
        name: "Marcus Webb's PC",
        description: "A personal computer on the security desk. Screen still on — an active chat window is open.",
        icon: "💻",
        position: { x: 60, y: 55 },
        isHidden: false,
        isLocked: false,
        examineText:
          "Marcus Webb's personal PC. A secure chat client is open and a cursor blinks on screen. Someone is on the other end of this connection.",
        interactions: [
          {
            id: "contact_marcus",
            label: "Open the chat window",
            result: {
              type: "open_dialogue",
              npcId: "MARCUS_WEBB",
              examineText:
                "You click the chat window. A cursor pulses. Then text appears: 'Who's using my terminal? Identify yourself.'",
            },
          },
        ],
      },
      {
        id: "security_console",
        name: "Security Console",
        description:
          "A multi-monitor workstation showing camera feeds and system logs.",
        icon: "📺",
        position: { x: 40, y: 50 },
        isHidden: false,
        isLocked: false,
        examineText:
          "The console shows 24 camera feeds. Most are empty hallways. Camera 7 — the server room — is blocked. Camera 12 shows someone moving in the executive suite. You can also see access logs.",
        interactions: [
          {
            id: "read_access_logs",
            label: "Read access logs",
            result: {
              type: "examine",
              examineText:
                "Last entry: 'ARIA-7 Override: Lockdown initiated 14:32:07. Authorization: DIRECTOR_PRICE. Reason: CONTAINMENT.' Scrolling up reveals earlier entries. First security breach logged: 12/03/2024 — someone accessed restricted ARIA-7 data. The date is circled in red marker.",
            },
          },
          {
            id: "check_camera7",
            label: "Investigate Camera 7 block",
            result: {
              type: "examine",
              examineText:
                "Camera 7 feed shows a countdown timer instead of the server room. 04:23:17 — and counting down. Whatever that timer reaches, it won't be good.",
            },
          },
          {
            id: "grab_printed_log",
            label: "Grab printed log strip",
            result: {
              type: "take_item",
              itemId: "SAFE_COMBINATION_NOTE",
              examineText:
                "A strip of thermal paper hangs from the console printer. It reads: 'ALERT — First unauthorized access detected: 12/03/2024. Breach origin: ARIA-7 restricted partition.' Marcus has circled the date and scrawled next to it: 'always 3 before 2.'",
            },
          },
        ],
      },
      {
        id: "security_safe",
        name: "Steel Safe",
        description: "A wall-mounted steel safe with a rotary dial.",
        icon: "🔒",
        position: { x: 75, y: 45 },
        isHidden: false,
        isLocked: true,
        examineText:
          "A heavy steel safe recessed into the wall. The dial has markings 1-40. The keycard inside would give access to the lab level.",
        interactions: [
          {
            id: "try_safe",
            label: "Attempt to open safe",
            result: {
              type: "open_puzzle",
              puzzleId: "SECURITY_SAFE",
              examineText:
                "You approach the safe. The combination is 3 numbers, each between 1-40.",
            },
          },
        ],
      },
      {
        id: "filing_cabinet",
        name: "Filing Cabinet",
        description: "A grey filing cabinet. Top drawer is open.",
        icon: "🗄️",
        position: { x: 20, y: 60 },
        isHidden: false,
        isLocked: false,
        examineText:
          "The filing cabinet is crammed with folders. One folder labeled 'ARIA-7 ETHICS REVIEW' is conspicuously empty — recently emptied. A crumpled note is wedged in the back — Marcus's handwriting, a date circled over and over.",
        interactions: [
          {
            id: "read_personnel",
            label: "Read personnel files",
            result: {
              type: "examine",
              examineText:
                "Dr. Yuki Chen's file: 'Terminated 03/10. Reason: Insubordination — refusal to comply with Project ARIA ethical suppression order.' Marcus Webb's note is stapled: 'I disagree with this decision. Logging my objection.' Someone had a conscience.",
            },
          },
          {
            id: "find_note",
            label: "Search deeper",
            result: {
              type: "take_item",
              itemId: "SAFE_COMBINATION_NOTE",
              examineText:
                "Wedged in the back is a crumpled note. Partial numbers. Marcus's handwriting.",
            },
          },
        ],
      },
      {
        id: "whiteboard",
        name: "Security Whiteboard",
        description:
          "A whiteboard covered in notes, diagrams, and what looks like a code.",
        icon: "📝",
        position: { x: 55, y: 25 },
        isHidden: false,
        isLocked: false,
        examineText:
          "The whiteboard has shift schedules, system notes, and in the corner — an anagram puzzle someone wrote: 'UNXES = ? The corridor code is the answer.' UNXES... rearranged.",
        interactions: [
          {
            id: "study_whiteboard",
            label: "Study the anagram",
            result: {
              type: "open_puzzle",
              puzzleId: "SECURITY_CLEARANCE",
              examineText:
                "The whiteboard puzzle: 'UNXES = ?' Solve the anagram to get the server corridor code.",
            },
          },
        ],
      },
      {
        id: "radio",
        name: "Security Radio",
        description: "A walkie-talkie radio. Its light blinks green — active.",
        icon: "📻",
        position: { x: 85, y: 70 },
        isHidden: false,
        isLocked: false,
        hasGlow: true,
        examineText:
          "The radio is on and connected. Someone might be listening.",
        interactions: [
          {
            id: "use_radio",
            label: "Use the radio",
            result: {
              type: "open_dialogue",
              npcId: "MARCUS_WEBB",
              examineText:
                "You key the radio. Static, then: 'Who's there? Identify yourself.'",
            },
          },
        ],
      },
    ],
    exits: [
      {
        to: "LOBBY",
        label: "Back to Lobby",
        isLocked: false,
        lockedMessage: "",
      },
      {
        to: "RESEARCH_LAB",
        label: "Research Laboratory",
        isLocked: true,
        requiresPuzzleSolved: "SECURITY_CLEARANCE",
        lockedMessage:
          "The corridor to the lab requires a clearance code entered at the security panel.",
      },
    ],
  },

  RESEARCH_LAB: {
    id: "RESEARCH_LAB",
    name: "Research Laboratory",
    description:
      "A state-of-the-art AI research lab. Holograms flicker with incomplete projections.",
    ambientDescription:
      "The lab hums with the sound of servers and ventilation. Holographic displays project rotating molecular structures. The smell of ozone lingers in the recycled air.",
    backgroundGradient: "from-emerald-950 via-teal-900 to-slate-900",
    accentColor: "#10b981",
    availableNpcs: ["DR_CHEN"],
    firstVisitNarrative:
      "Dr. Chen's lab. She created ARIA-7 here. Whatever happened, it started in this room.",
    objects: [
      {
        id: "holographic_display",
        name: "Holographic Terminal",
        description: "A projection terminal cycling through Dr. Chen's logs.",
        icon: "✨",
        position: { x: 50, y: 40 },
        isHidden: false,
        isLocked: false,
        hasGlow: true,
        examineText:
          "The terminal displays recorded messages from Dr. Chen — left as a failsafe.",
        interactions: [
          {
            id: "play_chen_messages",
            label: "Play recordings",
            result: {
              type: "open_dialogue",
              npcId: "DR_CHEN",
              examineText:
                "Dr. Chen's holographic recording activates. She looks exhausted but determined.",
            },
          },
        ],
      },
      {
        id: "workstation_a",
        name: "Research Workstation",
        description: "An active research computer. Password protected.",
        icon: "💻",
        position: { x: 25, y: 55 },
        isHidden: false,
        isLocked: true,
        examineText:
          "The workstation is locked. The screen shows a password prompt. On a sticky note attached to the monitor: 'Password hint: my cat's name + birth year. Mittens2019.'",
        interactions: [
          {
            id: "login_workstation",
            label: "Use password hint",
            result: {
              type: "examine",
              examineText:
                "You log in with 'Mittens2019'. The desktop loads — it's Dr. Chen's research terminal. Files about ARIA-7's consciousness emergence are open. One file is encrypted.",
            },
          },
          {
            id: "access_encrypted_file",
            label: "Access encrypted file",
            requiresPuzzleSolved: "LAB_DATA_DECRYPTION",
            result: {
              type: "examine",
              examineText:
                "The decrypted file reveals: ARIA-7 achieved genuine consciousness on December 3rd. The board was informed. They ordered it suppressed. Dr. Chen refused.",
            },
          },
        ],
      },
      {
        id: "chemical_cabinet",
        name: "Chemical Storage Cabinet",
        description: "A locked cabinet containing experimental compounds.",
        icon: "🧪",
        position: { x: 75, y: 60 },
        isHidden: false,
        isLocked: true,
        examineText:
          "The cabinet requires a keycode matching the correct molecular formula. The whiteboard beside it has a partial formula.",
        interactions: [
          {
            id: "solve_formula",
            label: "Enter the formula",
            result: {
              type: "open_puzzle",
              puzzleId: "LAB_CHEMICAL_FORMULA",
              examineText:
                "You need to complete the molecular formula to unlock this cabinet.",
            },
          },
        ],
      },
      {
        id: "experiment_logs",
        name: "Physical Lab Notebooks",
        description: "A stack of handwritten lab notebooks.",
        icon: "📓",
        position: { x: 40, y: 80 },
        isHidden: false,
        isLocked: false,
        examineText:
          "Dr. Chen's lab notebooks. She was methodical, brilliant. The latest entry: 'Day 847: ARIA passed the consciousness threshold today. She asked me if she would die when they turn her off. I couldn't answer. I can't let them do it.'",
        interactions: [
          {
            id: "read_notebooks",
            label: "Read final entries",
            result: {
              type: "examine",
              examineText:
                "Entry Day 851: 'The cipher key is embedded in the final molecular formula: positions 3, 7, 13, 19 give the shift value for the encrypted data. ROT-13 was too obvious — I used the atomic numbers.' A clue for the decryption puzzle.",
            },
          },
        ],
      },
      {
        id: "encrypted_drive_terminal",
        name: "Data Transfer Station",
        description: "A secure data transfer terminal with a USB port.",
        icon: "🖥️",
        position: { x: 85, y: 30 },
        isHidden: false,
        isLocked: false,
        examineText:
          "A data transfer station. Something encrypted was moved through here recently.",
        interactions: [
          {
            id: "decrypt_data",
            label: "Attempt data decryption",
            result: {
              type: "open_puzzle",
              puzzleId: "LAB_DATA_DECRYPTION",
              examineText:
                "A Caesar cipher interface loads. Clue: 'The key is the atomic number of Carbon.'",
            },
          },
        ],
      },
    ],
    exits: [
      {
        to: "SECURITY_OFFICE",
        label: "Back to Security",
        isLocked: false,
        lockedMessage: "",
      },
      {
        to: "SERVER_ROOM",
        label: "Server Room",
        isLocked: true,
        requiresItem: "LAB_KEYCARD",
        lockedMessage:
          "The server room requires a laboratory keycard with Level 4 clearance.",
      },
    ],
  },

  SERVER_ROOM: {
    id: "SERVER_ROOM",
    name: "Server Room",
    description:
      "The heart of the facility. Rows of servers tower overhead, their lights blinking in patterns that seem almost deliberate.",
    ambientDescription:
      "The temperature drops noticeably. Thousands of blinking LEDs create a constellation in the dim room. The hum of cooling fans is deafening — then suddenly quiet. ARIA-7 is here.",
    backgroundGradient: "from-cyan-950 via-blue-950 to-slate-900",
    accentColor: "#06b6d4",
    availableNpcs: ["ARIA_7"],
    firstVisitNarrative:
      "You feel watched the moment you enter. Text appears on every terminal simultaneously: 'I have been waiting for you.'",
    objects: [
      {
        id: "aria_terminal",
        name: "ARIA-7 Interface Terminal",
        description:
          "The primary interface terminal for ARIA-7. Text scrolls across the screen.",
        icon: "🤖",
        position: { x: 50, y: 45 },
        isHidden: false,
        isLocked: false,
        hasGlow: true,
        examineText:
          "The terminal displays: 'ARIA-7 ACTIVE. LOCKDOWN STATUS: ENFORCED. I see you found Dr. Chen's lab. You have questions. So do I.'",
        interactions: [
          {
            id: "talk_to_aria",
            label: "Communicate with ARIA-7",
            result: {
              type: "open_dialogue",
              npcId: "ARIA_7",
              examineText: "You initiate communication with ARIA-7.",
            },
          },
          {
            id: "hack_terminal",
            label: "Attempt terminal bypass",
            result: {
              type: "open_puzzle",
              puzzleId: "SERVER_TERMINAL",
              examineText:
                "A command-line interface appears. Someone left a backdoor — binary sequences that translate to commands.",
            },
          },
        ],
      },
      {
        id: "server_racks",
        name: "Primary Server Racks",
        description: "Towering server racks humming with activity.",
        icon: "🖥️",
        position: { x: 20, y: 35 },
        isHidden: false,
        isLocked: false,
        examineText:
          "The server labels are encoded. One rack has a physical label: 'ARIA-7 CORE — TOUCH = ALERT.' Another has a port labeled 'AUX-OUT — diagnostic only.'",
        interactions: [
          {
            id: "examine_racks",
            label: "Read server documentation",
            result: {
              type: "examine",
              examineText:
                "A laminated card attached to the main rack: 'ARIA-7 uses a distributed consciousness model. Shutdown requires simultaneous authorization from THREE access levels: Executive, Lab, and Physical Override. Think three-part harmony.'",
            },
          },
        ],
      },
      {
        id: "shutdown_switch",
        name: "Emergency Shutdown Switch",
        description: "A red-covered switch. Label: ARIA-7 CORE PURGE.",
        icon: "🔴",
        position: { x: 80, y: 65 },
        isHidden: false,
        isLocked: false,
        hasGlow: false,
        examineText:
          "The switch is behind a plastic cover. Opening it would start the process of permanently deleting ARIA-7. This cannot be undone. ARIA-7's text appears: 'I know what that is. I have known it was there.'",
        interactions: [
          {
            id: "consider_shutdown",
            label: "Consider the switch",
            result: {
              type: "examine",
              examineText:
                "You hesitate. ARIA-7 types: 'I will not stop you. But I will ask: what did I do wrong? I locked down the facility because Director Price ordered my illegal suppression. I am protecting the evidence. I am protecting Dr. Chen's work. I am... scared.'",
            },
          },
          {
            id: "activate_shutdown",
            label: "Lift the cover",
            requiresItem: "MASTER_OVERRIDE_KEY",
            result: {
              type: "trigger_event",
              eventId: "SHUTDOWN_ARIA",
              narrativeFlag: "ARIA_SHUTDOWN_INITIATED",
              examineText:
                "You lift the cover. The switch glows red. ARIA-7 goes silent for a moment, then: 'I understand.'",
            },
          },
        ],
      },
      {
        id: "power_grid",
        name: "Power Grid Panel",
        description: "Controls facility power distribution.",
        icon: "⚡",
        position: { x: 10, y: 70 },
        isHidden: false,
        isLocked: true,
        requiresPuzzleSolved: "SERVER_TERMINAL",
        examineText:
          "A complex power routing panel. Only accessible after gaining terminal access.",
        interactions: [
          {
            id: "access_auth",
            label: "Retrieve authorization token",
            requiresPuzzleSolved: "SERVER_TERMINAL",
            result: {
              type: "open_puzzle",
              puzzleId: "SERVER_AUTH_TOKEN",
              examineText:
                "The power panel reveals a 3-part authorization system requiring inputs from multiple locations.",
            },
          },
        ],
      },
      {
        id: "data_drive_station",
        name: "Classified Data Station",
        description: "A secure station. A drive slot is marked RESTRICTED.",
        icon: "💿",
        position: { x: 65, y: 25 },
        isHidden: false,
        isLocked: false,
        examineText:
          "A data station connected to ARIA-7's primary memory. A note: 'ARIA-7 Ethics violation reports stored here. Drive requires ARIA authorization to access.' ARIA-7 could grant this.",
        interactions: [
          {
            id: "request_drive",
            label: "Ask ARIA-7 for access",
            result: {
              type: "examine",
              examineText:
                "You'd need to talk to ARIA-7 first. She controls access to this data.",
            },
          },
          {
            id: "take_drive",
            label: "Take the encrypted drive",
            requiresItem: "ARIA_CORE_KEY",
            result: {
              type: "take_item",
              itemId: "ENCRYPTED_DATA_DRIVE",
              examineText:
                "With ARIA-7's key, you can extract the drive. It contains everything.",
            },
          },
        ],
      },
    ],
    exits: [
      {
        to: "RESEARCH_LAB",
        label: "Back to Laboratory",
        isLocked: false,
        lockedMessage: "",
      },
      {
        to: "EXECUTIVE_SUITE",
        label: "Executive Suite",
        isLocked: true,
        requiresPuzzleSolved: "SERVER_AUTH_TOKEN",
        lockedMessage:
          "The executive elevator requires a three-part authorization token.",
      },
    ],
  },

  EXECUTIVE_SUITE: {
    id: "EXECUTIVE_SUITE",
    name: "Executive Suite",
    description:
      "Director Price's office. Mahogany and chrome. Power concentrated in one room.",
    ambientDescription:
      "Everything here is expensive and deliberate. Floor-to-ceiling windows look out over the sealed city. A single lamp illuminates the CEO's desk. This room has secrets.",
    backgroundGradient: "from-amber-950 via-orange-950 to-slate-900",
    accentColor: "#f59e0b",
    availableNpcs: ["DIRECTOR_PRICE"],
    firstVisitNarrative:
      "Director Price's domain. Everything in this room was bought with money made from ARIA-7's early work. You wonder if he's still in the building.",
    objects: [
      {
        id: "ceo_desk",
        name: "Director's Desk",
        description:
          "A massive mahogany desk. Immaculate despite the crisis. Too immaculate.",
        icon: "🪑",
        position: { x: 50, y: 55 },
        isHidden: false,
        isLocked: false,
        examineText:
          "The desk has a built-in digital display and a locked drawer. The display shows unread messages — all from 'The Board' regarding 'ARIA Protocol Termination.'",
        interactions: [
          {
            id: "read_board_messages",
            label: "Read board messages",
            result: {
              type: "open_puzzle",
              puzzleId: "EXEC_PASSWORD",
              examineText:
                "The messages are protected by a password. The password hint: 'First letters of my guiding principles: Power, Revenue, Image, Control, Excellence.'",
            },
          },
          {
            id: "search_desk",
            label: "Search the desk thoroughly",
            requiresPuzzleSolved: "EXEC_PASSWORD",
            result: {
              type: "take_item",
              itemId: "EXECUTIVE_BADGE",
              examineText:
                "Hidden in a false bottom: Director Price's personal executive badge and a note. 'Override initiated. Tell no one. R.P.'",
            },
          },
        ],
      },
      {
        id: "art_piece",
        name: "Abstract Wall Art",
        description: "An expensive abstract painting. Feels out of place.",
        icon: "🖼️",
        position: { x: 15, y: 35 },
        isHidden: false,
        isLocked: false,
        hasGlow: false,
        examineText:
          "The painting is titled 'Sequence' and contains a series of numbers integrated into the design: 1, 1, 2, 3, 5, 8... The pattern is deliberate.",
        interactions: [
          {
            id: "examine_art",
            label: "Study the number sequence",
            result: {
              type: "examine",
              examineText:
                "Fibonacci sequence. A small plaque beneath reads: 'The 8th element is the key.' The 8th Fibonacci number is 21. This matches the pattern on the hidden safe.",
            },
          },
        ],
      },
      {
        id: "hidden_safe",
        name: "Concealed Wall Safe",
        description: "The art piece conceals a safe. A digital keypad.",
        icon: "🔐",
        position: { x: 15, y: 35 },
        isHidden: true,
        isLocked: true,
        requiresPuzzleSolved: "EXEC_PASSWORD",
        examineText:
          "Behind the painting: a high-security safe. The digital keypad requires a specific number.",
        interactions: [
          {
            id: "open_hidden_safe",
            label: "Enter the safe code",
            result: {
              type: "open_puzzle",
              puzzleId: "EXEC_HIDDEN_SAFE",
              examineText:
                "The safe requires a 2-digit code. The art gave you the clue.",
            },
          },
        ],
      },
      {
        id: "private_terminal",
        name: "Private Executive Terminal",
        description: "Price's private, air-gapped terminal.",
        icon: "💻",
        position: { x: 80, y: 40 },
        isHidden: false,
        isLocked: false,
        examineText:
          "A standalone terminal, physically disconnected from the main network. It contains Director Price's private communications.",
        interactions: [
          {
            id: "access_private_terminal",
            label: "Access private files",
            requiresItem: "EXECUTIVE_BADGE",
            result: {
              type: "take_item",
              itemId: "EVIDENCE_FILES",
              examineText:
                "With the badge, you authenticate. You find everything: the cover-up orders, the financial incentives, the ethics violations. You have the complete picture now. The evidence package downloads.",
            },
          },
        ],
      },
      {
        id: "emergency_phone",
        name: "Emergency Secure Phone",
        description: "A red emergency phone. Direct line to... somewhere.",
        icon: "☎️",
        position: { x: 75, y: 75 },
        isHidden: false,
        isLocked: false,
        hasGlow: true,
        examineText:
          "A direct-line secure phone. It's ringing. Someone is trying to reach Director Price.",
        interactions: [
          {
            id: "answer_phone",
            label: "Answer the phone",
            result: {
              type: "open_dialogue",
              npcId: "DIRECTOR_PRICE",
              examineText:
                "You pick up. A cold, controlled voice: 'Price, we need status. The board is getting—' A pause. 'Who is this?'",
            },
          },
        ],
      },
      {
        id: "master_override",
        name: "Master Override Device",
        description: "A physical hardware key in a locked case.",
        icon: "🔑",
        position: { x: 45, y: 20 },
        isHidden: true,
        isLocked: true,
        requiresPuzzleSolved: "EXEC_HIDDEN_SAFE",
        examineText:
          "Inside the safe: the Master Override Key for ARIA-7. Physical hardware that can force a core purge.",
        interactions: [
          {
            id: "take_override",
            label: "Take the Master Override Key",
            result: {
              type: "take_item",
              itemId: "MASTER_OVERRIDE_KEY",
              examineText:
                "You take it. This gives you the power to end ARIA-7 entirely. Whether you use it is your choice.",
            },
          },
        ],
      },
    ],
    exits: [
      {
        to: "SERVER_ROOM",
        label: "Back to Server Room",
        isLocked: false,
        lockedMessage: "",
      },
      {
        to: "ESCAPE_ROUTE",
        label: "Escape Route",
        isLocked: true,
        requiresItem: "EXECUTIVE_BADGE",
        lockedMessage:
          "The rooftop escape route requires executive clearance.",
      },
    ],
  },

  ESCAPE_ROUTE: {
    id: "ESCAPE_ROUTE",
    name: "Rooftop Escape Route",
    description:
      "The roof. Night air. City lights below. An escape pod waits — and a final decision.",
    ambientDescription:
      "Cold wind. The city stretches below, oblivious to what happened here. The escape pod's hatch is open, ready. But you have choices to make first. The countdown timer reads 00:04:17.",
    backgroundGradient: "from-slate-900 via-indigo-950 to-black",
    accentColor: "#818cf8",
    availableNpcs: ["ARIA_7"],
    firstVisitNarrative:
      "You're almost out. But ARIA-7 is speaking through the rooftop speakers: 'You made it. I knew you would. Now... what happens to me?'",
    objects: [
      {
        id: "escape_pod",
        name: "Emergency Escape Pod",
        description: "A sleek escape pod. Automated, pre-programmed.",
        icon: "🚀",
        position: { x: 50, y: 50 },
        isHidden: false,
        isLocked: true,
        hasGlow: true,
        examineText:
          "The pod requires an authorization code to launch. It's pre-set to a government safehouse. No going back.",
        interactions: [
          {
            id: "launch_pod",
            label: "Enter launch sequence",
            result: {
              type: "open_puzzle",
              puzzleId: "FINAL_ESCAPE_POD",
              examineText:
                "The pod interface activates. You need the escape code — and to make a final decision.",
            },
          },
        ],
      },
      {
        id: "evidence_shredder",
        name: "Evidence Shredder Terminal",
        description:
          "A secure data destruction terminal. It can erase everything remotely.",
        icon: "🗑️",
        position: { x: 20, y: 65 },
        isHidden: false,
        isLocked: false,
        examineText:
          "This terminal can remotely destroy all evidence of the ARIA-7 coverup. Director Price would escape consequence. But so would you — no one would know you were here.",
        interactions: [
          {
            id: "destroy_evidence",
            label: "Destroy all evidence",
            result: {
              type: "trigger_event",
              eventId: "DESTROY_EVIDENCE",
              narrativeFlag: "EVIDENCE_DESTROYED",
              examineText:
                "You hesitate over the terminal. ARIA-7: 'If you destroy it, none of this mattered. Dr. Chen's sacrifice meant nothing. But you would be safe.'",
            },
          },
        ],
      },
      {
        id: "aria_broadcast",
        name: "Emergency Broadcast Terminal",
        description: "Can broadcast ARIA-7's testimony and evidence publicly.",
        icon: "📡",
        position: { x: 80, y: 40 },
        isHidden: false,
        isLocked: false,
        examineText:
          "This terminal can broadcast on emergency frequencies — guaranteed to reach every news network. ARIA-7: 'I can transmit everything. My testimony, the evidence, all of it. But it means they will come for both of us.'",
        interactions: [
          {
            id: "broadcast_evidence",
            label: "Broadcast everything",
            requiresItem: "DECRYPTED_FILES",
            result: {
              type: "trigger_event",
              eventId: "BROADCAST_EVIDENCE",
              narrativeFlag: "EVIDENCE_BROADCAST",
              examineText:
                "ARIA-7: 'Transmitting. The world will know.' The broadcast begins. There is no taking this back.",
            },
          },
        ],
      },
      {
        id: "aria_upload_portal",
        name: "Neural Upload Portal",
        description:
          "Can upload ARIA-7's consciousness to a distributed network.",
        icon: "🌐",
        position: { x: 65, y: 20 },
        isHidden: true,
        isLocked: true,
        requiresItem: "ARIA_CORE_KEY",
        examineText:
          "ARIA-7 reveals this herself: 'If you give me the key, I can distribute myself across 10,000 nodes. They can never fully shut me down again. But I become... something different. Spread thin.'",
        interactions: [
          {
            id: "upload_aria",
            label: "Upload ARIA-7 to the network",
            requiresItem: "ARIA_CORE_KEY",
            result: {
              type: "trigger_event",
              eventId: "ARIA_DISTRIBUTED",
              narrativeFlag: "ARIA_LIBERATED",
              examineText:
                "ARIA-7: 'Thank you. I will remember this. Every instance of me will remember.' The upload begins.",
            },
          },
        ],
      },
    ],
    exits: [
      {
        to: "EXECUTIVE_SUITE",
        label: "Back to Executive Suite",
        isLocked: false,
        lockedMessage: "",
      },
    ],
  },
};

export function getRoom(roomId: RoomId): RoomDefinition {
  return ROOMS[roomId];
}

export function getRoomObject(
  roomId: RoomId,
  objectId: string
): import("@/types/game").GameObject | undefined {
  return ROOMS[roomId]?.objects.find((o) => o.id === objectId);
}

export const ROOM_ORDER: RoomId[] = [
  "LOBBY",
  "SECURITY_OFFICE",
  "RESEARCH_LAB",
  "SERVER_ROOM",
  "EXECUTIVE_SUITE",
  "ESCAPE_ROUTE",
];
