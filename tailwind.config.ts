import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ischia: {
          navy: "#083f73",
          blue: "#0b67a3",
          aqua: "#20b7bf",
          sand: "#f6d68b",
          sun: "#f4b63f",
          coral: "#ee735d",
          leaf: "#25d366",
          ink: "#17324d",
          mist: "#eef8fb"
        }
      },
      boxShadow: {
        soft: "0 18px 45px rgba(8, 63, 115, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
