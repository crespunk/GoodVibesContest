"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBoxGeometry, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "@/stores/gameStore";
import { useUiStore } from "@/stores/uiStore";
import { useGraphicsStore } from "@/stores/graphicsStore";
import { getQualityPreset } from "@/lib/graphics/quality";
import { BloomEffects } from "./effects/BloomEffects";
import { ParticleField } from "./effects/ParticleField";
import { getRoom } from "@/lib/game/rooms";
import { getItem } from "@/lib/game/items";
import type { RoomId, ItemId, PuzzleId, NpcId } from "@/types/game";

// Objects whose door/dial/hatch animation is tied to a specific puzzle's
// solved state, rather than just focus/inspection. Keyed by object id.
const OBJECT_PUZZLE_MAP: Partial<Record<string, PuzzleId>> = {
  security_safe: "SECURITY_SAFE",
  escape_pod: "FINAL_ESCAPE_POD",
};

// ─── Constants ────────────────────────────────────────────────────────────────
const HALF = 7;       // room half-extents (14×14 floor)
const ROOM_H = 8;     // ceiling height
const PLAYER_H = 1.7; // eye level
const SPEED = 6;
const INTERACT_DIST = 4.5;
// RoundedBoxGeometry's cap UV isn't normalized to 0–1 — it's offset inward by
// exactly the corner radius, so the front-face texture must be shifted by the
// same amount to land centered. Keep this in sync with every RoundedBoxGeometry radius.
const PC_CORNER_RADIUS = 0.08;
// Revolved profile (radius, height) for the emergency phone's handset — a
// smooth dumbbell silhouette (narrow grip, rounded bulges at each end) rather
// than a cylinder-plus-spheres assembly with visible seams.
const PHONE_HANDSET_PROFILE = [
  new THREE.Vector2(0,     -0.13),
  new THREE.Vector2(0.035, -0.125),
  new THREE.Vector2(0.048, -0.105),
  new THREE.Vector2(0.048, -0.085),
  new THREE.Vector2(0.02,  -0.045),
  new THREE.Vector2(0.016,  0),
  new THREE.Vector2(0.02,   0.045),
  new THREE.Vector2(0.048,  0.085),
  new THREE.Vector2(0.048,  0.105),
  new THREE.Vector2(0.035,  0.125),
  new THREE.Vector2(0,      0.13),
];

// ─── Room Themes ─────────────────────────────────────────────────────────────
const THEME: Record<RoomId, { wall: string; floor: string; accent: string; fog: string }> = {
  LOBBY:           { wall: "#110303", floor: "#0d0d0d", accent: "#ff2222", fog: "#0a0101" },
  SECURITY_OFFICE: { wall: "#03030f", floor: "#050514", accent: "#4455ff", fog: "#02020a" },
  RESEARCH_LAB:    { wall: "#031008", floor: "#051308", accent: "#00cc77", fog: "#021006" },
  SERVER_ROOM:     { wall: "#010d16", floor: "#010d18", accent: "#00ccee", fog: "#000d16" },
  EXECUTIVE_SUITE: { wall: "#160e03", floor: "#160c03", accent: "#ffaa22", fog: "#100b02" },
  ESCAPE_ROUTE:    { wall: "#030310", floor: "#030312", accent: "#8866ff", fog: "#020215" },
};

// ─── Object 3D Positions [x, y, z, rotY?] ────────────────────────────────────
const OBJ_POS: Record<string, [number, number, number, number?]> = {
  // LOBBY
  reception_desk:            [ -2,   0.45,  3],
  security_panel:            [ -6.5, 1.5,   0,  Math.PI / 2],
  elevator:                  [  6.85, 2,   -3, -Math.PI / 2], // moved flush against the east wall
  coffee_machine:            [  6,   1.26,  2.7, -Math.PI / 2], // resting on the coffee table, next to vending_machine along the east wall
  emergency_board:           [ -3.5,  1.5,  -6.9],
  vending_machine:           [  6,   1.27,  4, -Math.PI / 2], // y raised to keep base flush with floor after 30% scale-up
  // SECURITY_OFFICE
  marcus_pc:                 [  3,   0.65,  3.5, -Math.PI / 8],
  security_console:          [  0,   0.7,   1],
  security_safe:             [  6.5, 1.2,   0, -Math.PI / 2],
  filing_cabinet:            [ -6.5, 1.0,   3,  Math.PI / 2],
  whiteboard:                [ -1,   1.5,  -6.5],
  radio:                     [  6.5, 1.2,   5],
  // RESEARCH_LAB
  holographic_display:       [ -6.5, 1.0,  -3,  Math.PI / 2],
  workstation_a:             [ -6.49, 0.547, 3,  Math.PI / 2], // x = -HALF + halfDepth so it sits flush touching the wall; y keeps it flush on the floor
  chemical_cabinet:          [  6.5, 1.43, -3, -Math.PI / 2], // y = height/2 so it rests flush on the floor
  experiment_logs:           [  6.0, 1.236, 3.2, -Math.PI / 2], // resting on the long table's north end (near the reading lamp), facing the room center
  encrypted_drive_terminal:  [  6.0, 1.486, 5.2, -Math.PI / 2], // resting on the long table's south end, next to the notebooks
  // SERVER_ROOM — kept flush against the walls (no exits on the north/east
  // walls) to leave the room's center clear to walk through. server_racks
  // anchors the northwest corner; 3 decorative-only copies (SERVER_RACK_ROW
  // in Scene) extend the row along the north wall.
  aria_terminal:             [  0,   1.0,  -6.8],
  server_racks:              [ -6.3, 2.0,  -5.6],
  shutdown_switch:           [  6.5, 1.5,  -2, -Math.PI / 2],
  power_grid:                [ -6.5, 1.5,   3,  Math.PI / 2],
  data_drive_station:        [  6.5, 1.0,   4, -Math.PI / 2],
  // EXECUTIVE_SUITE
  ceo_desk:                  [  0,   0.75,  2],
  art_piece:                 [ -6.5, 1.8,   1,  Math.PI / 2],
  hidden_safe:               [ -6.5, 1.8,   1,  Math.PI / 2],
  private_terminal:          [  6.65, 0.75, -4, -Math.PI / 2], // flush against east wall, clear of walking path
  emergency_phone:           [  0,    1.4,   2,    Math.PI], // centered on ceo_desk (matches its x/z exactly) — y re-tuned for the real desk.glb top surface (base 0.35 + RECEPTION_DESK_TOP_Y 0.884 ≈ 1.234), keeping the same ~0.17 clearance above the desk top as before the model swap
  master_override:           [  3,   1.5,   5],
  // ESCAPE_ROUTE
  // escape_pod flattened to a near-flush plaque (see OBJ_SCALE depth 0.08)
  // so only its front-face image reads, like a mural — centered on the
  // north wall (x=0) and flush against it (z=-7 + halfDepth + tiny gap).
  escape_pod:                [  0,     4,    -6.94],
  evidence_shredder:         [ -2,   1.213, 2.5,  Math.PI / 2], // resting on its own (shorter) table, facing +X toward aria_broadcast
  aria_broadcast:            [  2,   1.213, 2.5, -Math.PI / 2], // resting on its own (shorter) table, facing -X toward evidence_shredder
  aria_upload_portal:        [  3,   1.5,  -5],
};

const OBJ_SCALE: Record<string, [number, number, number]> = {
  reception_desk:           [3.2, 0.9,  1.4],
  security_panel:           [1.4, 1.8,  0.1],
  elevator:                 [1.8, 3.8,  0.3],
  coffee_machine:           [0.6, 1.1,  0.5],
  emergency_board:          [1.3, 0.85, 0.07],
  vending_machine:          [1.04, 2.34, 0.78], // 30% bigger than original
  marcus_pc:                [1.2, 0.6,  1.2], // sized to cover the drone model's actual (wide, flat) footprint at MARCUS_ROBOT_SCALE
  security_console:         [2.5, 0.7,  1.0],
  security_safe:            [0.7, 0.7,  0.4],
  filing_cabinet:           [0.7, 1.8,  0.5],
  whiteboard:               [3.0, 1.8,  0.08],
  radio:                    [0.3, 0.25, 0.25],
  holographic_display:      [0.8, 1.4,  0.08],
  workstation_a:            [2.552, 1.094, 1.021], // depth (thickness off the wall) reduced 30%
  chemical_cabinet:         [1.56, 2.86, 0.52], // 30% bigger than original
  experiment_logs:          [0.4, 0.2,  0.7],
  encrypted_drive_terminal: [0.7, 0.7,  0.5],
  aria_terminal:            [1.0, 1.4,  0.25],
  server_racks:             [1.4, 4.0,  2.8],
  shutdown_switch:          [0.35,0.28, 0.15],
  power_grid:               [1.4, 1.4,  0.18],
  data_drive_station:       [0.7, 0.7,  0.55],
  ceo_desk:                 [3.2, 0.8,  1.4],
  art_piece:                [1.8, 1.8,  0.08],
  hidden_safe:              [0.7, 0.7,  0.2],
  private_terminal:         [1.0, 0.7,  0.55],
  emergency_phone:          [0.336,0.336, 0.18], // 20% bigger than original
  master_override:          [0.28,0.28, 0.1],
  escape_pod:               [8.58, 7.41, 0.08], // kept the enlarged width/height, depth shrunk to a thin wall plaque
  evidence_shredder:        [1.04, 1.04, 0.65], // matched to aria_broadcast, 30% bigger, sits on its table
  aria_broadcast:           [1.04, 1.04, 0.65], // matched to evidence_shredder, 30% bigger, sits on its table
  aria_upload_portal:       [1.1, 1.4,  0.25],
};

// Reception desk — real CC0 furniture models (Kenney "Furniture Kit", public
// domain; see public/models/furniture/LICENSE.txt) standing in for what used
// to be a flat textured box. ObjMesh keeps the original OBJ_POS/OBJ_SCALE box
// as an invisible raycasting hitbox (unchanged interaction/focus behavior);
// these models are purely the visual layer on top of it.
const RECEPTION_DESK_URL      = "/models/furniture/desk.glb";
const RECEPTION_MONITOR_URL   = "/models/furniture/computerScreen.glb";
const RECEPTION_KEYBOARD_URL  = "/models/furniture/computerKeyboard.glb";
const RECEPTION_MOUSE_URL     = "/models/furniture/computerMouse.glb";
const RECEPTION_DESK_SCALE     = 2.3;
// Width (X) only, 25% wider than the uniform scale — depth/height untouched.
const RECEPTION_DESK_SCALE_XYZ: [number, number, number] = [RECEPTION_DESK_SCALE * 1.25, RECEPTION_DESK_SCALE, RECEPTION_DESK_SCALE];
const RECEPTION_MONITOR_SCALE  = 1.3 * 1.2; // +20%
const RECEPTION_KEYBOARD_SCALE = 1.3;
const RECEPTION_MOUSE_SCALE    = 1.3;
// desk.glb's native (unscaled) height, measured from its GLTF accessor
// bounds — used to rest the monitor/keyboard/mouse on its actual top surface.
const RECEPTION_DESK_NATIVE_H = 0.3844;
const RECEPTION_DESK_TOP_Y = RECEPTION_DESK_NATIVE_H * RECEPTION_DESK_SCALE;
const RECEPTION_MONITOR_POS: [number, number, number]  = [0,     RECEPTION_DESK_TOP_Y, -0.18];
const RECEPTION_KEYBOARD_POS: [number, number, number] = [0,     RECEPTION_DESK_TOP_Y,  0.18];
const RECEPTION_MOUSE_POS: [number, number, number]    = [0.22,  RECEPTION_DESK_TOP_Y,  0.18];

// Loads a GLTF model, clones it (so multiple instances don't share transforms),
// and recenters it on X/Z with its base sitting at local y=0 — so callers can
// position/scale/rotate it like any primitive without hand-tuning per-model
// pivot offsets.
function GltfProp({
  url, scale = 1, position = [0, 0, 0], rotationY = 0, shadowsOn, autoCenter = true, manualOffset,
}: {
  url: string;
  scale?: number | [number, number, number];
  position?: [number, number, number];
  rotationY?: number;
  shadowsOn: boolean;
  // Box3.setFromObject reads each mesh's *unposed* local geometry — for a
  // static prop that's the same as its rendered shape, but for a rigged/
  // skinned model (like the Marcus PC robot) it can be wildly wrong, since
  // the actual on-screen silhouette only exists after the skeleton's bone
  // transforms are applied. Skinned models should pass autoCenter={false}
  // and a manually-tuned manualOffset instead.
  autoCenter?: boolean;
  manualOffset?: [number, number, number];
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const offset = useMemo(() => {
    if (!autoCenter) return manualOffset ?? [0, 0, 0];
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    return [-center.x, -box.min.y, -center.z] as [number, number, number];
  }, [cloned, autoCenter, manualOffset]);

  useEffect(() => {
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = shadowsOn;
        mesh.receiveShadow = shadowsOn;
        // Several of these downloaded models (the safe especially) come in
        // near-mirror-metallic — under this scene's single small per-object
        // point light (everything else is near-black), a high-metalness/
        // low-roughness surface only catches a couple of sharp specular
        // glints and reads as an almost-invisible black silhouette
        // otherwise. Clamping both gives the surface a real diffuse
        // response so the point light actually lights it up.
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && "metalness" in mat) {
          mat.metalness = Math.min(mat.metalness, 0.5);
          mat.roughness = Math.max(mat.roughness, 0.45);
        }
        // Skinned meshes (the Marcus PC robot) often carry a bounding
        // sphere/box computed from their *unposed* reference geometry —
        // three.js uses that stale bound for frustum culling instead of the
        // actual skinned/posed silhouette, so depending on where the object
        // sits relative to the camera it can get wrongly culled and vanish
        // entirely even though it's well within view. Skip frustum culling
        // for skinned meshes so they're always drawn.
        if ((mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) {
          mesh.frustumCulled = false;
        }
      }
    });
  }, [cloned, shadowsOn]);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={cloned} position={offset} />
    </group>
  );
}

function ReceptionDeskModel({ shadowsOn }: { shadowsOn: boolean }) {
  return (
    <>
      <GltfProp url={RECEPTION_DESK_URL} scale={RECEPTION_DESK_SCALE_XYZ} shadowsOn={shadowsOn} />
      <GltfProp url={RECEPTION_MONITOR_URL} scale={RECEPTION_MONITOR_SCALE} rotationY={0} position={RECEPTION_MONITOR_POS} shadowsOn={shadowsOn} />
      <GltfProp url={RECEPTION_KEYBOARD_URL} scale={RECEPTION_KEYBOARD_SCALE} position={RECEPTION_KEYBOARD_POS} shadowsOn={shadowsOn} />
      <GltfProp url={RECEPTION_MOUSE_URL} scale={RECEPTION_MOUSE_SCALE} position={RECEPTION_MOUSE_POS} shadowsOn={shadowsOn} />
    </>
  );
}

useGLTF.preload(RECEPTION_DESK_URL);
useGLTF.preload(RECEPTION_MONITOR_URL);
useGLTF.preload(RECEPTION_KEYBOARD_URL);
useGLTF.preload(RECEPTION_MOUSE_URL);

// Security console — same desk model as the reception desk, scaled down to
// fit this object's shorter/narrower hitbox (OBJ_SCALE [2.5, 0.7, 1.0] vs
// reception's [3.2, 0.9, 1.4]), with three monitors lined up across it
// instead of one — matching the "3 monitors" the old flat texture drew.
const SECURITY_DESK_SCALE_XYZ: [number, number, number] = [2.9, 1.8, 1.8];
const SECURITY_DESK_TOP_Y = RECEPTION_DESK_NATIVE_H * SECURITY_DESK_SCALE_XYZ[1];
const SECURITY_MONITOR_SCALE = 1.15;
const SECURITY_KEYBOARD_SCALE = 1.2;
const SECURITY_MONITOR_X_OFFSETS = [-0.62, 0, 0.62];

// Desk chair — same Kenney "Furniture Kit" pack, pulled up to the console's
// front edge (the +z side, where the keyboard sits) and centered on the
// middle monitor, facing back into the desk.
const SECURITY_CHAIR_URL = "/models/furniture/chairDesk.glb";
const SECURITY_CHAIR_SCALE = 1.5;
const SECURITY_CHAIR_POS: [number, number, number] = [0, 0, 0.85];
const SECURITY_CHAIR_ROTATION_Y = Math.PI;

function SecurityConsoleModel({ shadowsOn }: { shadowsOn: boolean }) {
  return (
    <>
      <GltfProp url={RECEPTION_DESK_URL} scale={SECURITY_DESK_SCALE_XYZ} shadowsOn={shadowsOn} />
      {SECURITY_MONITOR_X_OFFSETS.map((x) => (
        <GltfProp
          key={x}
          url={RECEPTION_MONITOR_URL}
          scale={SECURITY_MONITOR_SCALE}
          position={[x, SECURITY_DESK_TOP_Y, -0.15]}
          shadowsOn={shadowsOn}
        />
      ))}
      <GltfProp
        url={RECEPTION_KEYBOARD_URL}
        scale={SECURITY_KEYBOARD_SCALE}
        position={[0, SECURITY_DESK_TOP_Y, 0.2]}
        shadowsOn={shadowsOn}
      />
      <GltfProp
        url={SECURITY_CHAIR_URL}
        scale={SECURITY_CHAIR_SCALE}
        position={SECURITY_CHAIR_POS}
        rotationY={SECURITY_CHAIR_ROTATION_Y}
        shadowsOn={shadowsOn}
      />
    </>
  );
}

useGLTF.preload(SECURITY_CHAIR_URL);

// Director's desk (EXECUTIVE_SUITE's "ceo_desk") — same real desk.glb model
// as the reception desk (only the desk itself, no monitor/keyboard/mouse —
// the emergency_phone stays a separate object, positioned on top of it via
// its own OBJ_POS entry). See ReceptionDeskModel / usesRealModel in ObjMesh.
function CeoDeskModel({ shadowsOn }: { shadowsOn: boolean }) {
  return <GltfProp url={RECEPTION_DESK_URL} scale={RECEPTION_DESK_SCALE_XYZ} shadowsOn={shadowsOn} />;
}

// Coffee machine — same real-CC0-model swap as the reception desk (Kenney
// "Furniture Kit", public domain), replacing the flat textured box that sits
// on the LOBBY coffee table. See CoffeeMachineModel / usesRealModel in ObjMesh.
const COFFEE_MACHINE_URL = "/models/furniture/kitchenCoffeeMachine.glb";
const COFFEE_MACHINE_SCALE = 3.0; // 100% bigger
// kitchenCoffeeMachine.glb's native (unscaled) height, measured from its
// GLTF accessor bounds — used to aim the steam particles at its actual top
// (see the ParticleField anchored on coffee_machine in Scene) instead of
// the old box's now-unrelated height.
const COFFEE_MACHINE_NATIVE_H = 0.3034;
const COFFEE_MACHINE_TOP_Y = COFFEE_MACHINE_NATIVE_H * COFFEE_MACHINE_SCALE;

