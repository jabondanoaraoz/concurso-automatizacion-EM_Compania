import type { Config } from "tailwindcss";

// Tokens de marca E.M. (sección 11). Mapeados desde variables CSS de globals.css
// para que toda la UI use el accent #CC3527 y nunca azules/verdes genéricos.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "var(--em-bg)",
          2: "var(--em-bg-2)",
          3: "var(--em-bg-3)",
        },
        ink: {
          DEFAULT: "var(--em-text)",
          2: "var(--em-text-2)",
          3: "var(--em-text-3)",
        },
        accent: {
          DEFAULT: "var(--em-accent)",
          sec: "var(--em-accent-sec)",
        },
        border: "var(--em-border)",
      },
      fontFamily: {
        title: ["var(--font-outfit)", "system-ui", "sans-serif"],
        body: ["var(--font-dmsans)", "system-ui", "sans-serif"],
      },
      ringColor: {
        focus: "var(--em-focus)",
      },
    },
  },
  plugins: [],
};

export default config;
