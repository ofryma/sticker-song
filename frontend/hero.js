import { heroui } from "@heroui/theme/plugin";

/**
 * HeroUI's semantic tokens mapped onto the memorial palette, so every component
 * it renders inherits the night-vigil theme instead of the stock blue.
 */
export default heroui({
  defaultTheme: "dark",
  defaultExtendTheme: "dark",
  themes: {
    dark: {
      colors: {
        background: "#0A0F1C",
        foreground: "#E2D9C8",
        divider: "rgba(226, 217, 200, 0.14)",
        focus: "#F0BE6B",
        overlay: "#05080F",
        content1: "#111829",
        content2: "#18202F",
        content3: "#252E40",
        content4: "#323C50",
        default: {
          50: "#111829",
          100: "#18202F",
          200: "#252E40",
          300: "#323C50",
          400: "#7C7160",
          500: "#A2957D",
          600: "#C8BCA6",
          700: "#E2D9C8",
          800: "#F2EDE3",
          900: "#FBF8F2",
          DEFAULT: "#18202F",
          foreground: "#E2D9C8",
        },
        // Tekhelet carries every primary action.
        primary: {
          50: "#04204F",
          100: "#062A73",
          200: "#093A9B",
          300: "#0038B8",
          400: "#2B60CC",
          500: "#5B8DE0",
          600: "#83AAE9",
          700: "#A9C4EE",
          800: "#CBDCF5",
          900: "#E8F0FB",
          DEFAULT: "#0038B8",
          foreground: "#FBF8F2",
        },
        // The candle. Reserved for memorial gestures, never for chrome.
        warning: {
          DEFAULT: "#F0BE6B",
          foreground: "#0A0F1C",
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
