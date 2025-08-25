import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      gridTemplateColumns: {
        // 1 through 48 columns for high-density box grids
        '13': 'repeat(13, minmax(0, 1fr))',
        '14': 'repeat(14, minmax(0, 1fr))',
        '15': 'repeat(15, minmax(0, 1fr))',
        '16': 'repeat(16, minmax(0, 1fr))',
        '17': 'repeat(17, minmax(0, 1fr))',
        '18': 'repeat(18, minmax(0, 1fr))',
        '19': 'repeat(19, minmax(0, 1fr))',
        '20': 'repeat(20, minmax(0, 1fr))',
        '21': 'repeat(21, minmax(0, 1fr))',
        '22': 'repeat(22, minmax(0, 1fr))',
        '23': 'repeat(23, minmax(0, 1fr))',
        '24': 'repeat(24, minmax(0, 1fr))',
        '25': 'repeat(25, minmax(0, 1fr))',
        '26': 'repeat(26, minmax(0, 1fr))',
        '27': 'repeat(27, minmax(0, 1fr))',
        '28': 'repeat(28, minmax(0, 1fr))',
        '29': 'repeat(29, minmax(0, 1fr))',
        '30': 'repeat(30, minmax(0, 1fr))',
        '31': 'repeat(31, minmax(0, 1fr))',
        '32': 'repeat(32, minmax(0, 1fr))',
        '33': 'repeat(33, minmax(0, 1fr))',
        '34': 'repeat(34, minmax(0, 1fr))',
        '35': 'repeat(35, minmax(0, 1fr))',
        '36': 'repeat(36, minmax(0, 1fr))',
        '37': 'repeat(37, minmax(0, 1fr))',
        '38': 'repeat(38, minmax(0, 1fr))',
        '39': 'repeat(39, minmax(0, 1fr))',
        '40': 'repeat(40, minmax(0, 1fr))',
        '41': 'repeat(41, minmax(0, 1fr))',
        '42': 'repeat(42, minmax(0, 1fr))',
        '43': 'repeat(43, minmax(0, 1fr))',
        '44': 'repeat(44, minmax(0, 1fr))',
        '45': 'repeat(45, minmax(0, 1fr))',
        '46': 'repeat(46, minmax(0, 1fr))',
        '47': 'repeat(47, minmax(0, 1fr))',
        '48': 'repeat(48, minmax(0, 1fr))',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: "hsl(var(--primary-50))",
          100: "hsl(var(--primary-100))",
          500: "hsl(var(--primary-500))",
          600: "hsl(var(--primary-600))",
          700: "hsl(var(--primary-700))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          50: "hsl(var(--success-50))",
          500: "hsl(var(--success-500))",
          600: "hsl(var(--success-600))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          50: "hsl(var(--warning-50))",
          500: "hsl(var(--warning-500))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          foreground: "hsl(var(--error-foreground))",
          50: "hsl(var(--error-50))",
          500: "hsl(var(--error-500))",
          600: "hsl(var(--error-600))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "scan-success": "scan-success 0.3s ease-out",
        "scan-error": "scan-error 0.3s ease-out", 
        "pulse-success": "pulse-success 2s ease-in-out infinite",
      },
      keyframes: {
        "scan-success": {
          "0%": { backgroundColor: "transparent", transform: "scale(1)" },
          "50%": { backgroundColor: "hsl(var(--success))", transform: "scale(1.05)" },
          "100%": { backgroundColor: "transparent", transform: "scale(1)" },
        },
        "scan-error": {
          "0%": { backgroundColor: "transparent", transform: "scale(1)" },
          "50%": { backgroundColor: "hsl(var(--error))", transform: "scale(1.05)" },
          "100%": { backgroundColor: "transparent", transform: "scale(1)" },
        },
        "pulse-success": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      screens: {
        'xs': '320px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      zIndex: {
        '100': '100',
      },
      backdropBlur: {
        'xs': '2px',
      },
      transitionDuration: {
        '2000': '2000ms',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"), 
    require("@tailwindcss/typography"),
    // Plugin for custom utilities
    function({ addUtilities }: any) {
      const newUtilities = {
        '.gradient-primary': {
          background: 'linear-gradient(135deg, hsl(var(--primary-50)) 0%, hsl(var(--primary-100)) 100%)',
        },
        '.gradient-success': {
          background: 'linear-gradient(135deg, hsl(var(--success-50)) 0%, hsl(var(--success)) 20%)',
        },
        '.focus-ring': {
          '@apply focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2': {},
        },
        '.scan-feedback-success': {
          animation: 'scan-success 0.3s ease-out',
        },
        '.scan-feedback-error': {
          animation: 'scan-error 0.3s ease-out',
        },
      }
      addUtilities(newUtilities)
    }
  ],
} satisfies Config;
