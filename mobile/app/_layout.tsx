import { Slot } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';

export default function Layout() {
  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}