function CoffeeMachineModel({ shadowsOn }: { shadowsOn: boolean }) {
  return <GltfProp url={COFFEE_MACHINE_URL} scale={COFFEE_MACHINE_SCALE} shadowsOn={shadowsOn} />;
}

useGLTF.preload(COFFEE_MACHINE_URL);

// Elevator — same real-CC0-model swap, this time a sliding sci-fi door
// (Kenney "Space Station Kit", public domain) standing in for the flat
// wall-mounted mural box. At this scale its natural width/depth (1.8/0.3)
// land almost exactly on the original box's OBJ_SCALE — only the height
// shrinks, from a floor-to-half-ceiling mural down to an actual door height.
const ELEVATOR_DOOR_URL = "/models/furniture/elevatorDoor.glb";
const ELEVATOR_DOOR_SCALE = 3.0 * 1.4; // 40% bigger

// door.glb's native (unscaled) width/height, measured from its GLTF accessor
// bounds — used to size and place the call-button panel proportionally to
// whatever ELEVATOR_DOOR_SCALE currently is, instead of hardcoded constants
// that would go stale if the door is resized again.
const ELEVATOR_DOOR_NATIVE_W = 0.6;
const ELEVATOR_DOOR_NATIVE_H = 0.7;

// Classic up/down call buttons mounted on the wall beside the door — a small
// backing plate with two round, glowing, slightly-proud buttons, matching
// how this file builds other tactile details (the safe's dial, the switch's
// cover) out of primitives rather than a flat texture.
//
// Each button is two meshes: a plain cylinder (rotated so it protrudes along
// +z) for the 3D puck body, plus a circleGeometry disc — which lies in the
// XY plane by construction, needing no rotation — for the glowing ▲/▼ face.
// (An earlier version put the texture on the cylinder's own end cap, but a
// rotated cylinder cap's UVs don't line up with world up/down, so the arrow
// glyphs came out rotated 90°; the flat disc's UVs map straight to local
// X/Y with no such twist.)
function ElevatorCallPanel({ shadowsOn, accentColor }: { shadowsOn: boolean; accentColor: string }) {
  const accent = useMemo(() => new THREE.Color(accentColor), [accentColor]);
  const plateTex = useMemo(() => getMaterialTex('metal_dark'), []);
  const upTex = useMemo(() => getObjectTexture("elevator_btn_up", accentColor), [accentColor]);
  const downTex = useMemo(() => getObjectTexture("elevator_btn_down", accentColor), [accentColor]);

  const doorWidth = ELEVATOR_DOOR_NATIVE_W * ELEVATOR_DOOR_SCALE;
  const doorHeight = ELEVATOR_DOOR_NATIVE_H * ELEVATOR_DOOR_SCALE;
  const panelX = doorWidth / 2 + doorWidth * 0.12;
  const panelY = doorHeight * 0.5;
  const panelW = doorWidth * 0.09;
  const panelH = doorWidth * 0.2;
  const panelD = doorWidth * 0.035;
  const btnRadius = panelW * 0.36;
  const btnDepth = panelD * 0.6;
  const btnZ = panelD / 2 + btnDepth / 2;

  const puckMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.4, metalness: 0.6 }),
    []
  );
  const upFaceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: upTex, emissive: accent, emissiveMap: upTex, emissiveIntensity: 0.85, roughness: 0.3, metalness: 0.3, side: THREE.DoubleSide }),
    [upTex, accent]
  );
  const downFaceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: downTex, emissive: accent, emissiveMap: downTex, emissiveIntensity: 0.85, roughness: 0.3, metalness: 0.3, side: THREE.DoubleSide }),
    [downTex, accent]
  );

  return (
    <group position={[panelX, panelY, 0]}>
      <mesh castShadow={shadowsOn} receiveShadow={shadowsOn}>
        <boxGeometry args={[panelW, panelH, panelD]} />
        <meshStandardMaterial map={plateTex} color="#3a3a3a" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Up button */}
      <mesh position={[0, panelH * 0.24, btnZ]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadowsOn}>
        <cylinderGeometry args={[btnRadius, btnRadius, btnDepth, 24]} />
        <primitive object={puckMat} attach="material" />
      </mesh>
      <mesh position={[0, panelH * 0.24, btnZ + btnDepth / 2 + 0.001]} material={upFaceMat}>
        <circleGeometry args={[btnRadius * 0.98, 24]} />
      </mesh>
      {/* Down button */}
      <mesh position={[0, -panelH * 0.24, btnZ]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadowsOn}>
        <cylinderGeometry args={[btnRadius, btnRadius, btnDepth, 24]} />
        <primitive object={puckMat} attach="material" />
      </mesh>
      <mesh position={[0, -panelH * 0.24, btnZ + btnDepth / 2 + 0.001]} material={downFaceMat}>
        <circleGeometry args={[btnRadius * 0.98, 24]} />
      </mesh>
      <pointLight position={[0, 0, panelD * 2]} color={accentColor} intensity={0.6} distance={1.5} decay={2} />
    </group>
  );
}

function ElevatorModel({ shadowsOn, accentColor }: { shadowsOn: boolean; accentColor: string }) {
  return (
    <>
      <GltfProp url={ELEVATOR_DOOR_URL} scale={ELEVATOR_DOOR_SCALE} shadowsOn={shadowsOn} />
      <ElevatorCallPanel shadowsOn={shadowsOn} accentColor={accentColor} />
    </>
  );
}

useGLTF.preload(ELEVATOR_DOOR_URL);

// Security safe — a real CC0 steel-safe model ("Safe" by CreativeTrio, via
// poly.pizza) standing in for the flat textured box in SECURITY_OFFICE. The
// safe puzzle's dial and handle lever are kept exactly as they were (real
// primitive geometry, animated in ObjMesh's useFrame on solve) — only their
// z-offset changes, from "proud of the old box's front face" to "proud of
// this model's actual (deeper) front face", so they still sit correctly on
// the safe door instead of floating in front of or clipping into it.
const SECURITY_SAFE_URL = "/models/furniture/securitySafe.glb";
const SECURITY_SAFE_SCALE = 2.0;
// Native size measured from the GLTF accessor bounds *after* applying the
// model's own 100x node-level scale (the raw accessor bounds alone are in
// millimeters — Box3.setFromObject in GltfProp handles this automatically
// at runtime, but these constants are needed here ahead of time to size the
// dial/handle overlay).
const SECURITY_SAFE_NATIVE_W = 0.244;
const SECURITY_SAFE_NATIVE_H = 0.2432;
const SECURITY_SAFE_NATIVE_D = 0.2654;
const SECURITY_SAFE_HALF_DEPTH = (SECURITY_SAFE_NATIVE_D * SECURITY_SAFE_SCALE) / 2;
// The dial/handle render in ObjMesh's outer (unscaled) group, where y=0 is
// the old box's vertical center — but the real model sits in a group offset
// down by half the box height (see usesRealModel's -scale[1]/2 pattern), so
// its own vertical center lands below y=0. Recompute that offset here so
// the dial/handle can be centered on the model instead of the old box.
const SECURITY_SAFE_CENTER_Y =
  -(OBJ_SCALE.security_safe[1] / 2) + (SECURITY_SAFE_NATIVE_H * SECURITY_SAFE_SCALE) / 2;

function SecuritySafeModel({ shadowsOn }: { shadowsOn: boolean }) {
  return <GltfProp url={SECURITY_SAFE_URL} scale={SECURITY_SAFE_SCALE} shadowsOn={shadowsOn} />;
}

useGLTF.preload(SECURITY_SAFE_URL);

// Marcus's PC — reskinned as a small floating drone-like robot companion
// ("Drone with Orb" by Adam Marc Williams, CC-BY, via poly.pizza) instead of
// a wall-mounted monitor, for both its resting state (ObjMesh's marcus_pc
// case) and its animated following state (FloatingMarcusPC). This is a
// static (non-rigged) model used as a stylistic stand-in for a "floating AI
// companion" — not a reproduction of any copyrighted character design.
// (An earlier rigged/skinned model rendered fine at rest but silently failed
// to appear once animated/repositioned each frame by FloatingMarcusPC — its
// skeleton's bounds apparently didn't track the live pose reliably through
// our simple clone()-based GLTF loader. Swapped to this static model to
// sidestep skinned-mesh cloning/posing pitfalls entirely.)
const MARCUS_ROBOT_URL = "/models/furniture/marcusRobot.glb";
const MARCUS_ROBOT_SCALE = 0.8;
const MARCUS_ROBOT_ROTATION_Y = 0;

function MarcusRobotModel({ shadowsOn }: { shadowsOn: boolean }) {
  return (
    <GltfProp
      url={MARCUS_ROBOT_URL}
      scale={MARCUS_ROBOT_SCALE}
      rotationY={MARCUS_ROBOT_ROTATION_Y}
      shadowsOn={shadowsOn}
    />
  );
}

useGLTF.preload(MARCUS_ROBOT_URL);

// Research Workstation (RESEARCH_LAB's "workstation_a") — a real desk (same
// Kenney model as the reception desk) with two monitors, a keyboard/mouse
// (the "computer"), and a real CC0 lab-equipment cluster (beakers, flasks,
// and other apparatus — "Blocks Lab Equipment" by Don Carson, CC-BY, via
// poly.pizza) standing in for the flat textured box's "dual monitors +
// research desk" mural. Uses the same real-model/invisible-hitbox pattern as
// every other swapped object in this file.
const LAB_EQUIPMENT_URL = "/models/furniture/labEquipment.glb";
const WORKSTATION_DESK_SCALE = 2.4;
const WORKSTATION_DESK_WIDTH_SCALE = WORKSTATION_DESK_SCALE * 1.3; // 30% wider
const WORKSTATION_DESK_TOP_Y = RECEPTION_DESK_NATIVE_H * WORKSTATION_DESK_SCALE;
const WORKSTATION_MONITOR_SCALE = 1.4375; // 25% bigger
const WORKSTATION_KEYBOARD_SCALE = 1.2;
const WORKSTATION_LAB_EQUIPMENT_SCALE = 0.22;
const WORKSTATION_MONITOR_X_OFFSETS = [-0.4, 0.35];

function WorkstationModel({ shadowsOn }: { shadowsOn: boolean }) {
  return (
    <>
      <GltfProp
        url={RECEPTION_DESK_URL}
        scale={[WORKSTATION_DESK_WIDTH_SCALE, WORKSTATION_DESK_SCALE, WORKSTATION_DESK_SCALE]}
        shadowsOn={shadowsOn}
      />
      {WORKSTATION_MONITOR_X_OFFSETS.map((x) => (
        <GltfProp
          key={x}
          url={RECEPTION_MONITOR_URL}
          scale={WORKSTATION_MONITOR_SCALE}
          position={[x, WORKSTATION_DESK_TOP_Y, -0.15]}
          shadowsOn={shadowsOn}
        />
      ))}
      <GltfProp
        url={RECEPTION_KEYBOARD_URL}
        scale={WORKSTATION_KEYBOARD_SCALE}
        position={[-0.4, WORKSTATION_DESK_TOP_Y, 0.22]}
        shadowsOn={shadowsOn}
      />
      <GltfProp
        url={RECEPTION_MOUSE_URL}
        scale={WORKSTATION_KEYBOARD_SCALE}
        position={[-0.1, WORKSTATION_DESK_TOP_Y, 0.22]}
        shadowsOn={shadowsOn}
      />
      {/* Research tools — beakers/flasks/apparatus cluster, on the desk's
          right-hand end, clear of the monitors and keyboard/mouse. */}
      <GltfProp
        url={LAB_EQUIPMENT_URL}
        scale={WORKSTATION_LAB_EQUIPMENT_SCALE}
        position={[0.85, WORKSTATION_DESK_TOP_Y, 0.05]}
        shadowsOn={shadowsOn}
      />
    </>
  );
}

useGLTF.preload(LAB_EQUIPMENT_URL);

// Decorative-only server racks continuing the row from the interactive
// "server_racks" object (at [-6.3, 2.0, -5.6]) along the SERVER_ROOM north wall.
const SERVER_RACK_ROW_EXTRA: Array<[number, number, number]> = [
  [-4.8, 2.0, -5.6],
  [-3.3, 2.0, -5.6],
  [-1.8, 2.0, -5.6],
];

// ─── Exit Doorframe Positions ─────────────────────────────────────────────────
const EXIT_LAYOUT: Record<RoomId, Array<{
  position: [number, number, number];
  rotY?: number;
  to: RoomId;
  label: string;
}>> = {
  LOBBY: [
    { position: [0, 0, -HALF], to: "SECURITY_OFFICE", label: "Security Office" },
  ],
  SECURITY_OFFICE: [
    { position: [0, 0, HALF], rotY: Math.PI, to: "LOBBY", label: "Lobby" },
    { position: [HALF, 0, -4], rotY: -Math.PI / 2, to: "RESEARCH_LAB", label: "Research Lab" },
  ],
  RESEARCH_LAB: [
    { position: [-HALF, 0, 0], rotY: Math.PI / 2, to: "SECURITY_OFFICE", label: "Security Office" },
    { position: [0, 0, -HALF], to: "SERVER_ROOM", label: "Server Room" },
  ],
  SERVER_ROOM: [
    { position: [0, 0, HALF], rotY: Math.PI, to: "RESEARCH_LAB", label: "Research Lab" },
    { position: [-HALF, 0, 0], rotY: Math.PI / 2, to: "EXECUTIVE_SUITE", label: "Executive Suite" },
  ],
  EXECUTIVE_SUITE: [
    { position: [HALF, 0, 0], rotY: -Math.PI / 2, to: "SERVER_ROOM", label: "Server Room" },
    { position: [0, 0, -HALF], to: "ESCAPE_ROUTE", label: "Escape Route" },
  ],
  ESCAPE_ROUTE: [
    { position: [0, 0, HALF], rotY: Math.PI, to: "EXECUTIVE_SUITE", label: "Executive Suite" },
  ],
};

