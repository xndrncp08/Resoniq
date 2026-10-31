import type { IconName } from "@/components/icons/Icon";

export const CATEGORY_META: Record<string, { label: string; icon: IconName }> = {
  DISCUSSION: { label: "Discussion", icon: "comment" },
  QUESTION: { label: "Question", icon: "info" },
  PERFORMANCE: { label: "Performance", icon: "video" },
  COVER: { label: "Cover", icon: "audio" },
  GEAR_DEMO: { label: "Gear demo", icon: "pedal" },
  TONE_COMPARISON: { label: "Tone A/B", icon: "compare" },
  TUTORIAL: { label: "Tutorial", icon: "knob" },
  PEDALBOARD: { label: "Board tour", icon: "signal-chain" },
  ORIGINAL: { label: "Original music", icon: "waveform" },
};
