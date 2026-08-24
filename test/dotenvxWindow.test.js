import { describe, expect, it } from 'vitest';
import { SYSTEM_TILES } from '../src/lib/appCatalog.jsx';
import { DOTENVX_WINDOW_ID, WINDOW_TITLES } from '../src/context/ModeContext.jsx';

describe('Dotenvx first-class window', () => {
    it('has a titled launcher tile with the Dotenvx identity', () => {
        const tile = SYSTEM_TILES.find(item => item.id === DOTENVX_WINDOW_ID);

        expect(DOTENVX_WINDOW_ID).toBe('dotenvx-gui');
        expect(WINDOW_TITLES[DOTENVX_WINDOW_ID]).toBe('Dotenvx GUI');
        expect(tile).toMatchObject({
            title: 'Dotenvx GUI',
            desc: 'Edit, encrypt, and run local environment files',
            hue: '#2f5d42',
            artwork: true,
        });
        expect(tile.logo).toContain('dotenvx-logo.svg');
        expect(tile.bgImage).toContain('dotenvx-bg.svg');
    });
});
