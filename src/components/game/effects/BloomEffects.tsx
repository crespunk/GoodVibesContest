"use client";

import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { KernelSize } from "postprocessing";
import { useGraphicsStore } from "@/stores/graphicsStore";
import { getQualityPreset } from "@/lib/graphics/quality";

// Luminance-threshold bloom: only pixels brighter than the threshold contribute
// to the glow, so this naturally picks out emissive displays/panels/accent
// lights without blooming the whole (mostly dark) scene or needing per-mesh
// selective bloom (layers/<Select>) wiring. Tuned to stay "subtle sci-fi tech"
// rather than an overexposed haze — see QUALITY_PRESETS for the actual values.
export function BloomEffects() {
  const quality = useGraphicsStore((s) => s.quality);
  const preset = getQualityPreset(quality).bloom;

  if (!preset.enabled) return null;

  return (
    <EffectComposer>
      <Bloom
        intensity={preset.intensity}
        luminanceThreshold={preset.luminanceThreshold}
        luminanceSmoothing={preset.luminanceSmoothing}
        mipmapBlur={preset.mipmapBlur}
        kernelSize={KernelSize.MEDIUM}
      />
    </EffectComposer>
  );
}
