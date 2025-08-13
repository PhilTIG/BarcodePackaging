import { createContext, useContext, useEffect, useState } from "react";

type Theme = "blue" | "green" | "orange" | "teal" | "red" | "dark";

type ThemeProviderContext = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderContext | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme");
    return (stored as Theme) || "blue";
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove("theme-blue", "theme-green", "theme-orange", "theme-teal", "theme-red", "theme-dark");
    
    // Add current theme class
    root.classList.add(`theme-${theme}`);
    
    // Store in localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  const value = {
    theme,
    setTheme,
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
