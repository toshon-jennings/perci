export const MAX_OUTBOUND_FILES = 20;
export const MAX_OUTBOUND_FILE_BYTES = 512 * 1024;
export const MAX_OUTBOUND_TOTAL_BYTES = 2 * 1024 * 1024;

const SENSITIVE_BASENAMES = new Set([
    '.env', 'id_rsa', 'id_ed25519', 'credentials', 'credentials.json', 'secrets.json',
    'login data', 'cookies', 'keychain-db',
]);
const SENSITIVE_EXTENSIONS = new Set(['pem', 'key', 'p12', 'pfx', 'jks', 'keystore', 'kdbx']);
const SENSITIVE_SEGMENTS = new Set(['.ssh', '.aws', '.azure', '.config/gcloud', 'browser profiles']);

export class OutboundDataBlockedError extends Error {
    constructor(message, { findings = [], overrideAllowed = false } = {}) {
        super(message);
        this.name = 'OutboundDataBlockedError';
        this.findings = findings;
        this.overrideAllowed = overrideAllowed;
    }
}

export function isSensitivePath(relativePath) {
    const normalized = String(relativePath || '').replaceAll('\\', '/').toLowerCase();
    const parts = normalized.split('/').filter(Boolean);
    const basename = parts.at(-1) || '';
    const extension = basename.includes('.') ? basename.split('.').at(-1) : '';
    if (basename === '.env' || basename.startsWith('.env.')) return true;
    if (SENSITIVE_BASENAMES.has(basename) || SENSITIVE_EXTENSIONS.has(extension)) return true;
    if (parts.some(part => SENSITIVE_SEGMENTS.has(part)) || normalized.includes('/.config/gcloud/')) return true;
    return /(?:^|[._-])(credential|credentials|secret|secrets|token|tokens|password|passwd)(?:[._-]|$)/.test(basename);
}

export function scanSecretText(text, filePath = '') {
    const findings = [];
    const patterns = [
        ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
        ['provider-token', /\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AIza[A-Za-z0-9_-]{25,}|AKIA[A-Z0-9]{16})\b/],
        ['secret-assignment', /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|secret|token|password|passwd)\b\s*[:=]\s*["']?[^\s"']{8,}/i],
    ];
    const lines = String(text || '').split(/\r?\n/);
    lines.forEach((line, index) => {
        for (const [kind, pattern] of patterns) {
            if (pattern.test(line)) findings.push({ path: filePath, line: index + 1, kind });
        }
        const candidates = line.match(/[A-Za-z0-9+/=_-]{40,}/g) || [];
        if (candidates.some(value => /[A-Za-z]/.test(value) && /\d/.test(value) && new Set(value).size >= 16)) {
            findings.push({ path: filePath, line: index + 1, kind: 'high-entropy-value' });
        }
    });
    return findings;
}

export async function prepareOutboundFiles({ folder, paths, readFile, allowDetectedSecrets = false } = {}) {
    const selectedPaths = [...new Set((paths || []).filter(path => typeof path === 'string' && path.trim()))];
    if (!folder || typeof readFile !== 'function') throw new Error('A selected workspace grant is required.');
    if (selectedPaths.length > MAX_OUTBOUND_FILES) throw new OutboundDataBlockedError(`Select no more than ${MAX_OUTBOUND_FILES} files.`);

    const sensitivePaths = selectedPaths.filter(isSensitivePath);
    if (sensitivePaths.length) {
        throw new OutboundDataBlockedError('Sensitive paths cannot be attached to Ensemble.', {
            findings: sensitivePaths.map(path => ({ path, kind: 'sensitive-path' })),
        });
    }

    const files = [];
    const findings = [];
    let totalBytes = 0;
    for (const relativePath of selectedPaths) {
        const content = await readFile(`${folder}/${relativePath}`);
        if (typeof content !== 'string') throw new OutboundDataBlockedError(`Could not read ${relativePath} as text.`);
        const bytes = new TextEncoder().encode(content).byteLength;
        if (bytes > MAX_OUTBOUND_FILE_BYTES) throw new OutboundDataBlockedError(`${relativePath} exceeds the per-file send limit.`);
        totalBytes += bytes;
        if (totalBytes > MAX_OUTBOUND_TOTAL_BYTES) throw new OutboundDataBlockedError('Attached files exceed the total send limit.');
        findings.push(...scanSecretText(content, relativePath));
        files.push({ path: relativePath, content });
    }

    if (findings.length && !allowDetectedSecrets) {
        throw new OutboundDataBlockedError('Potential secrets were found in the current file contents.', {
            findings,
            overrideAllowed: true,
        });
    }
    return { files, findings, totalBytes };
}

export function gateOutboundModel({ streamModel, folder, paths, readFile, approvedFiles, allowDetectedSecrets = false }) {
    if (typeof streamModel !== 'function') throw new TypeError('A model sender is required.');
    return async request => {
        if (paths.length) {
            const current = await prepareOutboundFiles({ folder, paths, readFile, allowDetectedSecrets });
            if (JSON.stringify(current.files) !== JSON.stringify(approvedFiles)) {
                throw new OutboundDataBlockedError('Attached files changed after approval. Review them before sending again.');
            }
        }
        return streamModel(request);
    };
}
