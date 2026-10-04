"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { spring } from "@/lib/motion";

/**
 * Fades and rises its children into place the first time they scroll into
 * view. Under prefers-reduced-motion, MotionConfig (see MotionProvider)
 * drops the movement and keeps the fade.
 */
export default function Reveal({
  delay = 0,
  y = 16,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ ...spring.enter, delay }}
      {...props}
    />
  );
}
