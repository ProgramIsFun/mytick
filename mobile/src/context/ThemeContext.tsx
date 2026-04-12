import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

type Theme = 'light' | 'dark';

const colors = {
  light: {
    bg: '#fafafa', bgSecondary: '#f5f5f5', text: '#222', textSecondary: '#666',
    textMuted: '#888', border: '#eee', inputBorder: '#ddd', btnBg: '#fff',
    link: '#1a73e8', danger: 'red', taskPending: '#fff3e0', taskDone: '#e8f5e9', todayBg: '#e8f0fe',
  },
  dark: {
    bg: '#1a1a1a', bgSecondary: '#2a2a2a', text: '#e0e0e0', textSecondary: '#aaa',
    textMuted: '#777', border: '#333', inputBorder: '#555', btnBg: '#2a2a2a',
    link: '#6db3f2', danger: '#f44', taskPending: '#3a2a00', taskDone: '#1a3a1a', todayBg: '#1a2a3a',
  },
};

interface ThemeContextType {
  theme: Theme;
  c: typeof colors.light;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>(null!);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [theme, setTheme] = useState<Theme>(system === 'dark' ? 'dark' : 'light');
  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, c: colors[theme], toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
