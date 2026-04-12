import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';

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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('theme').then(saved => {
      if (saved === 'light' || saved === 'dark') setTheme(saved);
      setLoaded(true);
    });
  }, []);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    SecureStore.setItemAsync('theme', next);
  };

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, c: colors[theme], toggle }}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
