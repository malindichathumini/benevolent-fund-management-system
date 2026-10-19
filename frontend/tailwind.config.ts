import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Brand blue - #1F4E78 is the thesis's original brand color,
        // kept as the DEFAULT/700 shade so every existing `bg-navy` /
        // `text-navy` / `border-navy` usage still resolves to exactly
        // the same color as before; the surrounding shades are new and
        // used for subtle backgrounds, hover states, and badges.
        navy: {
          50: "#eef4fa",
          100: "#dbe9f4",
          200: "#b3cfe7",
          300: "#86b1d6",
          400: "#5790c0",
          500: "#3972a4",
          600: "#255d89",
          700: "#1F4E78",
          800: "#1a4166",
          900: "#15324f",
          DEFAULT: "#1F4E78",
        },
        // Accent red - #A6342D is the original "maroon" brand color,
        // same DEFAULT-preserving treatment.
        maroon: {
          50: "#fbeceb",
          100: "#f6d4d1",
          200: "#e9a9a3",
          300: "#d97b72",
          400: "#c3544a",
          500: "#A6342D",
          600: "#8f2c26",
          700: "#78241f",
          DEFAULT: "#A6342D",
        },
      },
      fontFamily: {
        // A polished native-font stack instead of a Google-hosted font -
        // no network fetch at build/dev time (this picks up San
        // Francisco on macOS, Segoe UI on Windows, Roboto on Android,
        // etc.), so there's nothing that can fail to download.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
