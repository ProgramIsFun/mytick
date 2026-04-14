import { Slot } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { useEffect } from 'react';
import { initApiUrl } from '../src/api/client';

export default function Layout() {
  useEffect(() => { initApiUrl(); }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </ThemeProvider>
  );
}
