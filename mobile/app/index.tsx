import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/api/client';
import { Redirect, useRouter } from 'expo-router';

export default function Login() {
  const { user, loading, login } = useAuth();
  const { c } = useTheme();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  if (loading) return <View style={[s.center, { backgroundColor: c.bg }]}><Text style={{ color: c.text }}>Loading...</Text></View>;
  if (user) return <Redirect href="/tasks" />;

  const handleSubmit = async () => {
    try {
      if (isRegister) {
        const res = await api.register({ email, password, name, username });
        await login(email, password);
      } else {
        await login(email, password);
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      <Text style={[s.title, { color: c.text }]}>MyTick</Text>
      {isRegister && (
        <>
          <TextInput style={s.input} placeholder="Name" value={name} onChangeText={setName} />
          <TextInput style={s.input} placeholder="Username (e.g. john-doe)" value={username}
            onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9-]/g, ''))} autoCapitalize="none" />
        </>
      )}
      <TextInput style={s.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={s.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={s.btn} onPress={handleSubmit}>
        <Text style={s.btnText}>{isRegister ? 'Register' : 'Login'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setIsRegister(!isRegister)} style={{ marginTop: 16 }}>
        <Text style={s.link}>{isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  btn: { backgroundColor: '#1a73e8', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  link: { color: '#1a73e8', textAlign: 'center' },
});
