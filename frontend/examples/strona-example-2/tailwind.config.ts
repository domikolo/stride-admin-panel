import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        // Domyślne Tailwind breakpointy:
        // sm: '640px'   - mobile/tablet
        // md: '768px'   - tablet landscape
        // lg: '1024px'  - laptop small
        // xl: '1280px'  - laptop 14" standard
        // 2xl: '1536px' - desktop 23" (1920x1080) - KLUCZOWY breakpoint

        // Custom breakpoint dla większych monitorów:
        '3xl': '1920px',  // desktop Full HD+ i większe monitory (>24")
      },
    },
  },
  plugins: [],
};

export default config;
