import { heroui } from "@heroui/theme/plugin";

/**
 * HeroUI's semantic tokens mapped onto the daylight palette, so every component
 * it renders inherits parchment, ink, tekhelet and olive instead of stock blue.
 */
export default heroui({
  defaultTheme: "light",
  defaultExtendTheme: "light",
  themes: {
    light: {
      colors: {
        background: "#FDFAF3",
        foreground: "#211E18",
        divider: "rgba(33, 30, 24, 0.12)",
        focus: "#0038B8",
        overlay: "#211E18",
        content1: "#FFFDF8",
        content2: "#F7F1E3",
        content3: "#F0E7D4",
        content4: "#E0D6C1",
        default: {
          50: "#FDFAF3",
          100: "#F7F1E3",
          200: "#F0E7D4",
          300: "#E0D6C1",
          400: "#8B8374",
          500: "#6B6453",
          600: "#464036",
          700: "#332E26",
          800: "#211E18",
          900: "#161310",
          DEFAULT: "#F0E7D4",
          foreground: "#211E18",
        },
        // Tekhelet carries every primary action.
        primary: {
          50: "#E8F0FB",
          100: "#CBDCF5",
          200: "#A9C4EE",
          300: "#83AAE9",
          400: "#5B8DE0",
          500: "#2B60CC",
          600: "#0038B8",
          700: "#093A9B",
          800: "#062A73",
          900: "#04204F",
          DEFAULT: "#0038B8",
          foreground: "#FDFAF3",
        },
        // Olive: the leaf, and anything that marks something added or chosen.
        success: {
          50: "#ECF2DF",
          100: "#DCE8C7",
          200: "#A8C47E",
          300: "#8AAC5C",
          400: "#6B8F3F",
          500: "#5A7B33",
          600: "#47661F",
          700: "#3A5418",
          800: "#2C4111",
          900: "#1F2E0B",
          DEFAULT: "#6B8F3F",
          foreground: "#FDFAF3",
        },
        // Sun: warmth. Labels and small marks, never a whole surface.
        warning: {
          DEFAULT: "#E0A03C",
          foreground: "#211E18",
        },
      },
      layout: {
        // Nearly square corners — closer to paper than to software.
        radius: { small: "2px", medium: "3px", large: "4px" },
        borderWidth: { small: "1px", medium: "1px", large: "2px" },
      },
    },
  },
});
