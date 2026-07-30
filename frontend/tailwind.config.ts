import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0D12",
        "bg-elevated": "#12161D",
        copper: {
          DEFAULT: "#FF8A3D",
          dim: "#B85E1F",
        },
        signal: "#37E6C9",
        muted: "#8B93A1",
        ink: "#F3EFE8",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        panel: "22px",
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(255,138,61,0.35)",
        panel: "0 8px 32px -8px rgba(0,0,0,0.5)",
      },
      backgroundImage: {
        "grain": "url('/textures/grain.png')",
      },
    },
  },
  plugins: [],
};
export default config;
