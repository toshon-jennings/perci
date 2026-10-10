import { describe, expect, it } from 'vitest';
import { lazyModuleRetryUrl } from '../src/lib/lazyModuleRetry';

const entry = 'file:///Perci.app/Contents/Resources/app.asar/dist/assets/index-ab12.js';
const failure = url => new TypeError(`Failed to fetch dynamically imported module: ${url}`);
const asset = 'file:///Perci.app/Contents/Resources/app.asar/dist/assets/OfficePanel-cd34.js';

describe('packaged lazy-module retry', () => {
    it('changes the fetch identity only for a sibling packaged JS asset', () => {
        expect(lazyModuleRetryUrl(failure(asset), entry, 1)).toBe(`${asset}?perciRetry=1`);
        expect(lazyModuleRetryUrl(failure(asset), entry, 3)).toBe(`${asset}?perciRetry=3`);
    });
    it('rejects other origins, directories, asset types, and ambiguous URLs', () => {
        for (const url of ['https://evil.example/Office.js', 'file:///tmp/Office.js', asset.replace('.js', '.css'), `${asset}?other=1`, `${asset}#hash`, 'not a URL']) {
            expect(lazyModuleRetryUrl(failure(url), entry, 1)).toBeNull();
        }
        expect(lazyModuleRetryUrl(new Error('render failed'), entry, 1)).toBeNull();
    });
    it('bounds retry module identities', () => {
        for (const attempt of [0, 4, 1.5, Infinity, '1']) expect(lazyModuleRetryUrl(failure(asset), entry, attempt)).toBeNull();
    });
});
