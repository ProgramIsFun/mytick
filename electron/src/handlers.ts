import * as path from 'path';
import * as fs from 'fs';

export async function handleEnvWrite(
  { filePath, content }: { filePath: string; content: string },
  deps: { existsSync: typeof fs.existsSync; mkdirSync: typeof fs.mkdirSync; writeFileSync: typeof fs.writeFileSync } = fs
): Promise<{ success: boolean; error?: string }> {
  try {
    const dir = path.dirname(filePath);
    if (!deps.existsSync(dir)) {
      deps.mkdirSync(dir, { recursive: true });
    }
    deps.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function handleEnvSelectDirectory(
  dialog: { showOpenDialog: (...args: unknown[]) => Promise<{ canceled: boolean; filePaths: string[] }> }
): Promise<{ path: string } | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return { path: result.filePaths[0] };
}
