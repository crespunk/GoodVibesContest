"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Generic GPU-friendly particle system: one drawcall of THREE.Points, no
// per-particle CPU physics. The only per-frame CPU work is writing updated Y
// values into a typed array (cheap even for a few hundred particles) so dust
// drifts upward and wraps back to the bottom instead of ever spawning/despawning.
interface ParticleFieldProps {
  count: number;
  position?: [number, number, number];
  // Half-extents of the box the particles spawn/wrap within.
  spread: [number, number, number];
  color: string;
  size?: number;
  opacity?: number;
  // Units/sec drifting upward. 0 disables the per-frame position update entirely.
  riseSpeed?: number;
  // Units/sec the whole field slowly rotates around Y, for a faint sense of motion.
  driftSpeed?: number;
}

export function ParticleField({
  count,
  position = [0, 0, 0],
  spread,
  color,
  size = 0.03,
  opacity = 0.35,
  riseSpeed = 0.05,
  driftSpeed = 0.02,
}: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const [spreadX, spreadY, spreadZ] = spread;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() * 2 - 1) * spreadX;
      arr[i * 3 + 1] = (Math.random() * 2 - 1) * spreadY;
      arr[i * 3 + 2] = (Math.random() * 2 - 1) * spreadZ;
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, spreadX, spreadY, spreadZ]);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    if (riseSpeed !== 0) {
      const attr = points.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const yi = i * 3 + 1;
        arr[yi] += riseSpeed * delta;
        if (arr[yi] > spreadY) arr[yi] -= spreadY * 2;
      }
      attr.needsUpdate = true;
    }
    if (driftSpeed !== 0) points.rotation.y += driftSpeed * delta;
  });

  if (count <= 0) return null;

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
