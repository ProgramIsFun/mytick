import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { Redirect } from 'expo-router';

export default function Login() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (loading) return <View style={s.container}><Text>Loading...</Text></View>;
  if (user) return <Redirect href="/tasks" />;

  const handleLogin = async () => {
    try { await login(email, password); }
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>MyTick</Text>
      <TextInput style={s.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={s.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={s.btn} onPress={handleLogin}>
        <Text style={s.btnText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  btn: { backgroundColor: '#1a73e8', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
