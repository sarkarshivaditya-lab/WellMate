/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

  safelist: [
    "bg-red-500",
    "bg-green-500",
    "bg-emerald-500",
    "text-white",
    "p-2",
    "p-4",
    "p-8",
  ],

  theme: {
    extend: {
      colors: {
        /* ===============================
           CORE SEMANTIC TOKENS
           =============================== */
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",

        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",

        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",

        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",

        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",

        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",

        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",

        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        /* ===============================
           PAGE HEADER GRADIENT (REQUIRED)
           =============================== */
        "header-gradient-start": "hsl(var(--header-gradient-start))",
        "header-gradient-end": "hsl(var(--header-gradient-end))",
      },
    },
  },

  plugins: [require("@tailwindcss/typography")],
};
