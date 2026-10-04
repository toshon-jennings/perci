import { describe, expect, it } from 'vitest';
import { ensureHydrated, readStringStorage, writePersistenceSnapshot, writeStringStorage } from '../src/lib/persistentStore.js';

describe('browser secret persistence', () => {
    it('moves legacy provider keys into this session and removes plaintext localStorage', async () => {
        localStorage.setItem('openai_key', 'synthetic-legacy-key');
        localStorage.setItem('theme', 'dark');
        await ensureHydrated();
        expect(readStringStorage('openai_key')).toBe('synthetic-legacy-key');
        expect(localStorage.getItem('openai_key')).toBeNull();
        expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('does not write provider keys through single or bulk browser persistence', () => {
        writeStringStorage('openai_key', 'synthetic-key');
        writePersistenceSnapshot({ groq_key: 'synthetic-other-key', theme: 'light' });
        expect(readStringStorage('openai_key')).toBe('synthetic-key');
        expect(readStringStorage('groq_key')).toBe('synthetic-other-key');
        expect(localStorage.getItem('openai_key')).toBeNull();
        expect(localStorage.getItem('groq_key')).toBeNull();
        expect(localStorage.getItem('theme')).toBe('light');
    });
});