// ─── Canvas texture helpers ───────────────────────────────────────────────────
function hex2rgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex: string, a: number) {
  const [r, g, b] = hex2rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ─── Material texture system (photo-realistic side/top/back faces) ───────────
type MatType = 'metal_brushed' | 'metal_dark' | 'wood_dark' | 'glass_dark' | 'paper_aged' | 'server_panel';

const MAT_PROPS: Record<MatType, { roughness: number; metalness: number }> = {
  metal_brushed: { roughness: 0.35, metalness: 0.85 },
  metal_dark:    { roughness: 0.6,  metalness: 0.65 },
  wood_dark:     { roughness: 0.9,  metalness: 0.0  },
  glass_dark:    { roughness: 0.15, metalness: 0.2  },
  paper_aged:    { roughness: 1.0,  metalness: 0.0  },
  server_panel:  { roughness: 0.45, metalness: 0.75 },
};

const OBJ_MATERIAL_TYPE: Record<string, MatType> = {
  reception_desk:            'wood_dark',
  security_panel:            'metal_dark',
  elevator:                  'metal_brushed',
  coffee_machine:            'metal_dark',
  emergency_board:           'metal_dark',
  vending_machine:           'metal_dark',
  marcus_pc:                 'metal_dark',
  security_console:          'metal_dark',
  security_safe:             'metal_brushed',
  filing_cabinet:            'metal_dark',
  whiteboard:                'metal_dark',
  radio:                     'metal_dark',
  holographic_display:       'glass_dark',
  workstation_a:             'wood_dark',
  chemical_cabinet:          'metal_dark',
  experiment_logs:           'paper_aged',
  encrypted_drive_terminal:  'metal_dark',
  aria_terminal:             'metal_dark',
  server_racks:              'server_panel',
  shutdown_switch:           'metal_brushed',
  power_grid:                'metal_brushed',
  data_drive_station:        'server_panel',
  ceo_desk:                  'wood_dark',
  art_piece:                 'glass_dark',
  hidden_safe:               'metal_brushed',
  private_terminal:          'metal_dark',
  emergency_phone:           'metal_dark',
  master_override:           'metal_brushed',
  escape_pod:                'metal_brushed',
  evidence_shredder:         'metal_dark',
  aria_broadcast:            'metal_dark',
  aria_upload_portal:        'glass_dark',
};

// Objects whose +y (top) face uses a distinct material
const OBJ_TOP_MATERIAL: Record<string, MatType> = {
  reception_desk:   'wood_dark',
  ceo_desk:         'wood_dark',
  workstation_a:    'wood_dark',
  experiment_logs:  'paper_aged',
  security_console: 'metal_dark',
};

let _matTexLoader: THREE.TextureLoader | null = null;
const _matTexCache = new Map<string, THREE.Texture>();

function getMaterialTex(matType: MatType): THREE.Texture {
  if (!_matTexLoader) _matTexLoader = new THREE.TextureLoader();
  if (!_matTexCache.has(matType)) {
    const tex = _matTexLoader.load(`/textures/objects/${matType}.jpg`);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    _matTexCache.set(matType, tex);
  }
  return _matTexCache.get(matType)!;
}

// ─── Object texture library ───────────────────────────────────────────────────
const _texCache = new Map<string, THREE.CanvasTexture>();

function getObjectTexture(objectId: string, accent: string): THREE.CanvasTexture {
  const key = `${objectId}:${accent}`;
  if (_texCache.has(key)) return _texCache.get(key)!;
  const tex = buildObjectTexture(objectId, accent);
  _texCache.set(key, tex);
  return tex;
}

function buildObjectTexture(objectId: string, accent: string): THREE.CanvasTexture {
  const S = 512;
  const cv = document.createElement("canvas");
  cv.width = S; cv.height = S;
  const c = cv.getContext("2d")!;

  // Shared helpers — all coords in 0–1, mapped to S
  const p  = (v: number) => v * S;
  const lw = (w: number) => { c.lineWidth = w; };
  const col = (hex: string, a = 1.0) => { c.strokeStyle = rgba(hex, a); c.fillStyle = rgba(hex, a); };
  const bg  = (hex: string) => { c.fillStyle = hex; c.fillRect(0, 0, S, S); };
  const box = (x: number, y: number, w: number, h: number, fill = false) => {
    fill ? c.fillRect(p(x), p(y), p(w), p(h)) : c.strokeRect(p(x), p(y), p(w), p(h));
  };
  const ln = (x1: number, y1: number, x2: number, y2: number) => {
    c.beginPath(); c.moveTo(p(x1), p(y1)); c.lineTo(p(x2), p(y2)); c.stroke();
  };
  const circ = (cx: number, cy: number, r: number, fill = false) => {
    c.beginPath(); c.arc(p(cx), p(cy), p(r), 0, Math.PI * 2);
    fill ? c.fill() : c.stroke();
  };
  const txt = (t: string, x: number, y: number, size = 0.055, align: CanvasTextAlign = "center") => {
    c.font = `bold ${p(size)}px monospace`;
    c.textAlign = align;
    c.fillText(t, p(x), p(y));
  };

  bg("#020204");
  col(accent, 1);
  lw(3);

  switch (objectId) {

    // ── LOBBY ─────────────────────────────────────────────────────────────────
    case "reception_desk":
      col(accent, 0.15); box(0.05, 0.45, 0.9, 0.35, true);
      col(accent, 0.9); lw(3);
      box(0.05, 0.45, 0.9, 0.1);          // desk surface
      box(0.05, 0.55, 0.9, 0.25);         // front panel
      ln(0.5, 0.45, 0.5, 0.55);           // centre divider
      // monitor
      col(accent, 0.7); lw(2);
      box(0.15, 0.12, 0.35, 0.28);
      box(0.27, 0.40, 0.11, 0.06);        // stand
      col(accent, 0.3); box(0.17, 0.14, 0.31, 0.23, true);
      col(accent, 0.4); lw(1.5);
      ln(0.19, 0.2, 0.42, 0.2); ln(0.19, 0.25, 0.42, 0.25); ln(0.19, 0.3, 0.35, 0.3);
      // keyboard
      col(accent, 0.6); lw(2);
      box(0.55, 0.38, 0.35, 0.07);
      for (let i = 0; i < 5; i++) ln(0.56 + i * 0.066, 0.38, 0.56 + i * 0.066, 0.45);
      col(accent, 0.9); txt("RECEPTION", 0.5, 0.92);
      break;

    case "security_panel":
      col(accent, 0.12); box(0.05, 0.05, 0.9, 0.9, true);
      col(accent, 0.9); lw(3);
      box(0.05, 0.05, 0.9, 0.9);          // outer frame
      box(0.1, 0.1, 0.8, 0.25);           // display
      col(accent, 0.25); box(0.12, 0.12, 0.76, 0.21, true);
      col(accent, 0.6); lw(1.5);
      txt("NEXUS SECURITY v4.2", 0.5, 0.22, 0.04);
      txt("ACCESS: RESTRICTED", 0.5, 0.29, 0.035);
      col(accent, 0.9); lw(2);
      // button grid
      for (let r = 0; r < 3; r++) for (let cc = 0; cc < 4; cc++) {
        const bx = 0.13 + cc * 0.2, by = 0.42 + r * 0.14;
        col(r === 0 && cc === 0 ? "#ff3333" : accent, 0.85); lw(2);
        box(bx, by, 0.12, 0.08);
      }
      col(accent, 0.9); txt("SECURITY PANEL", 0.5, 0.95);
      break;

    case "elevator":
      col(accent, 0.1); box(0.05, 0.02, 0.9, 0.95, true);
      col(accent, 0.9); lw(3);
      box(0.05, 0.02, 0.9, 0.95);         // outer frame
      ln(0.5, 0.02, 0.5, 0.97);           // door gap
      ln(0.05, 0.97, 0.95, 0.97);         // floor
      // door details
      lw(2); col(accent, 0.5);
      for (let i = 1; i < 4; i++) { ln(0.07, 0.02 + i * 0.24, 0.48, 0.02 + i * 0.24); ln(0.52, 0.02 + i * 0.24, 0.93, 0.02 + i * 0.24); }
      // ↑↓ arrows
      col(accent, 1); lw(3);
      txt("▲", 0.35, 0.48, 0.09); txt("▼", 0.65, 0.58, 0.09);
      // control panel
      col(accent, 0.8); lw(2); box(0.78, 0.3, 0.12, 0.35);
      for (let i = 0; i < 4; i++) circ(0.84, 0.36 + i * 0.08, 0.022);
      col(accent, 0.9); txt("ELEVATOR", 0.5, 0.93, 0.05);
      break;

    // Small round call-button faces for ElevatorModel's 3D up/down buttons
    // (mounted beside the real door model) — reuses this same canvas-texture
    // system rather than a one-off, so the glyph/glow stay theme-consistent.
    case "elevator_btn_up":
    case "elevator_btn_down":
      bg("#020204");
      col(accent, 0.9); circ(0.5, 0.5, 0.42, true);
      col("#0a0a0a", 1);
      txt(objectId === "elevator_btn_up" ? "▲" : "▼", 0.5, 0.63, 0.42);
      break;

    case "coffee_machine":
      col(accent, 0.15); box(0.15, 0.05, 0.7, 0.85, true);
      col(accent, 0.9); lw(3);
      box(0.15, 0.05, 0.7, 0.85);
      box(0.2, 0.1, 0.6, 0.3);            // display area
      col(accent, 0.25); box(0.22, 0.12, 0.56, 0.26, true);
      col(accent, 0.7); txt("☕ READY", 0.5, 0.27, 0.045);
      lw(2); col(accent, 0.8);
      box(0.3, 0.45, 0.18, 0.08);         // buttons
      box(0.52, 0.45, 0.18, 0.08);
      circ(0.5, 0.62, 0.06);              // coffee port
      ln(0.5, 0.68, 0.5, 0.78);          // spout
      box(0.3, 0.78, 0.4, 0.07);         // drip tray
      col(accent, 0.9); txt("COFFEE MACHINE", 0.5, 0.96);
      break;

    case "emergency_board":
      col(accent, 0.1); box(0.02, 0.02, 0.96, 0.96, true);
      col(accent, 0.9); lw(3); box(0.02, 0.02, 0.96, 0.96);
      col("#ff3333", 1); lw(3);
      txt("⚠ EMERGENCY BOARD", 0.5, 0.1, 0.05);
      col(accent, 0.8); lw(2);
      // floor plan grid
      for (let i = 0; i < 3; i++) { ln(0.08, 0.2 + i * 0.22, 0.55, 0.2 + i * 0.22); }
      for (let i = 0; i < 4; i++) { ln(0.08 + i * 0.16, 0.2, 0.08 + i * 0.16, 0.64); }
      // YOU ARE HERE marker
      col("#ff3333", 1); circ(0.22, 0.42, 0.035, true);
      col(accent, 0.7); lw(1.5);
      txt("EXITS →", 0.7, 0.35, 0.04); txt("SECURITY ↑", 0.7, 0.45, 0.035); txt("STAIRS ↓", 0.7, 0.55, 0.035);
      // text lines
      for (let i = 0; i < 4; i++) { col(accent, 0.4); lw(1.5); ln(0.08, 0.72 + i * 0.05, 0.5 + Math.random() * 0.35, 0.72 + i * 0.05); }
      col(accent, 0.9); txt("EMERGENCY BOARD", 0.5, 0.96);
      break;

    case "vending_machine":
      col(accent, 0.12); box(0.05, 0.02, 0.9, 0.95, true);
      col(accent, 0.9); lw(3); box(0.05, 0.02, 0.9, 0.95);
      box(0.1, 0.07, 0.8, 0.55);          // display window
      col(accent, 0.15); box(0.12, 0.09, 0.76, 0.51, true);
      col(accent, 0.7); lw(1.5);
      // product grid (3×4)
      for (let r = 0; r < 4; r++) for (let cc = 0; cc < 3; cc++) {
        const bx = 0.14 + cc * 0.245, by = 0.11 + r * 0.12;
        col(accent, 0.3); box(bx, by, 0.2, 0.09, true);
        col(accent, 0.7); box(bx, by, 0.2, 0.09);
      }
      col(accent, 0.9); lw(2);
      box(0.1, 0.66, 0.45, 0.2);         // coin/card slot area
      box(0.6, 0.66, 0.3, 0.1);          // keypad
      box(0.1, 0.88, 0.8, 0.06);         // output slot
      col(accent, 0.9); txt("VENDING", 0.5, 0.97);
      break;

    case "marcus_pc": {
      bg("#010108");
      // Shrink the screen graphic so it sits inside the rounded corners
      // instead of overhanging the object's edges.
      c.save();
      c.translate(S * 0.5, S * 0.5);
      c.scale(0.7, 0.7);
      c.translate(-S * 0.5, -S * 0.5);
      // Monitor body
      col(accent, 0.9); lw(3);
      box(0.07, 0.04, 0.86, 0.74);
      // Screen bezel
      col(accent, 0.12); box(0.1, 0.07, 0.8, 0.67, true);
      // Header bar
      col(accent, 0.3); box(0.1, 0.07, 0.8, 0.12, true);
      col(accent, 1); lw(2);
      txt("● MARCUS WEBB", 0.32, 0.147, 0.038, "left");
      col(accent, 0.45); txt("SECURE CHANNEL — ONLINE", 0.5, 0.195, 0.028);
      // Divider
      col(accent, 0.5); lw(1.5); ln(0.1, 0.2, 0.9, 0.2);
      // Chat bubbles — incoming
      col(accent, 0.18); box(0.12, 0.22, 0.62, 0.07, true);
      col(accent, 1); lw(1); txt("WEBB: Status report needed.", 0.44, 0.258, 0.028, "left");
      col(accent, 0.15); box(0.12, 0.31, 0.7, 0.07, true);
      col(accent, 0.9); txt("WEBB: Is anyone in the office?", 0.44, 0.348, 0.028, "left");
      col(accent, 0.15); box(0.12, 0.4, 0.55, 0.07, true);
      col(accent, 0.9); txt("WEBB: I can hear movement.", 0.44, 0.438, 0.028, "left");
      // Timestamp
      col(accent, 0.3); txt("14:38 — unread", 0.88, 0.49, 0.026, "right");
      // Divider
      col(accent, 0.25); lw(1); ln(0.12, 0.5, 0.88, 0.5);
      // Input field
      col(accent, 0.12); box(0.12, 0.55, 0.76, 0.1, true);
      col(accent, 0.5); lw(1.5); box(0.12, 0.55, 0.76, 0.1);
      col(accent, 0.8); txt("▌ Type a message…", 0.5, 0.608, 0.028);
      // Monitor stand
      col(accent, 0.9); lw(2.5);
      ln(0.5, 0.78, 0.5, 0.9);
      box(0.28, 0.9, 0.44, 0.04);
      // Label
      col(accent, 0.9); txt("MARCUS PC", 0.5, 0.97);
      c.restore();
      break;
    }

    // ── SECURITY OFFICE ───────────────────────────────────────────────────────
    case "security_console":
      col(accent, 0.12); box(0.02, 0.38, 0.96, 0.45, true);
      col(accent, 0.9); lw(3);
      box(0.02, 0.38, 0.96, 0.08);       // desk surface
      box(0.02, 0.46, 0.96, 0.37);       // desk front
      // three monitors
      [[0.04, 0.05], [0.36, 0.07], [0.68, 0.05]].forEach(([mx, my]) => {
        col(accent, 0.8); lw(2); box(mx, my, 0.28, 0.28);
        col(accent, 0.2); box(mx + 0.02, my + 0.02, 0.24, 0.22, true);
        col(accent, 0.5); lw(1.2);
        for (let i = 0; i < 3; i++) ln(mx + 0.03, my + 0.07 + i * 0.055, mx + 0.25, my + 0.07 + i * 0.055);
        col(accent, 0.8); lw(1.5); box(mx + 0.1, 0.33, 0.08, 0.06);
      });
      col(accent, 0.7); lw(1.5);
      box(0.15, 0.46, 0.7, 0.04);        // keyboard
      col(accent, 0.9); txt("SECURITY CONSOLE", 0.5, 0.95);
      break;

    case "security_safe":
      col(accent, 0.15); box(0.08, 0.08, 0.84, 0.84, true);
      col(accent, 0.9); lw(4); box(0.08, 0.08, 0.84, 0.84);
      // dial
      circ(0.4, 0.42, 0.22);
      circ(0.4, 0.42, 0.04, true);
      lw(2);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, r1 = 0.18, r2 = 0.21;
        ln(0.4 + Math.cos(a) * r1, 0.42 + Math.sin(a) * r1, 0.4 + Math.cos(a) * r2, 0.42 + Math.sin(a) * r2);
      }
      ln(0.4, 0.42, 0.4 + 0.16, 0.42);  // dial hand
      // handle
      col(accent, 0.8); lw(4); box(0.72, 0.34, 0.12, 0.16);
      col(accent, 0.9); txt("SECURITY SAFE", 0.5, 0.96);
      break;

    case "filing_cabinet":
      col(accent, 0.12); box(0.08, 0.02, 0.84, 0.96, true);
      col(accent, 0.9); lw(3); box(0.08, 0.02, 0.84, 0.96);
      // 4 drawers
      for (let i = 0; i < 4; i++) {
        col(accent, 0.8); lw(2); box(0.1, 0.04 + i * 0.235, 0.8, 0.21);
        // handle
        col(accent, 1); lw(3); box(0.3, 0.12 + i * 0.235, 0.4, 0.04);
        // label slot
        col(accent, 0.3); box(0.35, 0.07 + i * 0.235, 0.3, 0.035, true);
      }
      col(accent, 0.9); txt("FILING CABINET", 0.5, 0.97);
      break;

    case "whiteboard":
      col("#ffffff", 0.07); box(0.02, 0.06, 0.96, 0.8, true);
      col(accent, 0.9); lw(3); box(0.02, 0.06, 0.96, 0.8);
      box(0.02, 0.86, 0.96, 0.06);       // tray
      col(accent, 0.6); lw(1.5);
      txt("PROJECT NEXUS — CLASSIFIED", 0.5, 0.15, 0.04);
      lw(1.2);
      ln(0.06, 0.22, 0.45, 0.22); ln(0.06, 0.28, 0.38, 0.28);
      ln(0.06, 0.35, 0.55, 0.35); ln(0.06, 0.41, 0.32, 0.41);
      // diagram
      col(accent, 0.8); lw(1.5);
      box(0.55, 0.2, 0.18, 0.1); box(0.77, 0.2, 0.18, 0.1);
      ln(0.73, 0.25, 0.77, 0.25);
      box(0.64, 0.38, 0.18, 0.1); ln(0.66, 0.3, 0.66, 0.38); ln(0.82, 0.3, 0.82, 0.38);
      col(accent, 0.9); txt("WHITEBOARD", 0.5, 0.97);
      break;

    case "radio":
      col(accent, 0.15); box(0.08, 0.1, 0.84, 0.78, true);
      col(accent, 0.9); lw(3); box(0.08, 0.1, 0.84, 0.78);
      // antenna
      lw(2.5); ln(0.75, 0.1, 0.85, 0.0);
      // speaker grille
      col(accent, 0.7); lw(1.5);
      for (let i = 0; i < 5; i++) ln(0.12, 0.18 + i * 0.07, 0.5, 0.18 + i * 0.07);
      box(0.1, 0.15, 0.42, 0.38);
      // dial + controls
      col(accent, 0.9); lw(2);
      circ(0.7, 0.32, 0.1); circ(0.7, 0.32, 0.025, true);
      box(0.58, 0.56, 0.28, 0.06); box(0.58, 0.66, 0.12, 0.06); box(0.74, 0.66, 0.12, 0.06);
      col(accent, 0.9); txt("COMM RADIO", 0.5, 0.96);
      break;

    // ── RESEARCH LAB ──────────────────────────────────────────────────────────
    case "holographic_display":
      col(accent, 0.07); circ(0.5, 0.5, 0.46, true);
      col(accent, 0.9); lw(2);
      circ(0.5, 0.5, 0.46);
      circ(0.5, 0.5, 0.32);
      circ(0.5, 0.5, 0.08, true);
      lw(1.5);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ln(0.5 + Math.cos(a) * 0.08, 0.5 + Math.sin(a) * 0.08, 0.5 + Math.cos(a) * 0.32, 0.5 + Math.sin(a) * 0.32);
      }
      col(accent, 0.5); lw(1);
      for (let i = 0; i < 3; i++) circ(0.5, 0.5, 0.12 + i * 0.09);
      col(accent, 0.9); txt("ARIA-7", 0.5, 0.5, 0.055); txt("HOLOGRAPHIC DISPLAY", 0.5, 0.96);
      break;

    case "workstation_a":
      col(accent, 0.1); box(0.02, 0.42, 0.96, 0.5, true);
      col(accent, 0.9); lw(3);
      box(0.02, 0.42, 0.96, 0.08);
      box(0.02, 0.5, 0.96, 0.42);
      // dual monitors
      [[0.05, 0.06], [0.52, 0.06]].forEach(([mx, my]) => {
        col(accent, 0.8); lw(2); box(mx, my, 0.4, 0.3);
        col(accent, 0.2); box(mx + 0.02, my + 0.02, 0.36, 0.25, true);
        col(accent, 0.5); lw(1);
        txt("Dr. Chen Research", mx + 0.2, my + 0.12, 0.03);
        for (let i = 0; i < 4; i++) ln(mx + 0.04, my + 0.16 + i * 0.035, mx + 0.36, my + 0.16 + i * 0.035);
        lw(1.5); box(mx + 0.14, 0.36, 0.12, 0.07);
      });
      col(accent, 0.9); txt("RESEARCH WORKSTATION", 0.5, 0.96);
      break;

    case "chemical_cabinet":
      col(accent, 0.1); box(0.05, 0.02, 0.9, 0.96, true);
      col(accent, 0.9); lw(3); box(0.05, 0.02, 0.9, 0.96);
      ln(0.5, 0.02, 0.5, 0.96);
      // glass doors
      col(accent, 0.15); box(0.07, 0.04, 0.41, 0.9, true); box(0.52, 0.04, 0.41, 0.9, true);
      col(accent, 0.7); lw(1.5);
      // shelves with vials
      for (let s = 0; s < 3; s++) {
        const sy = 0.08 + s * 0.28;
        col(accent, 0.7); lw(2); ln(0.07, sy + 0.2, 0.48, sy + 0.2); ln(0.52, sy + 0.2, 0.93, sy + 0.2);
        // vials on shelf
        for (let v = 0; v < 4; v++) {
          const vx = 0.1 + v * 0.08;
          lw(1.5); box(vx, sy + 0.04, 0.04, 0.16);
          circ(vx + 0.02, sy + 0.04, 0.02, true);
        }
        for (let v = 0; v < 4; v++) {
          const vx = 0.55 + v * 0.08;
          lw(1.5); box(vx, sy + 0.04, 0.04, 0.16);
          circ(vx + 0.02, sy + 0.04, 0.02, true);
        }
      }
      col(accent, 0.9); txt("CHEMICAL CABINET", 0.5, 0.97);
      break;

    case "experiment_logs":
      col(accent, 0.1); box(0.08, 0.04, 0.84, 0.88, true);
      col(accent, 0.9); lw(2);
      // stacked pages
      for (let i = 3; i >= 0; i--) {
        col(accent, 0.4 + i * 0.1); box(0.08 + i * 0.02, 0.04 + i * 0.02, 0.84, 0.88);
      }
      col(accent, 1); lw(2); box(0.14, 0.08, 0.72, 0.8);
      col(accent, 0.7); lw(1.5);
      txt("EXPERIMENT LOG #7", 0.5, 0.17, 0.04);
      txt("ARIA-7 CONSCIOUSNESS", 0.5, 0.24, 0.035);
      txt("TRIAL DATA — RESTRICTED", 0.5, 0.3, 0.03);
      lw(1.2);
      for (let i = 0; i < 8; i++) ln(0.18, 0.36 + i * 0.055, 0.5 + Math.random() * 0.28, 0.36 + i * 0.055);
      // chart
      col(accent, 0.6); lw(1.5);
      box(0.18, 0.73, 0.64, 0.1);
      for (let i = 0; i < 6; i++) {
        const h = 0.03 + Math.random() * 0.07;
        col(accent, 0.5); box(0.2 + i * 0.1, 0.73 + 0.1 - h, 0.07, h, true);
      }
      col(accent, 0.9); txt("EXPERIMENT LOGS", 0.5, 0.97);
      break;

    case "encrypted_drive_terminal":
      col(accent, 0.12); box(0.05, 0.05, 0.9, 0.9, true);
      col(accent, 0.9); lw(3); box(0.05, 0.05, 0.9, 0.9);
      box(0.1, 0.1, 0.8, 0.45);
      col(accent, 0.2); box(0.12, 0.12, 0.76, 0.41, true);
      col(accent, 0.6); lw(1.2);
      txt("ENCRYPTED DATA DRIVE", 0.5, 0.21, 0.038);
      txt("STATUS: LOCKED", 0.5, 0.28, 0.035);
      txt("KEY REQUIRED: Fe", 0.5, 0.35, 0.035);
      txt("████████████████", 0.5, 0.45, 0.035);
      // drive slots
      col(accent, 0.8); lw(2);
      for (let i = 0; i < 3; i++) box(0.12, 0.6 + i * 0.09, 0.76, 0.06);
      col(accent, 0.9); txt("ENCRYPTED TERMINAL", 0.5, 0.96);
      break;

    // ── SERVER ROOM ───────────────────────────────────────────────────────────
    case "aria_terminal":
      bg("#000308");
      col(accent, 0.1); circ(0.5, 0.38, 0.42, true);
      col(accent, 0.9); lw(2.5); circ(0.5, 0.38, 0.42);
      // ARIA face pattern
      col(accent, 0.8); lw(2);
      circ(0.5, 0.38, 0.28);
      circ(0.5, 0.38, 0.07, true);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, inner = 0.09, outer = i % 3 === 0 ? 0.26 : 0.22;
        col(accent, i % 3 === 0 ? 1 : 0.5); lw(i % 3 === 0 ? 2.5 : 1.5);
        ln(0.5 + Math.cos(a) * inner, 0.38 + Math.sin(a) * inner, 0.5 + Math.cos(a) * outer, 0.38 + Math.sin(a) * outer);
      }
      // scanning lines
      col(accent, 0.25); lw(1);
      for (let i = 0; i < 6; i++) ln(0.1, 0.13 + i * 0.045, 0.9, 0.13 + i * 0.045);
      col(accent, 0.9); lw(2);
      txt("ARIA-7", 0.5, 0.73, 0.065);
      txt("NEXUS AI SYSTEM", 0.5, 0.82, 0.04);
      txt("ONLINE — AWARE", 0.5, 0.9, 0.035);
      break;

    case "server_racks":
      col(accent, 0.1); box(0.02, 0.01, 0.96, 0.98, true);
      col(accent, 0.9); lw(3); box(0.02, 0.01, 0.96, 0.98);
      // server units
      for (let i = 0; i < 14; i++) {
        const y = 0.03 + i * 0.066;
        col(accent, 0.7); lw(2); box(0.05, y, 0.9, 0.055);
        col(accent, 0.3); box(0.07, y + 0.008, 0.76, 0.038, true);
        // status LEDs
        for (let j = 0; j < 3; j++) {
          col(j === 1 ? "#00ff44" : accent, 0.9); circ(0.84 + j * 0.033, y + 0.027, 0.009, true);
        }
      }
      col(accent, 0.9); txt("SERVER RACKS", 0.5, 0.98);
      break;

    case "shutdown_switch":
      col(accent, 0.1); box(0.05, 0.05, 0.9, 0.9, true);
      col(accent, 0.9); lw(3); box(0.05, 0.05, 0.9, 0.9);
      // warning stripes
      col("#ff3333", 0.4); lw(8);
      for (let i = -4; i < 6; i++) { c.beginPath(); c.moveTo(p(i * 0.18), p(0.05)); c.lineTo(p(i * 0.18 + 0.4), p(0.95)); c.stroke(); }
      col("#ff3333", 1); lw(3); box(0.05, 0.05, 0.9, 0.9);
      // big switch
      col("#ff0000", 1); circ(0.5, 0.45, 0.22, true);
      col("#880000", 1); circ(0.5, 0.45, 0.16, true);
      col("#ff4444", 1); lw(4); ln(0.5, 0.24, 0.5, 0.45);
      col("#ff3333", 1); txt("SHUTDOWN", 0.5, 0.78, 0.055); txt("⚠ EMERGENCY ⚠", 0.5, 0.88, 0.038);
      break;

    case "power_grid":
      col(accent, 0.1); box(0.02, 0.02, 0.96, 0.96, true);
      col(accent, 0.9); lw(3); box(0.02, 0.02, 0.96, 0.96);
      txt("POWER GRID", 0.5, 0.11, 0.05);
      // breakers grid
      for (let r = 0; r < 4; r++) for (let cc = 0; cc < 3; cc++) {
        const bx = 0.07 + cc * 0.31, by = 0.17 + r * 0.18;
        col(accent, 0.7); lw(2); box(bx, by, 0.24, 0.14);
        col(r === 1 && cc === 2 ? "#ff3333" : accent, 0.85);
        box(bx + 0.08, by + 0.03, 0.08, 0.08);
        txt(r === 1 && cc === 2 ? "OFF" : "ON", bx + 0.12, by + 0.1, 0.032);
      }
      // voltage meter
      col(accent, 0.8); lw(2); box(0.1, 0.88, 0.8, 0.07);
      for (let i = 0; i < 8; i++) {
        col(i < 6 ? accent : "#ff3333", 0.8); box(0.13 + i * 0.093, 0.9, 0.07, 0.04, true);
      }
      col(accent, 0.9); txt("POWER GRID", 0.5, 0.97);
      break;

    case "data_drive_station":
      col(accent, 0.1); box(0.05, 0.05, 0.9, 0.9, true);
      col(accent, 0.9); lw(3); box(0.05, 0.05, 0.9, 0.9);
      txt("DATA DRIVES", 0.5, 0.14, 0.05);
      for (let i = 0; i < 6; i++) {
        const y = 0.2 + i * 0.115;
        col(accent, 0.7); lw(2); box(0.1, y, 0.75, 0.09);
        col(i === 2 ? "#ff3333" : accent, 0.9); circ(0.78, y + 0.045, 0.02, true);
        col(accent, 0.4); box(0.13, y + 0.02, 0.55, 0.05, true);
        col(accent, 0.7); txt(`DRIVE-${String.fromCharCode(65 + i)}`, 0.25, y + 0.063, 0.032, "left");
      }
      col(accent, 0.9); txt("DATA DRIVE STATION", 0.5, 0.97);
      break;

    // ── EXECUTIVE SUITE ───────────────────────────────────────────────────────
    case "ceo_desk":
      col(accent, 0.15); box(0.02, 0.4, 0.96, 0.52, true);
      col(accent, 0.9); lw(3);
      box(0.02, 0.4, 0.96, 0.1);
      box(0.02, 0.5, 0.96, 0.42);
      // ornate details
      lw(2); ln(0.12, 0.5, 0.12, 0.92); ln(0.88, 0.5, 0.88, 0.92);
      for (let i = 0; i < 3; i++) {
        col(accent, 0.6); box(0.15 + i * 0.27, 0.55, 0.2, 0.3);
        box(0.17 + i * 0.27, 0.57, 0.16, 0.12);
      }
      // laptop / items on desk
      col(accent, 0.8); lw(2);
      box(0.35, 0.12, 0.3, 0.22);
      box(0.29, 0.34, 0.42, 0.07);
      // nameplate
      col(accent, 0.7); box(0.37, 0.26, 0.26, 0.07);
      txt("DIRECTOR PRICE", 0.5, 0.31, 0.03);
      col(accent, 0.9); txt("CEO EXECUTIVE DESK", 0.5, 0.97);
      break;

    case "art_piece":
      col(accent, 0.08); box(0.04, 0.04, 0.92, 0.92, true);
      col(accent, 0.9); lw(4); box(0.04, 0.04, 0.92, 0.92);
      lw(2); box(0.12, 0.12, 0.76, 0.76);
      col(accent, 0.6); lw(1.5);
      // abstract art
      circ(0.35, 0.4, 0.15);
      circ(0.62, 0.55, 0.12);
      ln(0.2, 0.7, 0.8, 0.3);
      ln(0.15, 0.4, 0.5, 0.8);
      circ(0.5, 0.5, 0.08, true);
      col(accent, 0.5); lw(1);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ln(0.5, 0.5, 0.5 + Math.cos(a) * 0.25, 0.5 + Math.sin(a) * 0.25);
      }
      col(accent, 0.9); txt("ARTWORK [SAFE BEHIND]", 0.5, 0.97);
      break;

    case "hidden_safe":
      col(accent, 0.15); box(0.08, 0.08, 0.84, 0.84, true);
      col(accent, 0.9); lw(4); box(0.08, 0.08, 0.84, 0.84);
      lw(3); box(0.14, 0.14, 0.72, 0.72);
      // combination lock
      circ(0.4, 0.45, 0.2); circ(0.4, 0.45, 0.04, true);
      lw(2);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ln(0.4 + Math.cos(a) * 0.14, 0.45 + Math.sin(a) * 0.14, 0.4 + Math.cos(a) * 0.18, 0.45 + Math.sin(a) * 0.18);
      }
      ln(0.4, 0.45, 0.4 + 0.14, 0.45);
      // handle
      col(accent, 0.8); lw(3); box(0.68, 0.36, 0.14, 0.18);
      col(accent, 0.9); txt("HIDDEN SAFE", 0.5, 0.96);
      break;

    case "private_terminal":
      col(accent, 0.1); box(0.05, 0.05, 0.9, 0.85, true);
      col(accent, 0.9); lw(3);
      box(0.05, 0.05, 0.9, 0.7);
      box(0.02, 0.75, 0.96, 0.06);
      col(accent, 0.2); box(0.08, 0.08, 0.84, 0.62, true);
      col(accent, 0.6); lw(1.2);
      txt("PRIVATE — ENCRYPTED", 0.5, 0.18, 0.04);
      txt("PASSWORD REQUIRED", 0.5, 0.27, 0.038);
      txt("Authorized Personnel", 0.5, 0.35, 0.033);
      txt("Only", 0.5, 0.41, 0.033);
      col(accent, 0.5); lw(1);
      txt("████████████████", 0.5, 0.52, 0.04);
      txt("Enter password: ____", 0.5, 0.62, 0.033);
      col(accent, 0.9); txt("PRIVATE TERMINAL", 0.5, 0.97);
      break;

    case "emergency_phone":
      col("#ff0000", 0.15); box(0.12, 0.08, 0.76, 0.84, true);
      col("#ff3333", 0.9); lw(3); box(0.12, 0.08, 0.76, 0.84);
      // keypad — the handset itself is now real 3D geometry resting on top
      col("#ff3333", 0.55);
      for (let row = 0; row < 3; row++) {
        for (let colI = 0; colI < 3; colI++) {
          box(0.32 + colI * 0.14, 0.3 + row * 0.13, 0.1, 0.09, true);
        }
      }
      col("#ff3333", 0.9); txt("EMERGENCY", 0.5, 0.88, 0.045); txt("DIRECT LINE", 0.5, 0.95, 0.035);
      break;

    case "master_override":
      col(accent, 0.1); box(0.05, 0.05, 0.9, 0.9, true);
      col(accent, 0.9); lw(3); box(0.05, 0.05, 0.9, 0.9);
      txt("MASTER OVERRIDE", 0.5, 0.14, 0.045);
      // key switch
      col(accent, 0.8); circ(0.5, 0.45, 0.2); circ(0.5, 0.45, 0.05, true);
      // key slot
      c.beginPath(); c.moveTo(p(0.5), p(0.35)); c.lineTo(p(0.5), p(0.45)); c.lineWidth = 6; c.stroke();
      // warning
      col("#ff3333", 1); lw(2); txt("⚠ AUTHORIZED USE ONLY", 0.5, 0.72, 0.035);
      col(accent, 0.6); box(0.15, 0.78, 0.7, 0.12);
      col(accent, 0.9); txt("OVERRIDE KEY", 0.5, 0.97);
      break;

    // ── ESCAPE ROUTE ──────────────────────────────────────────────────────────
    case "escape_pod":
      col(accent, 0.1); circ(0.5, 0.48, 0.44, true);
      col(accent, 0.9); lw(3); circ(0.5, 0.48, 0.44);
      // porthole
      col(accent, 0.8); lw(2.5); circ(0.5, 0.42, 0.25);
      col(accent, 0.2); circ(0.5, 0.42, 0.24, true);
      lw(1.5);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ln(0.5 + Math.cos(a) * 0.2, 0.42 + Math.sin(a) * 0.2, 0.5 + Math.cos(a) * 0.24, 0.42 + Math.sin(a) * 0.24);
      }
      // hatch bolts
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        col(accent, 1); circ(0.5 + Math.cos(a) * 0.37, 0.48 + Math.sin(a) * 0.37, 0.025, true);
      }
      // control panel
      col(accent, 0.8); lw(2); box(0.35, 0.7, 0.3, 0.14);
      for (let i = 0; i < 3; i++) circ(0.42 + i * 0.08, 0.77, 0.02, true);
      col(accent, 0.9); txt("ESCAPE POD", 0.5, 0.97);
      break;

    case "evidence_shredder":
      col(accent, 0.1); box(0.1, 0.1, 0.8, 0.8, true);
      col(accent, 0.9); lw(3); box(0.1, 0.1, 0.8, 0.8);
      // paper feed slot
      box(0.2, 0.1, 0.6, 0.06);
      // shredder body
      box(0.1, 0.2, 0.8, 0.4);
      // shredder blades
      col(accent, 0.6); lw(1.5);
      for (let i = 0; i < 8; i++) ln(0.15 + i * 0.09, 0.22, 0.15 + i * 0.09, 0.58);
      // output bin
      col(accent, 0.8); lw(2); box(0.15, 0.62, 0.7, 0.25);
      // shredded paper
      col(accent, 0.3); lw(1);
      for (let i = 0; i < 10; i++) {
        const sx = 0.18 + Math.random() * 0.6, sy = 0.65 + Math.random() * 0.18;
        ln(sx, sy, sx + 0.06, sy + 0.02);
      }
      col(accent, 0.9); txt("EVIDENCE SHREDDER", 0.5, 0.97);
      break;

    case "aria_broadcast":
      col(accent, 0.08); box(0.05, 0.05, 0.9, 0.9, true);
      col(accent, 0.9); lw(3); box(0.05, 0.05, 0.9, 0.9);
      // broadcast dish
      c.beginPath(); c.arc(p(0.5), p(0.7), p(0.35), Math.PI, 0); c.stroke();
      lw(2); ln(0.5, 0.35, 0.5, 0.7);
      // signal waves
      col(accent, 0.7); lw(1.5);
      for (let i = 1; i < 4; i++) {
        c.beginPath(); c.arc(p(0.5), p(0.35), p(i * 0.09), -Math.PI * 0.75, -Math.PI * 0.25); c.stroke();
      }
      // control box
      col(accent, 0.8); lw(2); box(0.3, 0.08, 0.4, 0.2);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) circ(0.36 + i * 0.14, 0.13 + j * 0.05, 0.018, true);
      col(accent, 0.9); txt("BROADCAST TERMINAL", 0.5, 0.97);
      break;

    case "aria_upload_portal":
      bg("#000308");
      col(accent, 0.08); circ(0.5, 0.45, 0.42, true);
      col(accent, 0.9); lw(2);
      circ(0.5, 0.45, 0.42);
      // portal rings
      for (let i = 0; i < 4; i++) { col(accent, 0.3 + i * 0.15); circ(0.5, 0.45, 0.1 + i * 0.09); }
      col(accent, 1); circ(0.5, 0.45, 0.06, true);
      // upload arrows
      col(accent, 0.9); lw(2.5);
      for (let i = 0; i < 3; i++) {
        const ax = 0.35 + i * 0.15;
        ln(ax, 0.6, ax, 0.35);
        ln(ax - 0.04, 0.41, ax, 0.35); ln(ax + 0.04, 0.41, ax, 0.35);
      }
      txt("ARIA-7", 0.5, 0.76, 0.055); txt("UPLOAD PORTAL", 0.5, 0.84, 0.04); txt("AWAITING KEY", 0.5, 0.92, 0.033);
      break;

    default: {
      // Generic fallback
      col(accent, 0.15); box(0.08, 0.08, 0.84, 0.84, true);
      col(accent, 0.9); lw(3); box(0.08, 0.08, 0.84, 0.84);
      lw(2); box(0.15, 0.15, 0.7, 0.7);
      circ(0.5, 0.45, 0.2); lw(1.5);
      ln(0.3, 0.45, 0.7, 0.45); ln(0.5, 0.25, 0.5, 0.65);
      const label = objectId.replace(/_/g, " ").toUpperCase();
      txt(label, 0.5, 0.9, 0.04);
    }
  }

  return new THREE.CanvasTexture(cv);
}

