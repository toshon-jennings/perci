import { describe, expect, it } from 'vitest';
import { SYSTEM_TILES } from '../src/lib/appCatalog.jsx';
import { DOTENVX_WINDOW_ID, WINDOW_TITLES } from '../src/context/ModeContext.jsx';

describe('Dotenvx first-class window', () => {
    it('has a titled launcher tile with the Dotenvx identity', () => {
        const tile = SYSTEM_TILES.find(item => item.id === DOTENVX_WINDOW_ID);

        expect(DOTENVX_WINDOW_ID).toBe('dotenvx-gui');
        expect(WINDOW_TITLES[DOTENVX_WINDOW_ID]).toBe('Dotenvx');
        expect(tile).toMatchObject({
            title: 'Dotenvx',
            desc: 'Edit, encrypt, and run local environment files',
        });
        expect(tile.logo).toBeTruthy();
    });
});
