// A failed module fetch is cached by Chromium. Only retry assets beside the
// trusted entry module, with a bounded query key; never import arbitrary URLs.
export function lazyModuleRetryUrl(error, entryUrl, attempt) {
    const prefix = 'Failed to fetch dynamically imported module: ';
    if (!error?.message?.startsWith(prefix) || !Number.isInteger(attempt) || attempt < 1 || attempt > 3) return null;
    try {
        const target = new URL(error.message.slice(prefix.length));
        const directory = new URL('.', entryUrl);
        if (new URL('.', target).href !== directory.href || target.search || target.hash) return null;
        if (!/^[\w-]+\.js$/.test(target.pathname.split('/').pop())) return null;
        target.searchParams.set('perciRetry', String(attempt));
        return target.href;
    } catch {
        return null;
    }
}