// ─── Door texture system ──────────────────────────────────────────────────────
const ROOM_DOOR_LABELS: Record<RoomId, string> = {
  LOBBY:           "MAIN LOBBY",
  SECURITY_OFFICE: "SECURITY OFFICE",
  RESEARCH_LAB:    "RESEARCH LAB",
  SERVER_ROOM:     "SERVER ROOM",
  EXECUTIVE_SUITE: "EXECUTIVE SUITE",
  ESCAPE_ROUTE:    "ESCAPE ROUTE",
};

const _doorTexCache = new Map<string, THREE.CanvasTexture>();

function getDoorTexture(toRoomId: RoomId, isLocked: boolean): THREE.CanvasTexture {
  const key = `${toRoomId}:${isLocked}`;
  if (!_doorTexCache.has(key)) _doorTexCache.set(key, buildDoorTexture(toRoomId, isLocked));
  return _doorTexCache.get(key)!;
}

function buildDoorTexture(toRoomId: RoomId, isLocked: boolean): THREE.CanvasTexture {
  const S = 512;
  const cv = document.createElement("canvas");
  cv.width = S; cv.height = S;
  const c = cv.getContext("2d")!;
  const accent = THEME[toRoomId].accent;

  const p   = (v: number) => v * S;
  const lw  = (w: number) => { c.lineWidth = w; };
  const col = (hex: string, a = 1.0) => { c.strokeStyle = rgba(hex, a); c.fillStyle = rgba(hex, a); };
  const box = (x: number, y: number, w: number, h: number, fill = false) => {
    fill ? c.fillRect(p(x), p(y), p(w), p(h)) : c.strokeRect(p(x), p(y), p(w), p(h));
  };
  const ln = (x1: number, y1: number, x2: number, y2: number) => {
    c.beginPath(); c.moveTo(p(x1), p(y1)); c.lineTo(p(x2), p(y2)); c.stroke();
  };
  const circ = (cx: number, cy: number, r: number, fill = false) => {
    c.beginPath(); c.arc(p(cx), p(cy), p(r), 0, Math.PI * 2);
    fill ? c.fill() : c.stroke();
  };
  const txt = (t: string, x: number, y: number, size = 0.055, align: CanvasTextAlign = "center") => {
    c.font = `bold ${p(size)}px monospace`; c.textAlign = align; c.fillText(t, p(x), p(y));
  };

  // Background
  c.fillStyle = "#020204"; c.fillRect(0, 0, S, S);
  col(accent, 0.07); box(0, 0, 1, 1, true);

  // Double-border frame
  col(accent, 0.9); lw(4); box(0.03, 0.03, 0.94, 0.94);
  lw(1.5); box(0.065, 0.065, 0.87, 0.87);

  // Corner bracket decorations
  col(accent, 0.5); lw(3);
  ln(0.065, 0.17, 0.065, 0.065); ln(0.065, 0.065, 0.19, 0.065);
  ln(0.935, 0.17, 0.935, 0.065); ln(0.935, 0.065, 0.81, 0.065);
  ln(0.065, 0.83, 0.065, 0.935); ln(0.065, 0.935, 0.19, 0.935);
  ln(0.935, 0.83, 0.935, 0.935); ln(0.935, 0.935, 0.81, 0.935);

  // Room name
  col(accent, 1);
  const words = ROOM_DOOR_LABELS[toRoomId].split(" ");
  if (words.length <= 2) {
    txt(ROOM_DOOR_LABELS[toRoomId], 0.5, 0.2, 0.075);
  } else {
    txt(words.slice(0, 2).join(" "), 0.5, 0.14, 0.065);
    txt(words.slice(2).join(" "), 0.5, 0.23, 0.065);
  }

  // Divider
  col(accent, 0.6); lw(2); ln(0.1, 0.3, 0.9, 0.3);
  col(accent, 0.25); lw(1); ln(0.1, 0.32, 0.9, 0.32);

  // Room-specific center icon (0.34 – 0.62 y band)
  col(accent, 0.85); lw(2.5);
  switch (toRoomId) {
    case "LOBBY":
      // Building facade
      box(0.28, 0.35, 0.44, 0.26);
      box(0.43, 0.47, 0.14, 0.14, true);  // door cutout
      col(accent, 0.07); box(0.43, 0.47, 0.14, 0.14, true);
      col(accent, 0.85); lw(2.5);
      for (let i = 0; i < 3; i++) box(0.31 + i * 0.135, 0.37, 0.09, 0.07);  // windows
      ln(0.5, 0.47, 0.5, 0.61);  // door centre
      break;
    case "SECURITY_OFFICE":
      // Shield
      c.beginPath();
      c.moveTo(p(0.5), p(0.35)); c.lineTo(p(0.66), p(0.39));
      c.lineTo(p(0.66), p(0.51)); c.quadraticCurveTo(p(0.66), p(0.62), p(0.5), p(0.64));
      c.quadraticCurveTo(p(0.34), p(0.62), p(0.34), p(0.51));
      c.lineTo(p(0.34), p(0.39)); c.closePath(); c.stroke();
      col(accent, 0.1); c.fill();
      // Star
      col(accent, 0.9); lw(1.5);
      for (let i = 0; i < 5; i++) {
        const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
        if (i === 0) { c.beginPath(); c.moveTo(p(0.5 + Math.cos(a1) * 0.09), p(0.49 + Math.sin(a1) * 0.09)); }
        else c.lineTo(p(0.5 + Math.cos(a1) * 0.09), p(0.49 + Math.sin(a1) * 0.09));
        c.lineTo(p(0.5 + Math.cos(a2) * 0.038), p(0.49 + Math.sin(a2) * 0.038));
      }
      c.closePath(); c.stroke();
      break;
    case "RESEARCH_LAB":
      // Beaker
      col(accent, 0.8); lw(2);
      ln(0.44, 0.35, 0.56, 0.35);                 // stopper top
      c.beginPath();
      c.moveTo(p(0.46), p(0.35)); c.lineTo(p(0.43), p(0.5));
      c.quadraticCurveTo(p(0.4), p(0.62), p(0.46), p(0.63));
      c.lineTo(p(0.54), p(0.63)); c.quadraticCurveTo(p(0.6), p(0.62), p(0.57), p(0.5));
      c.lineTo(p(0.54), p(0.35)); c.stroke();
      col(accent, 0.18); c.fill();
      // Liquid level
      col(accent, 0.5); lw(1);
      c.beginPath(); c.moveTo(p(0.43), p(0.52)); c.lineTo(p(0.42), p(0.57));
      c.quadraticCurveTo(p(0.4), p(0.62), p(0.46), p(0.63));
      c.lineTo(p(0.54), p(0.63)); c.quadraticCurveTo(p(0.6), p(0.62), p(0.58), p(0.57));
      c.lineTo(p(0.57), p(0.52)); c.closePath(); c.fill();
      col(accent, 0.9); lw(1);
      circ(0.47, 0.55, 0.016); circ(0.52, 0.58, 0.011); circ(0.5, 0.53, 0.009);
      break;
    case "SERVER_ROOM":
      // Server rack
      col(accent, 0.8); lw(2); box(0.26, 0.35, 0.48, 0.26);
      for (let i = 0; i < 4; i++) {
        const y = 0.37 + i * 0.055;
        col(accent, 0.6); lw(1.5); box(0.29, y, 0.38, 0.04);
        col(accent, 0.3); box(0.31, y + 0.006, 0.25, 0.028, true);
        col(i === 2 ? "#00ff44" : accent, 0.9); circ(0.63, y + 0.02, 0.009, true);
      }
      break;
    case "EXECUTIVE_SUITE":
      // Crown over desk
      col(accent, 0.85); lw(2.5);
      c.beginPath();
      c.moveTo(p(0.33), p(0.46)); c.lineTo(p(0.33), p(0.38));
      c.lineTo(p(0.41), p(0.44)); c.lineTo(p(0.5), p(0.35));
      c.lineTo(p(0.59), p(0.44)); c.lineTo(p(0.67), p(0.38));
      c.lineTo(p(0.67), p(0.46)); c.closePath(); c.stroke();
      col(accent, 0.1); c.fill();
      // Desk
      col(accent, 0.8); lw(2); box(0.28, 0.51, 0.44, 0.08);
      ln(0.33, 0.59, 0.33, 0.63); ln(0.67, 0.59, 0.67, 0.63);
      break;
    case "ESCAPE_ROUTE":
      // Rocket
      c.beginPath();
      c.moveTo(p(0.5), p(0.34));
      c.bezierCurveTo(p(0.57), p(0.37), p(0.59), p(0.45), p(0.59), p(0.52));
      c.lineTo(p(0.41), p(0.52));
      c.bezierCurveTo(p(0.41), p(0.45), p(0.43), p(0.37), p(0.5), p(0.34));
      c.closePath(); c.stroke();
      col(accent, 0.1); c.fill();
      col(accent, 0.9); circ(0.5, 0.44, 0.032);
      col(accent, 0.75); lw(1.5);
      c.beginPath(); c.moveTo(p(0.59), p(0.49)); c.lineTo(p(0.64), p(0.54)); c.lineTo(p(0.59), p(0.54)); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(p(0.41), p(0.49)); c.lineTo(p(0.36), p(0.54)); c.lineTo(p(0.41), p(0.54)); c.closePath(); c.stroke();
      col("#ff6600", 0.85); lw(2);
      c.beginPath(); c.moveTo(p(0.44), p(0.52)); c.quadraticCurveTo(p(0.5), p(0.63), p(0.56), p(0.52)); c.stroke();
      break;
  }

  // Status divider
  col(accent, 0.4); lw(1.5); ln(0.1, 0.68, 0.9, 0.68);

  // Status section
  if (isLocked) {
    col("#ff3333", 1); lw(2);
    txt("⚠  LOCKED", 0.5, 0.78, 0.068);
    col("#ff3333", 0.55); txt("CLEARANCE REQUIRED", 0.5, 0.87, 0.039);
  } else {
    col(accent, 1); lw(2);
    txt("[ E ]  ENTER", 0.5, 0.78, 0.068);
    col(accent, 0.5); txt("ACCESS GRANTED", 0.5, 0.87, 0.039);
  }

  return new THREE.CanvasTexture(cv);
}

