import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

function AuthInner({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { unregister } = usePushNotifications();

  useEffect(() => {
    SecureStore.getItemAsync('token').then(async (token) => {
      if (token) {
        try {
          const u = await api.getMe();
          setUser(u);
        } catch {
          await SecureStore.deleteItemAsync('token');
        }
      }
      setLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    await SecureStore.setItemAsync('token', res.token);
    setUser(res.user);
  };

  const logout = async () => {
    await unregister();
    await SecureStore.deleteItemAsync('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthInner>{children}</AuthInner>;
}

export const useAuth = () => useContext(AuthContext);
