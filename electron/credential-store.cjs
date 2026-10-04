const PROVIDER_STORAGE_KEYS = Object.freeze({
  openai: 'openai_key',
  groq: 'groq_key',
  gemini: 'gemini_key',
  openrouter: 'openrouter_key',
  deepinfra: 'deepinfra_key',
  anthropic: 'anthropic_key',
  mistral: 'mistral_key',
  github: 'github_key',
});

const PROVIDER_KEY_NAMES = new Set([
  ...Object.values(PROVIDER_STORAGE_KEYS),
  'jules_api_key',
  'gdash_google_client_secret',
  'gdash_google_tokens',
  'perci_supermemory_api_key',
  'perci_supermemory_openrouter_key',
]);

function isSecureStorageAvailable(safeStorage, platform = process.platform) {
  if (!safeStorage?.isEncryptionAvailable?.()) return false;
  if (platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text') return false;
  return true;
}

function sanitizeAppData(data) {
  return Object.fromEntries(
    Object.entries(data || {}).filter(([key]) => !PROVIDER_KEY_NAMES.has(key))
  );
}

function stripCredentialUpdates(data) {
  return sanitizeAppData(data);
}

function createCredentialStore({ readData, updateData, safeStorage, platform = process.platform } = {}) {
  if (typeof readData !== 'function' || typeof updateData !== 'function') {
    throw new TypeError('Credential storage requires readData and updateData functions.');
  }
  const sessionCredentials = new Map();

  function storageKey(provider) {
    const key = PROVIDER_STORAGE_KEYS[provider];
    if (!key) throw new Error('Unsupported credential provider.');
    return key;
  }

  async function status() {
    const secure = isSecureStorageAvailable(safeStorage, platform);
    const data = secure ? await readData() : {};
    const providers = {};
    for (const [provider, key] of Object.entries(PROVIDER_STORAGE_KEYS)) {
      providers[provider] = sessionCredentials.has(provider) || Boolean(data?.[key]);
    }
    return {
      providers,
      persistence: secure ? 'secure' : 'session-only',
    };
  }

  async function set(provider, secret) {
    const key = storageKey(provider);
    if (typeof secret !== 'string' || secret.length < 1 || secret.length > 20000) {
      throw new Error('Credential must be between 1 and 20000 characters.');
    }

    if (!isSecureStorageAvailable(safeStorage, platform)) {
      sessionCredentials.set(provider, secret);
      return { stored: true, persistence: 'session-only' };
    }

    await updateData({ [key]: secret });
    sessionCredentials.delete(provider);
    return { stored: true, persistence: 'secure' };
  }

  async function remove(provider) {
    const key = storageKey(provider);
    sessionCredentials.delete(provider);
    await updateData({ [key]: null });
    return { stored: false };
  }

  async function withCredential(provider, callback) {
    const key = storageKey(provider);
    const persisted = isSecureStorageAvailable(safeStorage, platform) ? (await readData())?.[key] : '';
    const secret = sessionCredentials.get(provider) || persisted || '';
    if (!secret) throw new Error(`No credential is configured for ${provider}.`);
    return callback(secret);
  }

  return { remove, set, status, withCredential };
}

module.exports = {
  PROVIDER_STORAGE_KEYS,
  createCredentialStore,
  isSecureStorageAvailable,
  sanitizeAppData,
  stripCredentialUpdates,
};