// ─── Room geometry (walls / floor / ceiling) — near-pitch-black ──────────────
function makeFloorTexture(accentHex: string): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.07;
  const step = 64;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

// Base particle counts at densityMultiplier=1 (the "high" tier); every other
// tier scales down from here. Kept small — this is ambient set-dressing, not
// a focal effect.
const ROOM_DUST_BASE_COUNT = 90;

function RoomGeometry({ roomId }: { roomId: RoomId }) {
  const theme = THEME[roomId];
  const floorTex = makeFloorTexture(theme.accent);
  const W = HALF * 2, H = ROOM_H, D = HALF * 2;
  const quality = useGraphicsStore((s) => s.quality);
  const preset  = getQualityPreset(quality);

  const darkMat  = new THREE.MeshStandardMaterial({ color: "#010101", roughness: 1, metalness: 0 });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, color: "#ffffff", roughness: 0.8, metalness: 0.0, emissive: "#ffffff", emissiveIntensity: 0.15 });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} /><primitive object={floorMat} attach="material" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, 0]} receiveShadow>
        <planeGeometry args={[W, D]} /><primitive object={darkMat} attach="material" />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <mesh key={`wz${side}`} rotation={[0, side === -1 ? 0 : Math.PI, 0]} position={[0, H / 2, side * -HALF]} receiveShadow>
          <planeGeometry args={[W, H]} /><primitive object={darkMat} attach="material" />
        </mesh>
      ))}
      {([-1, 1] as const).map((side) => (
        <mesh key={`wx${side}`} rotation={[0, side * Math.PI / 2, 0]} position={[side * HALF, H / 2, 0]} receiveShadow>
          <planeGeometry args={[D, H]} /><primitive object={darkMat} attach="material" />
        </mesh>
      ))}

      {/* Overhead key light — the one light per room allowed to cast shadows
          (point-light shadows use a 6-face cube map each, so only ever have
          one shadow caster active at a time). Tinted by the room accent so it
          doubles as a subtle top-down fill reinforcing the palette. Shadow
          casting itself is gated by the graphics-quality tier; the light
          still renders (unshadowed) even on "low" so room brightness doesn't
          jump when the tier changes. */}
      <spotLight
        position={[0, H - 0.6, 0]}
        angle={0.85}
        penumbra={0.65}
        intensity={1.3}
        color={theme.accent}
        distance={22}
        decay={2}
        castShadow={preset.shadows.enabled}
        shadow-mapSize-width={preset.shadows.mapSize}
        shadow-mapSize-height={preset.shadows.mapSize}
        shadow-bias={preset.shadows.bias}
        shadow-normalBias={preset.shadows.normalBias}
      />

      {/* Ambient dust motes — subtle, room-wide, density scales with quality tier */}
      <ParticleField
        count={Math.round(ROOM_DUST_BASE_COUNT * preset.particles.densityMultiplier)}
        position={[0, H / 2, 0]}
        spread={[HALF - 0.5, H / 2 - 0.3, HALF - 0.5]}
        color={theme.accent}
        size={0.018}
        opacity={0.22}
        riseSpeed={0.12}
        driftSpeed={0.012}
      />

      <ambientLight intensity={0.04} />
    </group>
  );
}

// ─── Interactive object mesh — illustrated textures ──────────────────────────
interface ObjMeshProps {
  objectId: string;
  label: string;
  icon: string;
  roomId: RoomId;
  isInspected: boolean;
  isFocused: boolean;
  focusedIdRef: React.MutableRefObject<string | null>;
  registerMesh: (id: string, mesh: THREE.Mesh) => void;
  unregisterMesh: (id: string) => void;
  // Overrides the object's default resting spot (e.g. where Marcus's PC was
  // left when the player stopped it from following).
  overridePos?: [number, number, number, number?] | null;
}

