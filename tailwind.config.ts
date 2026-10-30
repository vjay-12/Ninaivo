import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#08080A",
        },
        surface: {
          DEFAULT: "#111216",
          2: "#1A1C22",
          3: "#232630",
        },
        m: {
          light: "#4FA3FF",
          dark: "#0B3A82",
          red: "#E4101E",
        },
        text: {
          DEFAULT: "#F3F5F8",
        },
        muted: {
          DEFAULT: "#8A92A3",
        },
      },
      fontFamily: {
        heading: ["var(--font-barlow)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      backgroundImage: {
        "m-stripe": "linear-gradient(115deg, #4FA3FF 0%, #4FA3FF 33.33%, #0B3A82 33.33%, #0B3A82 66.66%, #E4101E 66.66%, #E4101E 100%)",
        "m-stripe-h": "linear-gradient(90deg, #4FA3FF 0%, #4FA3FF 33.33%, #0B3A82 33.33%, #0B3A82 66.66%, #E4101E 66.66%, #E4101E 100%)",
      },
      animation: {
        "pulse-subtle": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
export default config;

