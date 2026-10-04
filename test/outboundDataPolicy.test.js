import { describe, expect, it, vi } from 'vitest';
import {
    OutboundDataBlockedError,
    gateOutboundModel,
    isSensitivePath,
    prepareOutboundFiles,
    scanSecretText,
} from '../src/lib/outboundDataPolicy.js';

describe('Ensemble outbound data policy', () => {
    it('blocks sensitive filenames and credential directories case-insensitively', () => {
        for (const path of ['.env', '.ENV.local', 'keys/id_rsa', '.aws/credentials', 'client-secret.json', 'certs/app.pem']) {
            expect(isSensitivePath(path), path).toBe(true);
        }
        expect(isSensitivePath('src/auth-client.js')).toBe(false);
    });

    it('reports finding metadata without returning the secret value', () => {
        const secret = 'sk-1234567890abcdefghijklmnopqrstuv';
        const findings = scanSecretText(`OPENAI_API_KEY=${secret}`, 'config.txt');
        expect(findings).toEqual(expect.arrayContaining([
            expect.objectContaining({ path: 'config.txt', line: 1, kind: expect.any(String) }),
        ]));
        expect(JSON.stringify(findings)).not.toContain(secret);
    });

    it('re-reads current bytes and blocks a file changed after selection', async () => {
        const readFile = vi.fn(async () => 'password=synthetic-password');
        await expect(prepareOutboundFiles({ folder: '/workspace', paths: ['clean.txt'], readFile }))
            .rejects.toMatchObject({
                name: 'OutboundDataBlockedError',
                overrideAllowed: true,
                findings: [expect.objectContaining({ path: 'clean.txt', kind: 'secret-assignment' })],
            });
        expect(readFile).toHaveBeenCalledWith('/workspace/clean.txt');
    });

    it('permits a fresh per-run override without suppressing findings', async () => {
        const result = await prepareOutboundFiles({
            folder: '/workspace',
            paths: ['config.txt'],
            readFile: async () => 'token=synthetic-token-value',
            allowDetectedSecrets: true,
        });
        expect(result.files).toEqual([{ path: 'config.txt', content: 'token=synthetic-token-value' }]);
        expect(result.findings).toHaveLength(1);
    });

    it('never allows sensitive paths through the content override', async () => {
        await expect(prepareOutboundFiles({
            folder: '/workspace',
            paths: ['.env'],
            readFile: async () => 'harmless',
            allowDetectedSecrets: true,
        })).rejects.toBeInstanceOf(OutboundDataBlockedError);
    });

    it('rechecks exact approved bytes before every panel, judge, and synthesis request', async () => {
        let content = 'approved context';
        const streamModel = vi.fn(async request => {
            if (request.stage === 'panel') content = 'password=synthetic-secret';
            return 'ok';
        });
        const gated = gateOutboundModel({
            streamModel,
            folder: '/workspace',
            paths: ['context.txt'],
            readFile: async () => content,
            approvedFiles: [{ path: 'context.txt', content }],
        });
        await expect(gated({ stage: 'panel' })).resolves.toBe('ok');
        await expect(gated({ stage: 'judge' })).rejects.toMatchObject({ name: 'OutboundDataBlockedError' });
        await expect(gated({ stage: 'synthesis' })).rejects.toMatchObject({ name: 'OutboundDataBlockedError' });
        expect(streamModel).toHaveBeenCalledTimes(1);
    });
});
