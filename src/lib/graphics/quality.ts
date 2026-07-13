import type { GraphicsQuality } from "@/stores/graphicsStore";

// Central definition of what each graphics tier controls. New effects (SSAO,
// motion blur, etc.) should read their tuning from here too, rather than
// branching on `quality` ad hoc at the call site.
export interface QualityPreset {
  bloom: {
    enabled: boolean;
    intensity: number; // overall bloom strength
    luminanceThreshold: number; // pixel brightness (0-1) before it starts blooming
    luminanceSmoothing: number; // soft knee around the threshold, avoids a hard cutoff edge
    mipmapBlur: boolean; // smoother/cheaper blur via a mip chain instead of multiple blur passes
  };
  shadows: {
    enabled: boolean;
    mapSize: number; // shadow map resolution (square), the main perf/quality knob
    bias: number; // depth bias — pushes shadow acne away without introducing peter-panning
    normalBias: number;
  };
  particles: {
    densityMultiplier: number; // 0-1, scales every particle system's base count
  };
}

export const QUALITY_PRESETS: Record<GraphicsQuality, QualityPreset> = {
  low: {
    bloom: { enabled: false, intensity: 0, luminanceThreshold: 1, luminanceSmoothing: 0.2, mipmapBlur: false },
    shadows: { enabled: false, mapSize: 512, bias: -0.0005, normalBias: 0.02 },
    particles: { densityMultiplier: 0 },
  },
  medium: {
    bloom: { enabled: true, intensity: 0.5, luminanceThreshold: 0.85, luminanceSmoothing: 0.3, mipmapBlur: true },
    shadows: { enabled: true, mapSize: 1024, bias: -0.0004, normalBias: 0.02 },
    particles: { densityMultiplier: 0.6 },
  },
  high: {
    bloom: { enabled: true, intensity: 0.85, luminanceThreshold: 0.75, luminanceSmoothing: 0.35, mipmapBlur: true },
    shadows: { enabled: true, mapSize: 2048, bias: -0.0003, normalBias: 0.015 },
    particles: { densityMultiplier: 1 },
  },
};

export function getQualityPreset(quality: GraphicsQuality): QualityPreset {
  return QUALITY_PRESETS[quality];
}
