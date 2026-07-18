import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';

interface EnvFile {
  id: string;
  repoId: string;
  path: string;
  createdAt: string;
}

interface EnvVar {
  id: string;
  envFileId: string;
  key: string;
  value?: string;
  isSecret: boolean;
  secretId?: string;
  comment?: string;
  order: number;
}

interface Repo {
  id: string;
  url: string;
}

export default function EnvFilesView() {
  const { c } = useTheme();
  const [envFiles, setEnvFiles] = useState<EnvFile[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [varsMap, setVarsMap] = useState<Record<string, EnvVar[]>>({});
  const [newPath, setNewPath] = useState('');
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [reconstructModal, setReconstructModal] = useState<{ path: string; content: string } | null>(null);
  const [addVarFileId, setAddVarFileId] = useState<string | null>(null);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  const loadFiles = useCallback(async () => {
    try {
      const [files, repoList] = await Promise.all([api.getEnvFiles(), api.getRepos()]);
      setEnvFiles(files);
      setRepos(repoList);
      if (repoList.length > 0 && !selectedRepoId) setSelectedRepoId(repoList[0].id);
    } catch {}
  }, [selectedRepoId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const loadVars = async (fileId: string) => {
    try {
      const vars = await api.getEnvVars(fileId);
      setVarsMap(prev => ({ ...prev, [fileId]: vars }));
    } catch {}
  };

  const toggleExpand = (fileId: string) => {
    if (expandedId === fileId) {
      setExpandedId(null);
    } else {
      setExpandedId(fileId);
      if (!varsMap[fileId]) loadVars(fileId);
    }
  };

  const handleCreateFile = async () => {
    const path = newPath.trim();
    if (!path || !selectedRepoId) return;
    try {
      await api.createEnvFile({ repoId: selectedRepoId, path });
      setNewPath('');
      loadFiles();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleDeleteFile = (file: EnvFile) => {
    Alert.alert('Delete Env File', `Delete "${file.path}"? This will also delete all its variables.`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteEnvFile(file.id); loadFiles(); } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const handleReconstruct = async (fileId: string) => {
    try {
      const result = await api.reconstructFile(fileId);
      setReconstructModal({ path: result.path, content: result.content });
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleAddVar = async () => {
    if (!addVarFileId || !newVarKey.trim()) return;
    try {
      const vars = varsMap[addVarFileId] || [];
      await api.createEnvVar(addVarFileId, {
        key: newVarKey.trim(),
        value: newVarValue.trim() || undefined,
        order: vars.length,
      });
      setNewVarKey('');
      setNewVarValue('');
      setAddVarFileId(null);
      loadVars(addVarFileId);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleDeleteVar = (envFileId: string, varId: string) => {
    Alert.alert('Delete Variable', 'Delete this variable?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteEnvVar(envFileId, varId); loadVars(envFileId); } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const getRepoUrl = (repoId: string) => repos.find(r => r.id === repoId)?.url || repoId;
  const getFileName = (path: string) => path.split('/').pop() || path;

  // Group env files by repo
  const filesByRepo = envFiles.reduce<Record<string, EnvFile[]>>((acc, f) => {
    (acc[f.repoId] = acc[f.repoId] || []).push(f);
    return acc;
  }, {});

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.addRow, { borderColor: c.inputBorder }]}>
        <TextInput
          style={[s.input, { borderColor: c.inputBorder, color: c.text, backgroundColor: c.btnBg }]}
          placeholder="File path (e.g. .env, backend/.env.local)"
          placeholderTextColor={c.textMuted}
          value={newPath}
          onChangeText={setNewPath}
        />
        <TouchableOpacity style={[s.addBtn, { backgroundColor: c.link }]} onPress={handleCreateFile}>
          <Text style={s.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {repos.length > 1 && (
        <View style={s.repoSelector}>
          {repos.map(r => (
            <TouchableOpacity
              key={r.id}
              onPress={() => setSelectedRepoId(r.id)}
              style={[s.repoChip, selectedRepoId === r.id && { backgroundColor: c.link }]}
            >
              <Text style={[s.repoChipText, selectedRepoId === r.id && { color: '#fff' }]} numberOfLines={1}>
                {getFileName(r.url.replace(/\.git$/, ''))}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {Object.keys(filesByRepo).length === 0 ? (
        <Text style={[s.empty, { color: c.textMuted }]}>No env files yet. Create one above.</Text>
      ) : (
        <FlatList
          data={Object.entries(filesByRepo)}
          keyExtractor={([repoId]) => repoId}
          renderItem={([repoId, files]) => (
            <View style={[s.repoSection, { borderColor: c.border }]}>
              <Text style={[s.repoLabel, { color: c.textSecondary }]} numberOfLines={1}>
                {getRepoUrl(repoId)}
              </Text>
              {files.map(file => (
                <View key={file.id} style={[s.fileCard, { backgroundColor: c.btnBg, borderColor: c.border }]}>
                  <TouchableOpacity style={s.fileHeader} onPress={() => toggleExpand(file.id)}>
                    <Text style={[s.fileName, { color: c.text }]}>{file.path}</Text>
                    <Text style={s.chevron}>{expandedId === file.id ? '▼' : '▶'}</Text>
                  </TouchableOpacity>

                  {expandedId === file.id && (
                    <View style={s.expanded}>
                      {(varsMap[file.id] || []).map((v: EnvVar) => (
                        <View key={v.id} style={[s.varRow, { borderBottomColor: c.border }]}>
                          {v.comment ? <Text style={[s.varComment, { color: c.textMuted }]}># {v.comment}</Text> : null}
                          <View style={s.varLine}>
                            <Text style={[s.varKey, { color: c.link }]}>{v.key}=</Text>
                            <Text style={[s.varValue, { color: c.text }]} numberOfLines={1}>
                              {v.isSecret ? '••••••••' : (v.value || '')}
                            </Text>
                            {v.isSecret ? <Text style={s.secretBadge}>🔒</Text> : null}
                            <TouchableOpacity onPress={() => handleDeleteVar(file.id, v.id)}>
                              <Text style={s.deleteVarBtn}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}

                      {addVarFileId === file.id ? (
                        <View style={s.addVarForm}>
                          <TextInput
                            style={[s.varInput, { borderColor: c.inputBorder, color: c.text }]}
                            placeholder="KEY"
                            placeholderTextColor={c.textMuted}
                            value={newVarKey}
                            onChangeText={setNewVarKey}
                            autoCapitalize="none"
                          />
                          <TextInput
                            style={[s.varInput, { borderColor: c.inputBorder, color: c.text }]}
                            placeholder="value (optional)"
                            placeholderTextColor={c.textMuted}
                            value={newVarValue}
                            onChangeText={setNewVarValue}
                            autoCapitalize="none"
                          />
                          <View style={s.addVarActions}>
                            <TouchableOpacity onPress={() => { setAddVarFileId(null); setNewVarKey(''); setNewVarValue(''); }}>
                              <Text style={[s.cancelText, { color: c.textMuted }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.saveBtn, { backgroundColor: c.link }]} onPress={handleAddVar}>
                              <Text style={s.saveBtnText}>Save</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity style={[s.addVarBtn, { borderColor: c.link }]} onPress={() => setAddVarFileId(file.id)}>
                          <Text style={[s.addVarBtnText, { color: c.link }]}>+ Add Variable</Text>
                        </TouchableOpacity>
                      )}

                      <View style={s.fileActions}>
                        <TouchableOpacity style={[s.reconstructBtn, { backgroundColor: c.link }]} onPress={() => handleReconstruct(file.id)}>
                          <Text style={s.reconstructBtnText}>Reconstruct</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.deleteFileBtn} onPress={() => handleDeleteFile(file)}>
                          <Text style={s.deleteFileBtnText}>Delete File</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        />
      )}

      <Modal visible={!!reconstructModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: c.bg }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: c.text }]}>{reconstructModal?.path}</Text>
              <TouchableOpacity onPress={() => setReconstructModal(null)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={[s.codeBlock, { backgroundColor: c.btnBg, borderColor: c.border }]}>
              <Text style={[s.codeText, { color: c.text }]} selectable>{reconstructModal?.content}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  addBtn: { borderRadius: 8, width: 44, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 22 },
  repoSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  repoChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#e0e0e0' },
  repoChipText: { fontSize: 12, color: '#666' },
  repoSection: { marginBottom: 16 },
  repoLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fileCard: { borderWidth: 1, borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
  fileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  fileName: { fontSize: 15, fontWeight: '500' },
  chevron: { fontSize: 12, color: '#888' },
  expanded: { paddingHorizontal: 12, paddingBottom: 12 },
  varRow: { paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  varComment: { fontSize: 12, marginBottom: 2 },
  varLine: { flexDirection: 'row', alignItems: 'center' },
  varKey: { fontFamily: 'monospace', fontSize: 14, fontWeight: '600' },
  varValue: { fontFamily: 'monospace', fontSize: 14, flex: 1 },
  secretBadge: { fontSize: 12, marginLeft: 4 },
  deleteVarBtn: { color: '#ff3b30', fontSize: 14, paddingHorizontal: 8 },
  addVarBtn: { borderWidth: 1, borderRadius: 6, padding: 8, marginTop: 8, alignItems: 'center', borderStyle: 'dashed' },
  addVarBtnText: { fontSize: 13 },
  addVarForm: { marginTop: 8, gap: 6 },
  varInput: { borderWidth: 1, borderRadius: 6, padding: 8, fontSize: 14, fontFamily: 'monospace' },
  addVarActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelText: { fontSize: 14, padding: 6 },
  saveBtn: { borderRadius: 6, paddingHorizontal: 14, paddingVertical: 6 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  fileActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  reconstructBtn: { borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8 },
  reconstructBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  deleteFileBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  deleteFileBtnText: { color: '#ff3b30', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '600' },
  modalClose: { fontSize: 22, color: '#888' },
  codeBlock: { borderWidth: 1, borderRadius: 8, padding: 12 },
  codeText: { fontFamily: 'monospace', fontSize: 13, lineHeight: 20 },
});
