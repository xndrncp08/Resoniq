"use client";

import dynamic from "next/dynamic";

/**
 * Panels shown only for tones inferred from an analysed song. Split here, in a client module, so
 * declared and generated tones never download their knob/EQ animation code (GSAP, Motion);
 * when a tone does use them they still render on the server.
 */
export const AmpPanel = dynamic(() => import("@/components/tone/AmpPanel"));
export const Pedalboard = dynamic(() => import("@/components/tone/Pedalboard"));
