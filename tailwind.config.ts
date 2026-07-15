import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6ff",
          200: "#b8cdff",
          300: "#8aa9ff",
          400: "#5a7fff",
          500: "#3b5bfd",
          600: "#2c41e0",
          700: "#2433b3",
          800: "#212d8c",
          900: "#1f2870",
        },
      },
    },
  },
  plugins: [],
};

export default config;
