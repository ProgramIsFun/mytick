import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getApiUrl, getDefaultApiUrl, setApiUrl, resetApiUrl } from '../src/api/client';
import Constants from 'expo-constants';

export default function DebugScreen() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [current, setCurrent] = useState('');

  useEffect(() => {
    setCurrent(getApiUrl());
    setUrl(getApiUrl());
  }, []);

  const handleSave = async () => {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!trimmed) return;
    await setApiUrl(trimmed);
    setCurrent(trimmed);
    Alert.alert('Saved', `API URL set to:\n${trimmed}\n\nRestart the app for full effect.`);
  };

  const handleReset = async () => {
    await resetApiUrl();
    const def = getDefaultApiUrl();
    setUrl(def);
    setCurrent(def);
    Alert.alert('Reset', `API URL reset to default:\n${def}`);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>🛠 Debug</Text>

      <Text style={styles.label}>Current API URL</Text>
      <Text style={styles.value}>{current}</Text>

      <Text style={styles.label}>Default API URL</Text>
      <Text style={styles.value}>{getDefaultApiUrl()}</Text>

      <Text style={styles.label}>App Version</Text>
      <Text style={styles.value}>{Constants.expoConfig?.version ?? 'unknown'}</Text>

      <Text style={[styles.label, { marginTop: 24 }]}>Change API URL</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="https://your-backend.com/api"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity style={styles.btn} onPress={handleSave}>
        <Text style={styles.btnText}>Save</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.resetBtn]} onPress={handleReset}>
        <Text style={styles.btnText}>Reset to Default</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  back: { marginBottom: 16 },
  backText: { fontSize: 16, color: '#007AFF' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  label: { fontSize: 12, color: '#888', marginTop: 12 },
  value: { fontSize: 14, fontFamily: 'monospace', marginTop: 2, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 14, marginTop: 8, fontFamily: 'monospace' },
  btn: { backgroundColor: '#007AFF', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  resetBtn: { backgroundColor: '#FF3B30' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
