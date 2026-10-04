"use client";

import { MotionConfig } from "framer-motion";

/**
 * reducedMotion="user": when the OS asks for reduced motion, every Framer
 * Motion animation in the app skips transform and layout movement and keeps
 * only opacity/color changes. globals.css's media query only covers CSS
 * transitions; this covers the JS-driven ones.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
