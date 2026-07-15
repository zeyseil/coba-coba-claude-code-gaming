import { useEffect, useState } from "react";
import { getStoredTheme, setStoredTheme, applyTheme } from "./theme";

// Owns the theme state: initializes from storage, applies + persists on change.
export function useTheme() {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    setStoredTheme(theme);
  }, [theme]);

  const toggle = () =>
    setTheme((current) => (current === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