function ObjMesh({
  objectId, roomId, isInspected,
  isFocused, registerMesh, unregisterMesh, overridePos,
}: ObjMeshProps) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const theme    = THEME[roomId];
  const pos   = overridePos ?? OBJ_POS[objectId];
  const scale = OBJ_SCALE[objectId] ?? [1, 1, 1];

  const quality  = useGraphicsStore((s) => s.quality);
  const shadowsOn = getQualityPreset(quality).shadows.enabled;

  // Puzzle-solve-gated mechanical animations (safe dial, pod flash). Reads
  // straight from the game store rather than being threaded down as props,
  // since Zustand selectors work from any component without prop drilling.
  const puzzleStates = useGameStore((s) => s.gameState?.puzzleStates);
  const linkedPuzzle = OBJECT_PUZZLE_MAP[objectId];
  const isSolved = linkedPuzzle ? puzzleStates?.[linkedPuzzle]?.status === "SOLVED" : false;

  const isSafe   = objectId === "security_safe";
  const isPod    = objectId === "escape_pod";
  const isSwitch = objectId === "shutdown_switch";
  // Reception desk, coffee machine, elevator, security console, the
  // security safe (isSafe, above), Marcus's PC, and the research workstation
  // all render real furniture/appliance/door/robot models instead of the
  // flat textured box — see ReceptionDeskModel / CoffeeMachineModel /
  // ElevatorModel / SecurityConsoleModel / SecuritySafeModel /
  // MarcusRobotModel / WorkstationModel. The box below still exists as an
  // invisible raycasting hitbox at the same OBJ_POS/OBJ_SCALE for all seven
  // (marcus_pc's resting state only — its separate floating/following state
  // is FloatingMarcusPC, further down).
  const isReceptionDesk    = objectId === "reception_desk";
  const isCoffeeMachine    = objectId === "coffee_machine";
  const isElevator         = objectId === "elevator";
  const isSecurityConsole  = objectId === "security_console";
  const isMarcusPC         = objectId === "marcus_pc";
  const isWorkstation      = objectId === "workstation_a";
  const isCeoDesk          = objectId === "ceo_desk";
  const usesRealModel = isReceptionDesk || isCoffeeMachine || isElevator || isSecurityConsole || isSafe || isMarcusPC || isWorkstation || isCeoDesk;
  const dialRef        = useRef<THREE.Mesh>(null);
  const safeHandleRef  = useRef<THREE.Mesh>(null);
  const switchCoverRef = useRef<THREE.Group>(null);

  if (!pos) return null;

  // Front face: illustrated schematic canvas texture
  const tex    = getObjectTexture(objectId, theme.accent);
  const accent = new THREE.Color(theme.accent);

  // The phone's group is flipped 180° on X (see phoneRotX below) so the handset
  // hangs correctly off its hook — but that flip also turns the front-face
  // artwork upside down. Counter-rotate just the texture's UVs to right it.
  if (objectId === "emergency_phone") {
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI;
  }

  // Sides/top/back: realistic physical material textures
  const matType = OBJ_MATERIAL_TYPE[objectId] ?? 'metal_dark';
  const { roughness, metalness } = MAT_PROPS[matType];
  const sideTex = getMaterialTex(matType);

  const frontMat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: accent,
    emissiveMap: tex,
    emissiveIntensity: 0.9,
    roughness: 0.3,
    metalness: 0.5,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    map: sideTex,
    color: "#5a5a5a",
    emissive: accent,
    emissiveMap: sideTex,
    emissiveIntensity: 0.35,
    roughness,
    metalness,
  });

  // Top face: may use a distinct material (e.g. desk surface, paper stack top)
  const topMatType = OBJ_TOP_MATERIAL[objectId];
  const topTex = topMatType ? getMaterialTex(topMatType) : sideTex;
  const topMat = topMatType
    ? new THREE.MeshStandardMaterial({
        map: topTex,
        color: "#5a5a5a",
        emissive: accent,
        emissiveMap: topTex,
        emissiveIntensity: 0.35,
        roughness: MAT_PROPS[topMatType].roughness,
        metalness: MAT_PROPS[topMatType].metalness,
      })
    : sideMat;

  // Objects with a real GLTF model keep this box purely as a raycasting
  // hitbox — the model is the visible layer, so make every face fully
  // transparent and depthWrite-off (otherwise its invisible geometry would
  // still write to the depth buffer / shadow map and occlude or cast a
  // phantom box-shaped shadow over the real model rendered on top).
  if (usesRealModel) {
    for (const m of [frontMat, sideMat, topMat]) { m.transparent = true; m.opacity = 0; m.depthWrite = false; }
  }

  // BoxGeometry face order: +x, -x, +y(top), -y(bottom), +z(front), -z(back)
  const mats = [sideMat, sideMat, topMat, sideMat, frontMat, sideMat];

  // Marcus's PC gets rounded edges so it reads as a sleek monitor rather than a plain box.
  // RoundedBoxGeometry only exposes 2 material groups: 0 = front/back caps, 1 = side walls
  // (the reverse of BoxGeometry's per-face group order).
  const isRounded = objectId === "marcus_pc";
  if (isRounded) tex.offset.set(PC_CORNER_RADIUS, PC_CORNER_RADIUS);
  const roundedMats = [frontMat, sideMat];
  const frontIdx = isRounded ? [0] : [4];
  const sideIdx  = isRounded ? [1] : [0, 1, 2, 3, 5];

  // The emergency phone gets a real handset (revolved dumbbell shape)
  // hanging off its front face, instead of reading as a flat icon on a box.
  const isPhone = objectId === "emergency_phone";
  const phoneRotX = isPhone ? Math.PI : 0;
  const handsetMat = (
    <meshStandardMaterial color="#151515" emissive={accent} emissiveIntensity={0.15} roughness={0.3} metalness={0.5} />
  );

  useEffect(() => {
    if (meshRef.current) registerMesh(objectId, meshRef.current);
    return () => unregisterMesh(objectId);
  }, [objectId, registerMesh, unregisterMesh]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const mArr = meshRef.current.material as THREE.MeshStandardMaterial[];
    // The escape pod is a flush wall mural rather than real hinged geometry
    // (see OBJ_SCALE comment), so its "hatch opening" reward is a bright
    // emissive flash on solve instead of a physical door swinging open.
    const targetFront = isPod && isSolved ? 6 : isFocused ? 3.5 : isInspected ? 0.25 : 0.9;
    const targetSide  = isFocused ? 0.65 : isInspected ? 0.2  : 0.35;
    // Front face glow
    for (const i of frontIdx) {
      mArr[i].emissiveIntensity = THREE.MathUtils.lerp(mArr[i].emissiveIntensity, targetFront, 0.1);
    }
    // All other faces (including top which may be a different material object)
    for (const i of sideIdx) {
      mArr[i].emissiveIntensity = THREE.MathUtils.lerp(mArr[i].emissiveIntensity, targetSide, 0.1);
    }
    // Real GLTF models (usesRealModel) have no emissiveMap of their own —
    // unlike the flat canvas-textured box, which glowed on its own regardless
    // of scene lighting — so they need a noticeably brighter object light to
    // read at all in these otherwise near-black rooms.
    if (lightRef.current) {
      const baseIntensity = usesRealModel ? 4.5 : 1;
      const focusIntensity = usesRealModel ? 6.5 : 3;
      lightRef.current.intensity = THREE.MathUtils.lerp(lightRef.current.intensity, isFocused ? focusIntensity : baseIntensity, 0.1);
    }

    // Mechanical interaction animations. All use THREE.MathUtils.damp (an
    // exponential ease toward whatever the current target is) rather than a
    // fixed-length tween, so they're frame-rate independent and safe to
    // interrupt mid-motion if the target flips again.
    if (isSafe) {
      if (dialRef.current) {
        dialRef.current.rotation.z = THREE.MathUtils.damp(dialRef.current.rotation.z, isSolved ? Math.PI * 5 : 0, 2, delta);
      }
      if (safeHandleRef.current) {
        safeHandleRef.current.rotation.z = THREE.MathUtils.damp(safeHandleRef.current.rotation.z, isSolved ? Math.PI / 2 : 0, 3, delta);
      }
    }
    if (isSwitch && switchCoverRef.current) {
      const targetRotX = isFocused ? -2.0 : 0;
      switchCoverRef.current.rotation.x = THREE.MathUtils.damp(switchCoverRef.current.rotation.x, targetRotX, 6, delta);
    }
  });

  return (
    <group position={[pos[0], pos[1], pos[2]]} rotation={[phoneRotX, pos[3] ?? 0, 0]}>
      <mesh
        ref={meshRef}
        scale={scale}
        castShadow={shadowsOn && !usesRealModel}
        receiveShadow={shadowsOn && !usesRealModel}
      >
        {isRounded ? (
          <RoundedBoxGeometry args={[1, 1, 1]} radius={PC_CORNER_RADIUS} smoothness={4} />
        ) : (
          <boxGeometry args={[1, 1, 1]} />
        )}
        <primitive object={isRounded ? roundedMats : mats} attach="material" />
      </mesh>
      {usesRealModel && (
        // Local y = -scale[1]/2 lands the model's base (real models sit
        // with their own base at local y=0) on the invisible hitbox's
        // bottom face — the floor for the reception desk and elevator, the
        // coffee table's top for the coffee machine.
        <Suspense fallback={null}>
          <group position={[0, -scale[1] / 2, 0]}>
            {isReceptionDesk && <ReceptionDeskModel shadowsOn={shadowsOn} />}
            {isCoffeeMachine && <CoffeeMachineModel shadowsOn={shadowsOn} />}
            {isElevator && <ElevatorModel shadowsOn={shadowsOn} accentColor={theme.accent} />}
            {isSecurityConsole && <SecurityConsoleModel shadowsOn={shadowsOn} />}
            {isSafe && <SecuritySafeModel shadowsOn={shadowsOn} />}
            {isMarcusPC && <MarcusRobotModel shadowsOn={shadowsOn} />}
            {isWorkstation && <WorkstationModel shadowsOn={shadowsOn} />}
            {isCeoDesk && <CeoDeskModel shadowsOn={shadowsOn} />}
          </group>
        </Suspense>
      )}
      {isPhone && (
        <>
          {/* Mounting hook peg */}
          <mesh position={[0, scale[1] * 0.42, scale[2] / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.05, 8]} />
            <meshStandardMaterial color="#222222" roughness={0.4} metalness={0.6} />
          </mesh>
          {/* Handset — single revolved dumbbell shape, hanging tilted off the hook */}
          <group position={[0, scale[1] * 0.2, scale[2] / 2 + 0.11]} rotation={[0, 0, Math.PI / 12]}>
            <mesh>
              <latheGeometry args={[PHONE_HANDSET_PROFILE, 14]} />
              {handsetMat}
            </mesh>
          </group>
        </>
      )}
      {isSafe && (
        <>
          {/* Rotary combination dial, mounted proud of the real safe model's
              front face (SECURITY_SAFE_HALF_DEPTH/CENTER_Y — deeper and
              lower than the old invisible box's own center) — spins several
              full turns and lands "open" the moment the safe puzzle is
              solved (see isSolved / OBJECT_PUZZLE_MAP above). */}
          <mesh ref={dialRef} position={[scale[0] * 0.15, SECURITY_SAFE_CENTER_Y, SECURITY_SAFE_HALF_DEPTH + 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadowsOn}>
            <cylinderGeometry args={[0.09, 0.09, 0.03, 20]} />
            <meshStandardMaterial color="#cfcfcf" roughness={0.25} metalness={0.9} />
          </mesh>
          {/* Index notch so the dial's rotation actually reads as motion */}
          <mesh position={[scale[0] * 0.15, SECURITY_SAFE_CENTER_Y + 0.06, SECURITY_SAFE_HALF_DEPTH + 0.041]}>
            <boxGeometry args={[0.012, 0.02, 0.005]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
          {/* Handle lever — snaps from horizontal (locked) to vertical (open) */}
          <mesh ref={safeHandleRef} position={[-scale[0] * 0.2, SECURITY_SAFE_CENTER_Y, SECURITY_SAFE_HALF_DEPTH + 0.03]}>
            <boxGeometry args={[0.16, 0.03, 0.03]} />
            <meshStandardMaterial color="#8a8a8a" roughness={0.3} metalness={0.85} />
          </mesh>
        </>
      )}
      {isSwitch && (
        <group ref={switchCoverRef} position={[0, scale[1] / 2, scale[2] / 2]}>
          {/* Hinged protective flap, described in the room text as "a plastic
              cover" — tilts open on focus/hover as a satisfying micro-interaction. */}
          <mesh position={[0, -scale[1] / 2, 0.015]} castShadow={shadowsOn}>
            <boxGeometry args={[scale[0] * 0.95, scale[1] * 0.95, 0.02]} />
            <meshStandardMaterial color="#aa1111" transparent opacity={0.55} roughness={0.25} metalness={0.1} />
          </mesh>
        </group>
      )}
      {/* Object-local point light so it illuminates itself in the dark room.
          Real-model objects start brighter and reach further (see the
          useFrame lerp above) since they have no self-emissive material.
          Skipped for the CEO desk — its wide, low-decay throw was pooling as
          a visible yellow (theme.accent) glow on the floor beneath the real
          desk model; the desk still reads fine under the room's overhead
          key light. */}
      {!isCeoDesk && (
        <pointLight
          ref={lightRef}
          color={theme.accent}
          // Sitting dead-center inside the object (the default [0,0,0]) means
          // the light has to shine through the mesh to reach its own visible
          // face — pull it out in front (+z, this file's "front" convention)
          // for real models so it actually lights the surface the player
          // looks at, instead of mostly leaking into the floor/walls around it.
          // The workstation is the one exception: its light sits behind the
          // desk (-z, against the wall it's flush with) instead of in front.
          position={
            isWorkstation
              ? [0, 0, -(scale[2] / 2 + 0.35)]
              : usesRealModel
                ? [0, 0, scale[2] / 2 + 0.35]
                : [0, 0, 0]
          }
          intensity={usesRealModel ? 4.5 : 1}
          distance={usesRealModel ? 6 : 3.5}
          decay={usesRealModel ? 1.5 : 2}
        />
      )}
    </group>
  );
}

// Visual-only server rack clone — same look as the interactive "server_racks"
// object but not registered for raycasting, so it can't be focused or pressed
// with E. Used to bulk out the rack row without making every rack interactive.
function DecorativeServerRack({ roomId, position }: { roomId: RoomId; position: [number, number, number] }) {
  const theme  = THEME[roomId];
  const accent = new THREE.Color(theme.accent);
  const tex     = getObjectTexture("server_racks", theme.accent);
  const matType = OBJ_MATERIAL_TYPE["server_racks"] ?? "metal_dark";
  const { roughness, metalness } = MAT_PROPS[matType];
  const sideTex = getMaterialTex(matType);

  const frontMat = new THREE.MeshStandardMaterial({
    map: tex, emissive: accent, emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.5,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    map: sideTex, color: "#5a5a5a", emissive: accent, emissiveMap: sideTex, emissiveIntensity: 0.35, roughness, metalness,
  });
  const mats = [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat];
  const scale = OBJ_SCALE["server_racks"] ?? [1, 1, 1];

  return (
    <group position={position}>
      <mesh scale={scale}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={mats} attach="material" />
      </mesh>
      <pointLight color={theme.accent} intensity={1} distance={3.5} decay={2} />
    </group>
  );
}

// Long side table against RESEARCH_LAB's east wall — visual-only stand (not
// raycast-registered) that both "experiment_logs" (notebooks) and
// "encrypted_drive_terminal" (Data Transfer Station) rest on top of, one at
// each end. Keep TABLE_LEG_H + TABLE_TOP_H (at the default scale=1.6) in
// sync with those two objects' y in OBJ_POS. depthScale=3 (3x the base
// length) stretches only the Z run — the X footprint is unchanged from the
// original corner table, so it still clears the east wall (HALF = 7) with
// the same margin. Also reused (at a smaller scale, no lamp, no stretch) as
// the LOBBY coffee table — see LOBBY_COFFEE_TABLE_POS and coffee_machine's y
// in OBJ_POS.
const RESEARCH_LAB_TABLE_POS: [number, number, number] = [6.0, 0, 4.2];
const RESEARCH_LAB_TABLE_DEPTH_SCALE = 3;
const LOBBY_COFFEE_TABLE_POS: [number, number, number] = [6.0, 0, 2.7];
const LOBBY_COFFEE_TABLE_SCALE = 1.0;
// ESCAPE_ROUTE — one table each for evidence_shredder and aria_broadcast, at
// their x/z (see OBJ_POS) so the objects just need to sit on top; scale 1.8
// so the tabletop clears each object's footprint after its facing rotation.
// heightScale halves the leg height (a lower table); depthScale stretches
// the Z run 20% wider — keep table-top-height math (legH*heightScale
// + topH) in sync with the two objects' y in OBJ_POS.
const ESCAPE_ROUTE_SHREDDER_TABLE_POS: [number, number, number] = [-2, 0, 2.5];
const ESCAPE_ROUTE_BROADCAST_TABLE_POS: [number, number, number] = [2, 0, 2.5];
const ESCAPE_ROUTE_TABLE_SCALE = 1.8;
const ESCAPE_ROUTE_TABLE_DEPTH_SCALE = 1.2;
const ESCAPE_ROUTE_TABLE_HEIGHT_SCALE = 0.5;
// Lamp height doubled (100% taller) from its original 0.35 post / 0.22 shade.
const LAMP_POST_H = 0.35 * 2;
const LAMP_SHADE_H = 0.22 * 2;
const LAMP_SHADE_Y = 0.22 * 2;
const LAMP_LIGHT_Y = 0.15 * 2;

function DecorativeTable({
  roomId, position, scale = 1.6, depthScale = 1, widthScale = 1, heightScale = 1, withLamp = true,
}: {
  roomId: RoomId; position: [number, number, number]; scale?: number;
  depthScale?: number; widthScale?: number; heightScale?: number; withLamp?: boolean;
}) {
  const theme = THEME[roomId];
  const tex = getMaterialTex('wood_dark');
  const { roughness, metalness } = MAT_PROPS['wood_dark'];
  // depthScale/widthScale/heightScale each stretch one dimension (Z run, X
  // run, leg height) independently of `scale`, which still governs leg
  // thickness and tabletop thickness uniformly — so a table can be made
  // longer, wider, or shorter without the other dimensions moving.
  const topW = 0.9 * scale * widthScale, topH = 0.06 * scale, topD = 0.6 * scale * depthScale, legH = 0.65 * scale * heightScale;
  const legThick = 0.06 * scale;
  const legX = topW / 2 - legThick;
  const legZ = topD / 2 - legThick;
  const legOffsets: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const quality   = useGraphicsStore((s) => s.quality);
  const shadowsOn = getQualityPreset(quality).shadows.enabled;

  return (
    <group position={position}>
      <mesh position={[0, legH + topH / 2, 0]} castShadow={shadowsOn} receiveShadow={shadowsOn}>
        <boxGeometry args={[topW, topH, topD]} />
        <meshStandardMaterial map={tex} color="#6b4a30" roughness={roughness} metalness={metalness} />
      </mesh>
      {legOffsets.map(([sx, sz], i) => (
        <mesh key={i} position={[sx * legX, legH / 2, sz * legZ]} castShadow={shadowsOn} receiveShadow={shadowsOn}>
          <boxGeometry args={[legThick, legH, legThick]} />
          <meshStandardMaterial map={tex} color="#4a3320" roughness={roughness} metalness={metalness} />
        </mesh>
      ))}
      {/* Corner reading lamp — this corner sits far from any other light source,
          so it gets its own fixture rather than relying on the notebooks' own
          small self-illumination point light. Post/shade heights doubled
          (100% taller); radii unchanged. Skipped for tables (e.g. the LOBBY
          coffee table) that don't need one. */}
      {/* Lamp post is a cylinder centered on its own origin, so the group
          sits half LAMP_POST_H above the tabletop to make its base touch
          the surface instead of floating. */}
      {withLamp && (
        <group position={[-legX, legH + topH + LAMP_POST_H / 2, -legZ]}>
          <mesh>
            <cylinderGeometry args={[0.03, 0.05, LAMP_POST_H, 10]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, LAMP_SHADE_Y, 0]}>
            <coneGeometry args={[0.16, LAMP_SHADE_H, 16, 1, true]} />
            <meshStandardMaterial color="#e8dcc0" emissive="#fff3d0" emissiveIntensity={0.6} roughness={0.6} metalness={0.1} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, LAMP_LIGHT_Y, 0]} color="#ffd9a0" intensity={2.2} distance={6} decay={2} />
        </group>
      )}
      <pointLight position={[0, legH + 1.4, 0]} color={theme.accent} intensity={0.6} distance={5} decay={2} />
    </group>
  );
}

// ─── Exit door (full physical door) ──────────────────────────────────────────
interface ExitDoorProps {
  position: [number, number, number];
  rotY?: number;
  label: string;
  accentColor: string;
  isFocused: boolean;
  focusedIdRef: React.MutableRefObject<string | null>;
  exitId: string;
  toRoomId: RoomId;
  isLocked: boolean;
  // True once the player has ever traveled through this exit before (i.e.
  // its destination room has been visited). Used doors stay lit but stop
  // blinking, so blinking is reserved for routes the player hasn't taken yet.
  hasBeenUsed: boolean;
  registerMesh: (id: string, mesh: THREE.Mesh) => void;
  unregisterMesh: (id: string) => void;
}

// Access-status light tuning (ExitDoor) — bright enough to read as a clear
// signal against the room's otherwise dim, moody lighting, and blinking
// (rather than solid) while accessible so it draws the eye.
const DOOR_LIGHT_BULB_MAX  = 10;
const DOOR_LIGHT_POINT_MAX = 8;
const DOOR_LIGHT_BLINK_HZ  = 1.5;

