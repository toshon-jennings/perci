import { describe, expect, it, vi } from 'vitest';
import credentialStore from '../electron/credential-store.cjs';

const { createCredentialStore, isSecureStorageAvailable, sanitizeAppData } = credentialStore;

function fixture({ secure = true, platform = 'darwin', backend = 'keychain', initial = {} } = {}) {
  let data = { ...initial };
  const writeData = vi.fn(async patch => { data = { ...data, ...patch }; });
  const store = createCredentialStore({
    readData: async () => ({ ...data }),
    updateData: writeData,
    platform,
    safeStorage: {
      isEncryptionAvailable: () => secure,
      getSelectedStorageBackend: () => backend,
    },
  });
  return { store, writeData, read: () => data };
}

describe('credential store', () => {
  it('never includes provider secrets in renderer app-data', () => {
    expect(sanitizeAppData({ openai_key: 'secret', theme: 'dark', github_key: 'token', jules_api_key: 'secret', gdash_google_client_secret: 'secret', gdash_google_tokens: 'secret', perci_supermemory_api_key: 'secret' })).toEqual({ theme: 'dark' });
  });

  it('persists through the protected data writer when OS encryption is meaningful', async () => {
    const { store, writeData, read } = fixture();
    await expect(store.set('openai', 'synthetic-key')).resolves.toEqual({ stored: true, persistence: 'secure' });
    expect(writeData).toHaveBeenCalledOnce();
    expect(read().openai_key).toBe('synthetic-key');
    await expect(store.withCredential('openai', async secret => `used:${secret.length}`)).resolves.toBe('used:13');
  });

  it('fails closed to session-only storage when encryption is unavailable', async () => {
    const { store, writeData, read } = fixture({ secure: false, initial: { anthropic_key: 'legacy-plaintext' } });
    await expect(store.status()).resolves.toMatchObject({ providers: { anthropic: false }, persistence: 'session-only' });
    await expect(store.withCredential('anthropic', secret => secret)).rejects.toThrow('No credential');
    await expect(store.set('anthropic', 'session-secret')).resolves.toEqual({ stored: true, persistence: 'session-only' });
    expect(writeData).not.toHaveBeenCalled();
    expect(read()).toEqual({ anthropic_key: 'legacy-plaintext' });
    await expect(store.withCredential('anthropic', secret => secret.length)).resolves.toBe(14);
  });

  it('treats Linux basic_text as insecure even when Electron reports encryption', () => {
    expect(isSecureStorageAvailable({
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => 'basic_text',
    }, 'linux')).toBe(false);
  });

  it('returns status booleans and deletes only the selected provider', async () => {
    const { store, read } = fixture({ initial: { openai_key: 'one', groq_key: 'two', theme: 'light' } });
    await expect(store.status()).resolves.toMatchObject({
      providers: { openai: true, groq: true, anthropic: false },
      persistence: 'secure',
    });
    await store.remove('openai');
    expect(read()).toMatchObject({ openai_key: null, groq_key: 'two', theme: 'light' });
  });

  it('rejects unsupported providers and oversized values', async () => {
    const { store } = fixture();
    await expect(store.set('unknown', 'x')).rejects.toThrow('Unsupported');
    await expect(store.set('openai', 'x'.repeat(20001))).rejects.toThrow('between 1 and 20000');
  });
});
