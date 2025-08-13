export const themes = {
  blue: {
    primary: {
      50: "#eff6ff",
      100: "#dbeafe", 
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
    },
    success: {
      50: "#ecfdf5",
      500: "#10b981",
      600: "#059669",
    },
    warning: {
      50: "#fffbeb",
      500: "#f59e0b",
    },
    error: {
      50: "#fef2f2",
      500: "#ef4444",
      600: "#dc2626",
    },
  },
  green: {
    primary: {
      50: "#ecfdf5",
      100: "#d1fae5",
      500: "#10b981",
      600: "#059669", 
      700: "#047857",
    },
    success: {
      50: "#ecfdf5",
      500: "#10b981",
      600: "#059669",
    },
    warning: {
      50: "#fffbeb",
      500: "#f59e0b",
    },
    error: {
      50: "#fef2f2",
      500: "#ef4444",
      600: "#dc2626",
    },
  },
  orange: {
    primary: {
      50: "#fff7ed",
      100: "#ffedd5",
      500: "#f59e0b",
      600: "#d97706",
      700: "#b45309",
    },
    success: {
      50: "#ecfdf5",
      500: "#10b981",
      600: "#059669",
    },
    warning: {
      50: "#fffbeb",
      500: "#f59e0b",
    },
    error: {
      50: "#fef2f2",
      500: "#ef4444",
      600: "#dc2626",
    },
  },
  teal: {
    primary: {
      50: "#f0fdfa",
      100: "#ccfbf1",
      500: "#14b8a6",
      600: "#0d9488",
      700: "#0f766e",
    },
    success: {
      50: "#ecfdf5",
      500: "#10b981",
      600: "#059669",
    },
    warning: {
      50: "#fffbeb",
      500: "#f59e0b",
    },
    error: {
      50: "#fef2f2",
      500: "#ef4444",
      600: "#dc2626",
    },
  },
  red: {
    primary: {
      50: "#fef2f2",
      100: "#fee2e2",
      500: "#ef4444",
      600: "#dc2626",
      700: "#b91c1c",
    },
    success: {
      50: "#ecfdf5",
      500: "#10b981",
      600: "#059669",
    },
    warning: {
      50: "#fffbeb",
      500: "#f59e0b",
    },
    error: {
      50: "#fef2f2",
      500: "#ef4444",
      600: "#dc2626",
    },
  },
  dark: {
    primary: {
      50: "#f9fafb",
      100: "#f3f4f6",
      500: "#6b7280",
      600: "#4b5563",
      700: "#374151",
    },
    success: {
      50: "#ecfdf5",
      500: "#10b981",
      600: "#059669",
    },
    warning: {
      50: "#fffbeb",
      500: "#f59e0b",
    },
    error: {
      50: "#fef2f2",
      500: "#ef4444",
      600: "#dc2626",
    },
  },
};

export type ThemeName = keyof typeof themes;