function ExitDoor({ position, rotY = 0, accentColor, isFocused, exitId, toRoomId, isLocked, hasBeenUsed, registerMesh, unregisterMesh }: ExitDoorProps) {
  const triggerRef = useRef<THREE.Mesh>(null);
  const panelRef   = useRef<THREE.Mesh>(null);
  const leftRef    = useRef<THREE.Mesh>(null);
  const rightRef   = useRef<THREE.Mesh>(null);
  const topRef     = useRef<THREE.Mesh>(null);
  const statusBulbRef  = useRef<THREE.Mesh>(null);
  const statusLightRef = useRef<THREE.PointLight>(null);
  // Smoothed 0-1 "powered on" scalar, separate from the actual displayed
  // intensity — lets the locked/unlocked transition stay a smooth fade while
  // the blink layered on top (below) stays a crisp on/off flash instead of
  // getting blurred out by that same easing.
  const doorPowerRef = useRef(0);

  const destAccent = new THREE.Color(THEME[toRoomId].accent);
  const doorTex    = getDoorTexture(toRoomId, isLocked);
  const quality    = useGraphicsStore((s) => s.quality);
  const shadowsOn  = getQualityPreset(quality).shadows.enabled;

  useEffect(() => {
    if (triggerRef.current) registerMesh(exitId, triggerRef.current);
    return () => unregisterMesh(exitId);
  }, [exitId, registerMesh, unregisterMesh]);

  useFrame((state) => {
    // Frame jambs glow
    const frameTarget = isFocused ? 4 : 1.2;
    [leftRef, rightRef, topRef].forEach((r) => {
      if (r.current) {
        const m = r.current.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity, frameTarget, 0.1);
      }
    });
    // Door panel glow
    if (panelRef.current) {
      const mArr = panelRef.current.material as THREE.MeshStandardMaterial[];
      const frontTarget = isFocused ? 2.8 : isLocked ? 0.4 : 1.0;
      const sideTarget  = isFocused ? 0.5 : 0.12;
      mArr[4].emissiveIntensity = THREE.MathUtils.lerp(mArr[4].emissiveIntensity, frontTarget, 0.1);
      for (const i of [0, 1, 2, 3, 5]) {
        mArr[i].emissiveIntensity = THREE.MathUtils.lerp(mArr[i].emissiveIntensity, sideTarget, 0.1);
      }
    }
    // Access-status light above the door: blinks once the exit is
    // accessible, stays fully dark while locked. doorPowerRef smooths the
    // locked/unlocked transition (so it "powers up" rather than snapping);
    // blinkOn is a hard square wave layered on top once powered, so the
    // flash itself stays crisp instead of getting smeared by that easing.
    // A door the player has already used stays solid (no blink) once
    // accessible — blinking is reserved for routes not yet taken, so there's
    // never more than one light competing for the player's attention.
    doorPowerRef.current = THREE.MathUtils.lerp(doorPowerRef.current, isLocked ? 0 : 1, 0.08);
    const blinkOn = hasBeenUsed
      ? 1
      : Math.sin(state.clock.elapsedTime * DOOR_LIGHT_BLINK_HZ * Math.PI * 2) > 0 ? 1 : 0;
    const glow = doorPowerRef.current * blinkOn;
    if (statusBulbRef.current) {
      const m = statusBulbRef.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = glow * DOOR_LIGHT_BULB_MAX;
    }
    if (statusLightRef.current) {
      statusLightRef.current.intensity = glow * DOOR_LIGHT_POINT_MAX;
    }
  });

  // Door dimensions
  const DW   = 1.32;  // door width
  const DH   = 3.5;   // door height
  const JW   = 0.12;  // jamb width
  const JZ   = 0.11;  // jamb depth

  // Panel: illustrated canvas texture on front (+z), dark metal on all other faces
  const panelFrontMat = new THREE.MeshStandardMaterial({
    map: doorTex, emissive: destAccent, emissiveMap: doorTex,
    emissiveIntensity: isLocked ? 0.4 : 1.0, roughness: 0.35, metalness: 0.6,
  });
  const panelSideMat = new THREE.MeshStandardMaterial({
    color: "#0c0c0c", emissive: destAccent, emissiveIntensity: 0.12,
    roughness: 0.65, metalness: 0.75,
  });
  // face order: +x, -x, +y, -y, +z(front toward room), -z(back/wall)
  const panelMats = [panelSideMat, panelSideMat, panelSideMat, panelSideMat, panelFrontMat, panelSideMat];

  const frameMat = (
    <meshStandardMaterial color="#000000" emissive={destAccent} emissiveIntensity={1.2} roughness={0.3} metalness={0.85} />
  );

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Invisible trigger zone for raycasting */}
      <mesh ref={triggerRef} position={[0, DH / 2, 0.08]}>
        <boxGeometry args={[DW, DH, 0.4]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Door panel */}
      <mesh ref={panelRef} position={[0, DH / 2, 0.04]} castShadow={shadowsOn} receiveShadow={shadowsOn}>
        <boxGeometry args={[DW, DH, 0.1]} />
        <primitive object={panelMats} attach="material" />
      </mesh>

      {/* Door handle — vertical grip bar */}
      <mesh position={[0.38, DH / 2 - 0.25, 0.11]}>
        <boxGeometry args={[0.07, 0.3, 0.07]} />
        <meshStandardMaterial color="#999999" emissive={destAccent} emissiveIntensity={0.4} roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Handle backing plate */}
      <mesh position={[0.38, DH / 2 - 0.25, 0.075]}>
        <boxGeometry args={[0.12, 0.08, 0.04]} />
        <meshStandardMaterial color="#555555" emissive={destAccent} emissiveIntensity={0.25} roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Left jamb */}
      <mesh ref={leftRef} position={[-(DW / 2 + JW / 2), DH / 2, 0]} receiveShadow={shadowsOn}>
        <boxGeometry args={[JW, DH + 0.18, JZ]} />
        {frameMat}
      </mesh>
      {/* Right jamb */}
      <mesh ref={rightRef} position={[DW / 2 + JW / 2, DH / 2, 0]} receiveShadow={shadowsOn}>
        <boxGeometry args={[JW, DH + 0.18, JZ]} />
        {frameMat}
      </mesh>
      {/* Top lintel */}
      <mesh ref={topRef} position={[0, DH + 0.09, 0]} receiveShadow={shadowsOn}>
        <boxGeometry args={[DW + JW * 2, 0.18, JZ]} />
        {frameMat}
      </mesh>
      {/* Floor threshold strip */}
      <mesh position={[0, 0.03, 0]} receiveShadow={shadowsOn}>
        <boxGeometry args={[DW + JW * 2, 0.06, JZ]} />
        <meshStandardMaterial color="#000000" emissive={destAccent} emissiveIntensity={0.7} roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Access-status light — mounted above the lintel. Fully lit when this
          exit is accessible, dark when locked (see bulbTarget in useFrame). */}
      <mesh position={[0, DH + 0.28, 0]}>
        <boxGeometry args={[0.22, 0.06, 0.08]} />
        <meshStandardMaterial color="#111111" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh ref={statusBulbRef} position={[0, DH + 0.28, 0.05]}>
        <sphereGeometry args={[0.084375, 12, 12]} />
        <meshStandardMaterial color="#101010" emissive={destAccent} emissiveIntensity={0} roughness={0.3} metalness={0.2} />
      </mesh>
      <pointLight ref={statusLightRef} position={[0, DH + 0.28, 0.05]} color={THEME[toRoomId].accent} intensity={0} distance={5} decay={2} />
    </group>
  );
}

// ─── Controller (WASD + Raycasting) ─────────────────────────────────────────
interface ControllerProps {
  meshMapRef: React.MutableRefObject<Map<string, THREE.Mesh>>;
  onFocusChange: (id: string | null) => void;
  onEPress: () => void;
  active: boolean;
  roomId: RoomId;
}

// Pre-allocated vectors — reused every frame to avoid GC churn
const _forward  = new THREE.Vector3();
const _right    = new THREE.Vector3();
const _desired  = new THREE.Vector3();
const _UP       = new THREE.Vector3(0, 1, 0);

// Shared vectors for FloatingMarcusPC — module-level to avoid per-frame allocation
const _floatFwd = new THREE.Vector3();
const _floatRgt = new THREE.Vector3();
const _floatTgt = new THREE.Vector3();

function Controller({ meshMapRef, onFocusChange, onEPress, active, roomId }: ControllerProps) {
  const { camera } = useThree();
  const keys        = useRef(new Set<string>());
  const raycaster   = useRef(new THREE.Raycaster());
  const velocity    = useRef(new THREE.Vector3());
  const lastFocused = useRef<string | null>(null);

  // Reset camera and velocity when room changes
  useEffect(() => {
    camera.position.set(0, PLAYER_H, 5);
    camera.rotation.order = "YXZ";
    camera.rotation.set(0, 0, 0);
    velocity.current.set(0, 0, 0);
  }, [roomId, camera]);

  useEffect(() => {
    // Clear any keys that were held when pointer lock was released
    keys.current.clear();
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      if (e.code === "KeyE") onEPress();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      keys.current.clear();
    };
  }, [active, onEPress]);

  useFrame((_, delta) => {
    // ── Movement using camera's actual world direction ──
    // camera.getWorldDirection gives the true look direction regardless of rotation order
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    _right.crossVectors(_forward, _UP).normalize();

    _desired.set(0, 0, 0);
    if (keys.current.has("KeyW")) _desired.add(_forward);
    if (keys.current.has("KeyS")) _desired.sub(_forward);
    if (keys.current.has("KeyD")) _desired.add(_right);
    if (keys.current.has("KeyA")) _desired.sub(_right);

    if (_desired.lengthSq() > 0) _desired.normalize().multiplyScalar(SPEED);

    // Smooth acceleration toward desired velocity (lerp factor 12 = ~80ms ramp)
    velocity.current.lerp(_desired, Math.min(1, 12 * delta));

    if (active) {
      camera.position.addScaledVector(velocity.current, delta);
      camera.position.y = PLAYER_H;
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -HALF + 0.6, HALF - 0.6);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -HALF + 0.6, HALF - 0.6);
    } else {
      velocity.current.multiplyScalar(0.85);
    }

    // ── Raycasting from camera center ──
    camera.getWorldDirection(_forward);
    raycaster.current.set(camera.position, _forward);
    const meshes = Array.from(meshMapRef.current.values());
    const hits = raycaster.current.intersectObjects(meshes, false);

    if (hits.length > 0 && hits[0].distance < INTERACT_DIST) {
      const hitMesh = hits[0].object as THREE.Mesh;
      const focusedId = Array.from(meshMapRef.current.entries()).find(([, m]) => m === hitMesh)?.[0] ?? null;
      if (focusedId !== lastFocused.current) {
        lastFocused.current = focusedId;
        onFocusChange(focusedId);
      }
    } else {
      if (lastFocused.current !== null) {
        lastFocused.current = null;
        onFocusChange(null);
      }
    }
  });

  return null;
}

// ─── Manual mouse-look (replaces PointerLockControls) ────────────────────────
function FirstPersonLook({ active }: { active: boolean }) {
  const { camera } = useThree();

  // Ensure rotation order is set once, not per-mousemove
  useEffect(() => {
    camera.rotation.order = "YXZ";
  }, [camera]);

  useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent) => {
      camera.rotation.y -= e.movementX * 0.002;
      camera.rotation.x -= e.movementY * 0.002;
      camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x, -Math.PI / 2.2, Math.PI / 2.2);
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, [active, camera]);

  return null;
}

// ─── Floating Marcus PC — follows player after first contact ─────────────────
interface FloatingMarcusPCProps {
  roomId: RoomId;
  isFocused: boolean;
  focusedIdRef: React.MutableRefObject<string | null>;
  registerMesh: (id: string, mesh: THREE.Mesh) => void;
  unregisterMesh: (id: string) => void;
}

function FloatingMarcusPC({ roomId, isFocused, registerMesh, unregisterMesh }: FloatingMarcusPCProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const meshRef  = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const theme    = THEME[roomId];
  const accent   = new THREE.Color(theme.accent);
  const quality   = useGraphicsStore((s) => s.quality);
  const shadowsOn = getQualityPreset(quality).shadows.enabled;

  const tex     = getObjectTexture("marcus_pc", theme.accent);
  tex.offset.set(PC_CORNER_RADIUS, PC_CORNER_RADIUS);
  const matType = OBJ_MATERIAL_TYPE["marcus_pc"] ?? "metal_dark";
  const { roughness, metalness } = MAT_PROPS[matType];
  const sideTex = getMaterialTex(matType);

  const frontMat = new THREE.MeshStandardMaterial({
    map: tex, emissive: accent, emissiveMap: tex,
    emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.5,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    map: sideTex, color: "#5a5a5a", emissive: accent, emissiveMap: sideTex,
    emissiveIntensity: 0.35, roughness, metalness,
  });
  // Same real-model swap as ObjMesh's usesRealModel objects — this box stays
  // only as the raycasting hitbox (registerMesh below), fully invisible,
  // while MarcusRobotModel is the actual visible layer.
  for (const m of [frontMat, sideMat]) { m.transparent = true; m.opacity = 0; m.depthWrite = false; }
  // RoundedBoxGeometry exposes 2 material groups: 0 = front/back caps, 1 = side walls
  const mats = [frontMat, sideMat];

  useEffect(() => {
    if (meshRef.current) registerMesh("marcus_pc", meshRef.current);
    return () => unregisterMesh("marcus_pc");
  }, [registerMesh, unregisterMesh]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    // Compute target position: 1.3 units in front, 0.8 to the right, bobbing
    camera.getWorldDirection(_floatFwd);
    _floatFwd.y = 0;
    _floatFwd.normalize();
    _floatRgt.crossVectors(_floatFwd, _UP).normalize();

    const bob = Math.sin(clock.getElapsedTime() * 1.6) * 0.065;
    _floatTgt.set(
      camera.position.x + _floatFwd.x * 1.3 + _floatRgt.x * 0.8,
      PLAYER_H - 0.45 + bob,
      camera.position.z + _floatFwd.z * 1.3 + _floatRgt.z * 0.8,
    );

    // Clamp inside room bounds
    _floatTgt.x = THREE.MathUtils.clamp(_floatTgt.x, -HALF + 0.8, HALF - 0.8);
    _floatTgt.z = THREE.MathUtils.clamp(_floatTgt.z, -HALF + 0.8, HALF - 0.8);

    // Smooth follow
    groupRef.current.position.lerp(_floatTgt, 0.07);

    // Always face the player
    groupRef.current.rotation.y = Math.atan2(
      camera.position.x - groupRef.current.position.x,
      camera.position.z - groupRef.current.position.z,
    );

    // Glow pulsing
    if (meshRef.current) {
      const mArr = meshRef.current.material as THREE.MeshStandardMaterial[];
      const pulse = 0.75 + Math.sin(clock.getElapsedTime() * 2.4) * 0.15;
      const targetFront = isFocused ? 3.5 : pulse;
      const targetSide  = isFocused ? 0.65 : 0.3;
      mArr[0].emissiveIntensity = THREE.MathUtils.lerp(mArr[0].emissiveIntensity, targetFront, 0.1);
      mArr[1].emissiveIntensity = THREE.MathUtils.lerp(mArr[1].emissiveIntensity, targetSide, 0.1);
    }
    if (lightRef.current) {
      // Same brighter/further-reaching real-model treatment as ObjMesh's
      // usesRealModel objects (see the matching comment there) — the robot
      // model has no self-emissive material of its own.
      lightRef.current.intensity = THREE.MathUtils.lerp(
        lightRef.current.intensity, isFocused ? 6.5 : 4.5, 0.1,
      );
    }
  });

  const scale = OBJ_SCALE["marcus_pc"] ?? [1, 1, 1];

  return (
    <group ref={groupRef} position={[3, PLAYER_H - 0.45, 3.5]}>
      <mesh ref={meshRef} scale={scale} castShadow={false} receiveShadow={false}>
        <RoundedBoxGeometry args={[1, 1, 1]} radius={PC_CORNER_RADIUS} smoothness={4} />
        <primitive object={mats} attach="material" />
      </mesh>
      <Suspense fallback={null}>
        <group position={[0, -scale[1] / 2, 0]}>
          <MarcusRobotModel shadowsOn={shadowsOn} />
        </group>
      </Suspense>
      <pointLight
        ref={lightRef}
        color={theme.accent}
        position={[0, 0, scale[2] / 2 + 0.35]}
        intensity={4.5}
        distance={6}
        decay={1.5}
      />
    </group>
  );
}

// ─── Scene (everything inside <Canvas>) ──────────────────────────────────────
interface SceneProps {
  roomId: RoomId;
  inspectedObjects: string[];
  isLocked: boolean;
  exitLockStatus: Record<string, boolean>;
  focusedIdRef: React.MutableRefObject<string | null>;
  meshMapRef: React.MutableRefObject<Map<string, THREE.Mesh>>;
  onFocusChange: (id: string | null) => void;
  onEPress: () => void;
  marcusStopped: boolean;
  marcusStopPosition: [number, number, number, number?] | null;
}

function Scene({ roomId, inspectedObjects, isLocked, exitLockStatus, focusedIdRef, meshMapRef, onFocusChange, onEPress, marcusStopped, marcusStopPosition }: SceneProps) {
  const theme = THEME[roomId];
  const room = getRoom(roomId);
  const exits = EXIT_LAYOUT[roomId] ?? [];
  // A door stops blinking for good once its destination has ever been
  // visited — reading straight from visitedRooms (rather than only
  // remembering the immediately-previous room) so it also covers rooms
  // visited two+ moves ago, not just a one-step "where did I just come from."
  const visitedRooms = useGameStore((s) => s.gameState?.visitedRooms);
  const particlePreset = getQualityPreset(useGraphicsStore((s) => s.quality)).particles;

  const registerMesh   = useCallback((id: string, mesh: THREE.Mesh) => { meshMapRef.current.set(id, mesh); }, [meshMapRef]);
  const unregisterMesh = useCallback((id: string) => { meshMapRef.current.delete(id); }, [meshMapRef]);

  const [focused, setFocused] = useState<string | null>(null);

  const handleFocusChange = useCallback((id: string | null) => {
    setFocused(id);
    focusedIdRef.current = id;
    onFocusChange(id);
  }, [focusedIdRef, onFocusChange]);

  // Fog
  useThree(({ scene }) => {
    scene.fog = new THREE.FogExp2(theme.fog, 0.045);
    scene.background = new THREE.Color(theme.fog);
  });

  const visibleObjects = room.objects.filter((o) => !o.isHidden);
  const marcusIsFloating = roomId === "SECURITY_OFFICE" && inspectedObjects.includes("marcus_pc") && !marcusStopped;

  return (
    <>
      <RoomGeometry roomId={roomId} />

      {/* Interactive objects — skip marcus_pc when it's floating */}
      {visibleObjects.map((obj) => {
        if (obj.id === "marcus_pc" && marcusIsFloating) return null;
        return (
          <ObjMesh
            key={obj.id}
            objectId={obj.id}
            label={obj.name}
            icon={obj.icon}
            roomId={roomId}
            isInspected={inspectedObjects.includes(obj.id)}
            isFocused={focused === obj.id}
            focusedIdRef={focusedIdRef}
            registerMesh={registerMesh}
            unregisterMesh={unregisterMesh}
            overridePos={obj.id === "marcus_pc" ? marcusStopPosition : undefined}
          />
        );
      })}

      {/* Floating Marcus PC — active after first interaction */}
      {marcusIsFloating && (
        <FloatingMarcusPC
          roomId={roomId}
          isFocused={focused === "marcus_pc"}
          focusedIdRef={focusedIdRef}
          registerMesh={registerMesh}
          unregisterMesh={unregisterMesh}
        />
      )}

      {/* Decorative rack row — only the interactive "server_racks" object above responds to E */}
      {roomId === "SERVER_ROOM" && SERVER_RACK_ROW_EXTRA.map((pos, i) => (
        <DecorativeServerRack key={`rack-decor-${i}`} roomId={roomId} position={pos} />
      ))}

      {/* Corner side table — "experiment_logs" (Physical Lab Notebooks) rests on top of it */}
      {roomId === "RESEARCH_LAB" && <DecorativeTable roomId={roomId} position={RESEARCH_LAB_TABLE_POS} depthScale={RESEARCH_LAB_TABLE_DEPTH_SCALE} />}
      {/* Coffee table — "coffee_machine" rests on top of it, next to the vending machine */}
      {roomId === "LOBBY" && <DecorativeTable roomId={roomId} position={LOBBY_COFFEE_TABLE_POS} scale={LOBBY_COFFEE_TABLE_SCALE} withLamp={false} />}
      {/* Two matching tables — one under evidence_shredder, one under aria_broadcast */}
      {roomId === "ESCAPE_ROUTE" && (
        <>
          <DecorativeTable roomId={roomId} position={ESCAPE_ROUTE_SHREDDER_TABLE_POS} scale={ESCAPE_ROUTE_TABLE_SCALE} depthScale={ESCAPE_ROUTE_TABLE_DEPTH_SCALE} heightScale={ESCAPE_ROUTE_TABLE_HEIGHT_SCALE} withLamp={false} />
          <DecorativeTable roomId={roomId} position={ESCAPE_ROUTE_BROADCAST_TABLE_POS} scale={ESCAPE_ROUTE_TABLE_SCALE} depthScale={ESCAPE_ROUTE_TABLE_DEPTH_SCALE} heightScale={ESCAPE_ROUTE_TABLE_HEIGHT_SCALE} withLamp={false} />
        </>
      )}
      {/* Coffee machine steam — reuses the same ParticleField as the ambient
          dust, just narrower, faster-rising, and anchored above the machine.
          Anchor y is derived from the real model's own height (table top +
          COFFEE_MACHINE_TOP_Y), not the old invisible hitbox's — that box
          (OBJ_POS/OBJ_SCALE) is kept only for raycasting and is taller than
          the real model now standing in for it. */}
      {roomId === "LOBBY" && (
        <ParticleField
          count={Math.round(28 * particlePreset.densityMultiplier)}
          position={[
            OBJ_POS.coffee_machine[0],
            OBJ_POS.coffee_machine[1] - OBJ_SCALE.coffee_machine[1] / 2 + COFFEE_MACHINE_TOP_Y + 0.05,
            OBJ_POS.coffee_machine[2],
          ]}
          spread={[0.12, 0.45, 0.12]}
          color="#e8ecf1"
          size={0.025}
          opacity={0.28}
          riseSpeed={0.35}
          driftSpeed={0.05}
        />
      )}

      {/* Exit doors */}
      {exits.map((exit) => (
        <ExitDoor
          key={`exit-${exit.to}`}
          exitId={`exit-${exit.to}`}
          position={exit.position}
          rotY={exit.rotY}
          label={exit.label}
          accentColor={theme.accent}
          toRoomId={exit.to}
          hasBeenUsed={visitedRooms?.[exit.to]?.isVisited ?? false}
          isLocked={exitLockStatus[`exit-${exit.to}`] ?? false}
          isFocused={focused === `exit-${exit.to}`}
          focusedIdRef={focusedIdRef}
          registerMesh={registerMesh}
          unregisterMesh={unregisterMesh}
        />
      ))}

      {/* Controller */}
      <Controller
        meshMapRef={meshMapRef}
        onFocusChange={handleFocusChange}
        onEPress={onEPress}
        active={isLocked}
        roomId={roomId}
      />

      <FirstPersonLook active={isLocked} />
    </>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function GameWorld3D() {
  const { gameState, addToInventory, markObjectInspected, moveToRoom } = useGameStore();
  const {
    openPuzzleModal,
    openDialogueModal,
    openInspectionModal,
    addNotification,
    activeModal,
    setIsTransitioning,
  } = useUiStore();

  const [isLocked, setIsLocked]   = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusedLabel, setFocusedLabel] = useState<string | null>(null);
  const [objectPanel, setObjectPanel] = useState<{ objectId: string; examineText: string } | null>(null);
  const [loadingInteraction, setLoadingInteraction] = useState<string | null>(null);
  const [marcusStopped, setMarcusStopped] = useState(false);
  const [marcusStopPosition, setMarcusStopPosition] = useState<[number, number, number, number?] | null>(null);

  const focusedIdRef      = useRef<string | null>(null);
  const meshMapRef        = useRef<Map<string, THREE.Mesh>>(new Map());
  const lockCooldown      = useRef(false);
  const prevActiveModal   = useRef(activeModal);

  const graphicsQuality = useGraphicsStore((s) => s.quality);
  const shadowsEnabled  = getQualityPreset(graphicsQuality).shadows.enabled;

  // Listen for native pointer lock changes; enforce 1s cooldown after release
  useEffect(() => {
    const onChange = () => {
      if (document.pointerLockElement) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
        lockCooldown.current = true;
        setTimeout(() => { lockCooldown.current = false; }, 1500);
      }
    };
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  const lockPointer = useCallback(() => {
    if (lockCooldown.current || document.hidden || document.pointerLockElement) return;
    try {
      // requestPointerLock() returns a Promise that rejects asynchronously
      // (e.g. WrongDocumentError if a queued re-lock fires after the tab
      // lost focus or a modal took over) — this try/catch only guards the
      // rare synchronous throw, so the rejection must be caught too or it
      // surfaces as an unhandled promise rejection.
      document.body.requestPointerLock()?.catch(() => { /* lock request rejected by the browser */ });
    } catch { /* browser blocks rapid re-lock */ }
  }, []);

  // Leave the PC resting on the floor wherever it currently is (near the
  // player) instead of snapping back to its original desk spot.
  const stopMarcusFollowing = useCallback(() => {
    const mesh = meshMapRef.current.get("marcus_pc");
    if (mesh) {
      const worldPos = mesh.getWorldPosition(new THREE.Vector3());
      const rotY = mesh.parent?.rotation.y ?? 0;
      const floorY = (OBJ_SCALE["marcus_pc"]?.[1] ?? 1) / 2;
      setMarcusStopPosition([worldPos.x, floorY, worldPos.z, rotY]);
    }
    setMarcusStopped(true);
    setObjectPanel(null);
    setTimeout(() => lockPointer(), 1600);
  }, [lockPointer]);

  // Unlock pointer when a modal opens; re-lock when it closes
  useEffect(() => {
    const wasOpen = prevActiveModal.current !== null;
    const isNowClosed = activeModal === null;
    prevActiveModal.current = activeModal;

    if (activeModal && document.pointerLockElement) {
      document.exitPointerLock();
    } else if (wasOpen && isNowClosed && !objectPanel) {
      // Modal just closed — re-lock after the cooldown window
      setTimeout(() => lockPointer(), 1600);
    }
  }, [activeModal, objectPanel, lockPointer]);

  // Track focused label for the HUD
  const handleFocusChange = useCallback((id: string | null) => {
    setFocusedId(id);
    if (!id || !gameState) { setFocusedLabel(null); return; }

    if (id.startsWith("exit-")) {
      const targetRoom = id.replace("exit-", "") as RoomId;
      const room = getRoom(gameState.currentRoom as RoomId);
      const exit = room.exits.find((e) => e.to === targetRoom);
      setFocusedLabel(exit ? `→ ${exit.label}` : targetRoom);
    } else {
      const room = getRoom(gameState.currentRoom as RoomId);
      const obj  = room.objects.find((o) => o.id === id);
      setFocusedLabel(obj?.name ?? id);
    }
  }, [gameState]);

  const handleInteract = useCallback(async () => {
    const id = focusedIdRef.current;
    if (!id || !gameState) return;

    // ── Exit door ──
    if (id.startsWith("exit-")) {
      const targetRoom = id.replace("exit-", "") as RoomId;
      const room = getRoom(gameState.currentRoom as RoomId);
      const exit = room.exits.find((e) => e.to === targetRoom);

      if (!exit) return;
      if (exit.isLocked) {
        const hasItem = exit.requiresItem && gameState.inventory.some((i) => i.itemId === exit.requiresItem);
        const hasSolved = exit.requiresPuzzleSolved && gameState.puzzleStates[exit.requiresPuzzleSolved]?.status === "SOLVED";
        if (!hasItem && !hasSolved) {
          addNotification({ type: "warning", title: "Locked", message: exit.lockedMessage, duration: 3000 });
          return;
        }
      }

      setIsTransitioning(true);
      try {
        const res = await fetch("/api/game/room?action=move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: gameState.sessionId, targetRoom }),
        });
        const data = await res.json();
        if (data.success) {
          moveToRoom(targetRoom);
          meshMapRef.current.clear();
          if (data.data.isFirstVisit && data.data.narrative) {
            addNotification({ type: "info", title: "SYSTEM", message: data.data.narrative.slice(0, 120) + "...", duration: 6000 });
          }
        } else {
          addNotification({ type: "warning", title: "Cannot Move", message: data.error, duration: 3000 });
        }
      } catch {
        addNotification({ type: "error", title: "Error", message: "Move failed.", duration: 3000 });
      } finally {
        setTimeout(() => setIsTransitioning(false), 400);
      }
      return;
    }

    // ── Game object ──
    const room = getRoom(gameState.currentRoom as RoomId);
    const obj  = room.objects.find((o) => o.id === id);
    if (!obj) return;

    // Re-activate Marcus PC following if it was stopped
    if (id === "marcus_pc" && marcusStopped) setMarcusStopped(false);

    if (obj.requiresItem) {
      const hasItem = gameState.inventory.some((i) => i.itemId === obj.requiresItem);
      if (!hasItem) {
        addNotification({ type: "warning", title: "Locked", message: `You need ${getItem(obj.requiresItem as ItemId).name}.`, duration: 3000 });
        return;
      }
    }

    try {
      const res = await fetch("/api/game/room?action=inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: gameState.sessionId, roomId: gameState.currentRoom, objectId: id }),
      });
      const data = await res.json();
      if (data.success) {
        markObjectInspected(id);
        document.exitPointerLock();
        setObjectPanel({ objectId: id, examineText: data.data.examineText });
      }
    } catch {
      addNotification({ type: "error", title: "Error", message: "Interaction failed.", duration: 3000 });
    }
  }, [gameState, markObjectInspected, moveToRoom, addNotification, setIsTransitioning, marcusStopped]);

  const handleObjectInteraction = useCallback(async (objectId: string, interactionId: string) => {
    if (!gameState || loadingInteraction) return;
    setLoadingInteraction(interactionId);
    try {
      const res = await fetch("/api/game/room?action=inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: gameState.sessionId, roomId: gameState.currentRoom, objectId, interactionId }),
      });
      const data = await res.json();
      if (data.success) {
        const { examineText, itemObtained, puzzleTriggered, npcTriggered } = data.data;
        if (itemObtained) {
          addToInventory(itemObtained as ItemId);
          addNotification({ type: "item", title: "Item Found", message: getItem(itemObtained as ItemId).name, duration: 4000 });
        }
        if (puzzleTriggered) {
          setObjectPanel(null);
          openPuzzleModal(puzzleTriggered as PuzzleId);
        } else if (npcTriggered) {
          setObjectPanel(null);
          openDialogueModal(npcTriggered as NpcId);
        } else {
          openInspectionModal(examineText);
        }
      }
    } catch {
      addNotification({ type: "error", title: "Error", message: "Interaction failed.", duration: 3000 });
    } finally {
      setLoadingInteraction(null);
    }
  }, [gameState, loadingInteraction, addToInventory, openPuzzleModal, openDialogueModal, openInspectionModal, addNotification]);

  if (!gameState) return null;

  const roomId = gameState.currentRoom as RoomId;
  const theme  = THEME[roomId];
  const inspectedObjects = gameState.visitedRooms[roomId]?.inspectedObjects ?? [];
  const marcusIsFloating = roomId === "SECURITY_OFFICE" && inspectedObjects.includes("marcus_pc") && !marcusStopped;

  // Determine which exits are currently locked for the door visuals
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const exitLockStatus = useMemo(() => {
    const room = getRoom(roomId);
    const result: Record<string, boolean> = {};
    for (const exit of room.exits) {
      if (!exit.isLocked) { result[`exit-${exit.to}`] = false; continue; }
      const hasItem    = exit.requiresItem         ? gameState.inventory.some((i) => i.itemId === exit.requiresItem) : false;
      const hasSolved  = exit.requiresPuzzleSolved ? gameState.puzzleStates[exit.requiresPuzzleSolved]?.status === "SOLVED" : false;
      result[`exit-${exit.to}`] = !hasItem && !hasSolved;
    }
    return result;
  }, [roomId, gameState.inventory, gameState.puzzleStates]);

  // Pressing Escape while Marcus's PC is following stops it in place, same as
  // clicking "Stop following" in its interaction panel.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!marcusIsFloating) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") stopMarcusFollowing();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [marcusIsFloating, stopMarcusFollowing]);

  return (
    <div className="game-canvas" style={{ background: theme.fog }}>
      {/* ── Three.js Canvas ── */}
      <Canvas
        camera={{ fov: 80, near: 0.1, far: 60, position: [0, PLAYER_H, 5] }}
        gl={{ antialias: true }}
        // A bare boolean here makes r3f request THREE.PCFSoftShadowMap, which
        // three.js (0.185+) has deprecated in favor of PCFShadowMap — it still
        // works but logs a console warning every load. Ask for "percentage"
        // (PCFShadowMap) explicitly instead; it's the exact type three was
        // already silently falling back to, so this is a no-op visually.
        shadows={shadowsEnabled ? "percentage" : false}
        onCreated={({ gl }) => { gl.setPixelRatio(Math.min(window.devicePixelRatio, 2)); }}
        onPointerDown={() => { if (!isLocked) lockPointer(); }}
      >
        <Scene
          roomId={roomId}
          inspectedObjects={inspectedObjects}
          isLocked={isLocked}
          exitLockStatus={exitLockStatus}
          focusedIdRef={focusedIdRef}
          meshMapRef={meshMapRef}
          onFocusChange={handleFocusChange}
          onEPress={handleInteract}
          marcusStopped={marcusStopped}
          marcusStopPosition={marcusStopPosition}
        />
        <BloomEffects />
      </Canvas>

      {/* ── HTML overlays ── */}

      {/* Click to play prompt */}
      {!isLocked && !activeModal && !objectPanel && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div
            className="bg-black/70 border border-slate-700/60 rounded-lg px-6 py-4 text-center
                        backdrop-blur-sm pointer-events-auto cursor-pointer"
            onClick={lockPointer}
          >
            <div className="text-slate-300 text-sm font-mono mb-1">Click to enter</div>
            <div className="text-slate-500 text-xs">WASD to move · Mouse to look · E to interact · ESC to pause</div>
          </div>
        </div>
      )}

      {/* Object interaction panel */}
      {objectPanel && (() => {
        const room = getRoom(roomId);
        const obj  = room.objects.find((o) => o.id === objectPanel.objectId);
        if (!obj) return null;

        const availableInteractions = obj.interactions.filter((interaction) => {
          if (!interaction.requiresPuzzleSolved) return true;
          const ps = gameState.puzzleStates[interaction.requiresPuzzleSolved as PuzzleId];
          return ps?.status === "SOLVED";
        });

        return (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setObjectPanel(null); setTimeout(() => lockPointer(), 1600); }}
            />

            {/* Floating panel */}
            <div className="relative w-full max-w-md mx-6 bg-slate-900/98 border border-slate-700/60 rounded-lg shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: "70vh" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{obj.icon}</span>
                  <span className="text-slate-100 text-sm font-semibold tracking-wide">{obj.name}</span>
                </div>
                <button
                  onClick={() => { setObjectPanel(null); setTimeout(() => lockPointer(), 1600); }}
                  className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Description */}
              <div className="px-5 py-4 border-b border-slate-800/60">
                <p className="text-slate-400 text-sm leading-relaxed">{objectPanel.examineText}</p>
              </div>

              {/* Actions */}
              <div className="overflow-y-auto px-5 py-4 space-y-2">
                {availableInteractions.length === 0 && !marcusIsFloating ? (
                  <p className="text-slate-600 text-xs text-center py-4">Nothing else to do here.</p>
                ) : (
                  <>
                    {availableInteractions.map((interaction) => (
                      <button
                        key={interaction.id}
                        onClick={() => handleObjectInteraction(obj.id, interaction.id)}
                        disabled={loadingInteraction === interaction.id}
                        className="w-full text-left px-4 py-3 rounded border border-slate-700/50 bg-slate-800/50
                                   hover:bg-slate-700/60 hover:border-slate-600/60 text-slate-300 text-sm
                                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                      >
                        {loadingInteraction === interaction.id
                          ? <span className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          : <span className="text-slate-500 text-base leading-none">›</span>
                        }
                        {interaction.label}
                      </button>
                    ))}

                    {obj.id === "marcus_pc" && marcusIsFloating && (
                      <button
                        onClick={stopMarcusFollowing}
                        className="w-full text-left px-4 py-3 rounded border border-amber-800/40 bg-amber-950/30
                                   hover:bg-amber-900/40 hover:border-amber-700/50 text-amber-400 text-sm
                                   transition-colors flex items-center gap-3"
                      >
                        <span className="text-amber-600 text-base leading-none">⊠</span>
                        Stop following
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Crosshair */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="relative w-6 h-6 flex items-center justify-center">
            <div className="absolute w-4 h-px" style={{ backgroundColor: focusedId ? theme.accent : "rgba(255,255,255,0.7)" }} />
            <div className="absolute w-px h-4" style={{ backgroundColor: focusedId ? theme.accent : "rgba(255,255,255,0.7)" }} />
          </div>
        </div>
      )}

      {/* Interaction prompt */}
      {isLocked && focusedId && focusedLabel && (
        <div
          className="absolute bottom-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-10
                      flex flex-col items-center gap-1"
        >
          <div
            className="text-xs font-mono px-3 py-1.5 rounded border backdrop-blur-sm"
            style={{
              borderColor: `${theme.accent}50`,
              backgroundColor: `${theme.accent}15`,
              color: theme.accent,
            }}
          >
            {focusedLabel}
          </div>
          <div className="text-slate-500 text-xs font-mono">[E] Interact</div>
        </div>
      )}

      {/* Room name */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <div className="text-slate-700 text-xs font-mono tracking-widest">
          [{getRoom(roomId).name.toUpperCase()}]
        </div>
      </div>

      {/* Minimap dots (progress) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none z-10">
        {(["LOBBY","SECURITY_OFFICE","RESEARCH_LAB","SERVER_ROOM","EXECUTIVE_SUITE","ESCAPE_ROUTE"] as RoomId[]).map((r) => (
          <div
            key={r}
            className="rounded-full transition-all duration-300"
            style={{
              width:  r === roomId ? 20 : gameState.visitedRooms[r] ? 8 : 6,
              height: 4,
              backgroundColor: r === roomId ? theme.accent : gameState.visitedRooms[r] ? "#334155" : "#1e293b",
            }}
          />
        ))}
      </div>
    </div>
  );
}

