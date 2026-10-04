const { contextBridge, ipcRenderer } = require('electron');

const workspaceGrants = new Map();

function rememberWorkspaceGrant(grant) {
  if (!grant || typeof grant !== 'object' || typeof grant.grantId !== 'string' || typeof grant.path !== 'string') {
    return null;
  }
  workspaceGrants.set(grant.grantId, grant);
  return grant.path;
}

function workspaceGrantFor(targetPath, capability) {
  if (typeof targetPath !== 'string' || !targetPath.trim()) return null;
  const resolvedTarget = targetPath.replace(/\\/g, '/');
  let best = null;
  for (const grant of workspaceGrants.values()) {
    if (!grant.capabilities?.includes(capability)) continue;
    const root = grant.path.replace(/\\/g, '/').replace(/\/$/, '');
    // Select a remembered grant only; all real-path authorization is in main.
    if (resolvedTarget !== root && !resolvedTarget.startsWith(`${root}/`)) continue;
    if (!best || grant.path.length > best.path.length) best = grant;
  }
  return best;
}

function workspacePayload(targetPath, capability, extra = {}) {
  const grant = workspaceGrantFor(targetPath, capability);
  return { ...extra, grantId: grant?.grantId || null, targetPath };
}

contextBridge.exposeInMainWorld('electron', {
  selectDirectory: async (options) => rememberWorkspaceGrant(await ipcRenderer.invoke('select-directory', options)),
  getDefaultNotesPath: async () => rememberWorkspaceGrant(await ipcRenderer.invoke('get-default-notes-path')),
  runLocalCommand: (command, args, cwd) => ipcRenderer.invoke('run-local-command', workspacePayload(cwd, 'execute', { command, args, cwd })),
  onMenuAction: (callback) => ipcRenderer.on('menu-action', (event, action) => callback(action)),
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),
  listFiles: (targetPath) => ipcRenderer.invoke('list-files', workspacePayload(targetPath, 'list')),
  readFile: (targetPath) => ipcRenderer.invoke('read-file', workspacePayload(targetPath, 'read')),
  writeFile: (targetPath, content) => ipcRenderer.invoke('write-file', workspacePayload(targetPath, 'write', { content })),
  deleteFile: (targetPath) => ipcRenderer.invoke('delete-file', workspacePayload(targetPath, 'delete')),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', {
    old: workspacePayload(oldPath, 'rename'),
    next: workspacePayload(newPath, 'rename'),
  }),
  credentials: {
    status: () => ipcRenderer.invoke('credentials:status'),
    set: (provider, secret) => ipcRenderer.invoke('credentials:set', { provider, secret }),
    delete: (provider) => ipcRenderer.invoke('credentials:delete', { provider }),
  },
  models: {
    list: (options) => ipcRenderer.invoke('models:list', options),
    stream: (request, onEvent) => {
      const streamRequest = { ...request, requestId: request?.requestId || globalThis.crypto.randomUUID() };
      let finish;
      const completed = new Promise(resolve => { finish = resolve; });
      const listener = (_event, payload) => {
        if (payload?.requestId !== streamRequest.requestId) return;
        if (payload.type === 'complete') finish();
        else if (typeof onEvent === 'function') onEvent(payload);
      };
      ipcRenderer.on('models:stream-event', listener);
      return ipcRenderer.invoke('models:stream', streamRequest)
        .then(async result => { await completed; return result; })
        .finally(() => ipcRenderer.removeListener('models:stream-event', listener));
    },
    abort: (requestId) => ipcRenderer.invoke('models:abort', { requestId }),
  },
  getAppData: () => ipcRenderer.invoke('app-data:get'),
  setAppData: (data) => ipcRenderer.invoke('app-data:set', data),
  setJulesApiKey: (secret) => ipcRenderer.invoke('jules:set-key', secret),
  setGdashClientSecret: (secret) => ipcRenderer.invoke('gdash:set-client-secret', secret),
  getAppDataPath: () => ipcRenderer.invoke('app-data:path'),
  getTerminalConnectionInfo: () => ipcRenderer.invoke('terminal:get-connection-info'),
  getKlipitExtensionId: () => ipcRenderer.invoke('get-klipit-extension-id'),
  getKlipitHealth: () => ipcRenderer.invoke('get-klipit-health'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  webSearch: (query, options) => ipcRenderer.invoke('web-search', { query, options }),
  showContextMenu: (params) => ipcRenderer.send('show-context-menu', params),
  onContextMenuAction: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('context-menu-action', listener);
    return () => ipcRenderer.removeListener('context-menu-action', listener);
  },
  // StudioOS API proxy — avoids CORS by routing through the main process.
  studioos: {
    fetch: ({ apiBase, apiKey, path, method, body }) =>
      ipcRenderer.invoke('studioos:fetch', { apiBase, apiKey, path, method, body })
  },
  // Perci OS (Phase 2) — isPerciOS resolves false on every platform except
  // the Linux OS-shell image, and OS-only surfaces stay hidden until it
  // resolves true. See electron/perci-os.cjs.
  isPerciOS: () => ipcRenderer.invoke('perci-os:is-perci-os'),
  perciOS: {
    listWifiNetworks: () => ipcRenderer.invoke('perci-os:wifi:list'),
    getWifiStatus: () => ipcRenderer.invoke('perci-os:wifi:status'),
    connectToWifi: (ssid, password) => ipcRenderer.invoke('perci-os:wifi:connect', { ssid, password }),
    getBatteryStatus: () => ipcRenderer.invoke('perci-os:power:battery'),
    getPowerActions: () => ipcRenderer.invoke('perci-os:power:actions'),
    suspend: () => ipcRenderer.invoke('perci-os:power:suspend'),
    powerOff: () => ipcRenderer.invoke('perci-os:power:power-off'),
    reboot: () => ipcRenderer.invoke('perci-os:power:reboot'),
    getBrightness: () => ipcRenderer.invoke('perci-os:display:get-brightness'),
    setBrightness: (percent) => ipcRenderer.invoke('perci-os:display:set-brightness', { percent }),
    getVolume: () => ipcRenderer.invoke('perci-os:volume:get'),
    setVolume: (percent) => ipcRenderer.invoke('perci-os:volume:set', { percent }),
    toggleMute: () => ipcRenderer.invoke('perci-os:volume:toggle-mute'),
    listInstalledApps: () => ipcRenderer.invoke('perci-os:apps:list'),
    launchApp: (appId) => ipcRenderer.invoke('perci-os:apps:launch', { appId }),
  },
  listAgentJobs: (options) => ipcRenderer.invoke('agent-jobs:list', options),
  getAgentJob: (id) => ipcRenderer.invoke('agent-jobs:get', id),
  queueAgentJob: (job) => ipcRenderer.invoke('agent-jobs:queue', job),
  cancelAgentJob: (id) => ipcRenderer.invoke('agent-jobs:cancel', id),
  getCodexPocketStatus: () => ipcRenderer.invoke('codex-pocket:status'),
  loginCodexWithChatGPT: () => ipcRenderer.invoke('codex-pocket:login'),
  queueJulesJob: (job) => ipcRenderer.invoke('jules:queue', job),
  listGitHubRepos: () => ipcRenderer.invoke('github:list-repos'),
  detectLocalRepo: () => ipcRenderer.invoke('git:detect-local-repo'),
  runTerminalCommand: (command) => ipcRenderer.invoke('run-terminal-command', command),
  listAgentActivity: () => ipcRenderer.invoke('agent-jobs:activity'),
  getOpenClawLocalProfile: () => ipcRenderer.invoke('openclaw:get-local-profile'),
  testOpenClawConnection: (profile) => ipcRenderer.invoke('openclaw:test-connection', profile),
  getOpenClawGatewayStatus: (profile) => ipcRenderer.invoke('openclaw:gateway-status', profile),
  startOpenClawEvents: (profile) => ipcRenderer.invoke('openclaw:events-start', profile),
  stopOpenClawEvents: () => ipcRenderer.invoke('openclaw:events-stop'),
  onOpenClawEvent: (callback) => {
    const listener = (event, evt) => callback(evt);
    ipcRenderer.on('openclaw:event', listener);
    return () => ipcRenderer.removeListener('openclaw:event', listener);
  },
  runOpenClawAgent: (opts) => ipcRenderer.invoke('openclaw:agent-run', opts),
  restartOpenClawGateway: () => ipcRenderer.invoke('openclaw:restart-gateway'),
  readOpenClawConfig: () => ipcRenderer.invoke('openclaw:read-config'),
  writeOpenClawConfig: (config) => ipcRenderer.invoke('openclaw:write-config', config),
  readOpenClawDiary: () => ipcRenderer.invoke('openclaw:read-diary'),
  writeOpenClawDiary: (content) => ipcRenderer.invoke('openclaw:write-diary', content),
  discoverModelProviders: () => ipcRenderer.invoke('models:discover-providers'),
  transcribeVoice: (payload) => ipcRenderer.invoke('voice:transcribe', payload),
  openMicrophoneSettings: () => ipcRenderer.invoke('voice:open-microphone-settings'),
  startJanServer: (options) => ipcRenderer.invoke('models:start-jan-server', options),
  detectBarsProviders: () => ipcRenderer.invoke('bars:detect-providers'),
  askBars: (payload) => ipcRenderer.invoke('bars:ask', payload),
  getBarsApiKeyStatus: () => ipcRenderer.invoke('bars:get-api-key-status'),
  saveBarsApiKeys: (payload) => ipcRenderer.invoke('bars:save-api-keys', payload),
  clearBarsApiKeys: () => ipcRenderer.invoke('bars:clear-api-keys'),
  describeMarkItDownImage: (payload) => ipcRenderer.invoke('markitdown:describe-image', payload),
  startMarkItDownServer: () => ipcRenderer.invoke('markitdown:start-server'),
  getMarkItDownServerStatus: () => ipcRenderer.invoke('markitdown:server-status'),
  installMarkItDownExifTool: () => ipcRenderer.invoke('markitdown:install-exiftool'),
  getHermesStatus: () => ipcRenderer.invoke('hermes:status'),
  runHermesTask: (opts) => ipcRenderer.invoke('hermes:run', opts),
  cancelHermesRun: () => ipcRenderer.invoke('hermes:run-cancel'),
  onHermesRunEvent: (callback) => {
    const listener = (event, evt) => callback(evt);
    ipcRenderer.on('hermes:run-event', listener);
    return () => ipcRenderer.removeListener('hermes:run-event', listener);
  },
  startHermesLogs: () => ipcRenderer.invoke('hermes:logs-start'),
  stopHermesLogs: () => ipcRenderer.invoke('hermes:logs-stop'),
  onHermesLogEvent: (callback) => {
    const listener = (event, evt) => callback(evt);
    ipcRenderer.on('hermes:log-event', listener);
    return () => ipcRenderer.removeListener('hermes:log-event', listener);
  },
  listHermesSessions: (opts) => ipcRenderer.invoke('hermes:sessions', opts),
  getHermesInsights: (opts) => ipcRenderer.invoke('hermes:insights', opts),
  getHermesDashboardStatus: () => ipcRenderer.invoke('hermes:dashboard-status'),
  startHermesDashboard: () => ipcRenderer.invoke('hermes:dashboard-start'),
  getHermesMemory: () => ipcRenderer.invoke('hermes:memory'),
  startHermesChat: (opts) => ipcRenderer.invoke('hermes:chat-start', opts),
  sendHermesChat: (opts) => ipcRenderer.invoke('hermes:chat-send', opts),
  stopHermesChat: () => ipcRenderer.invoke('hermes:chat-stop'),
  cancelHermesChat: () => ipcRenderer.invoke('hermes:chat-cancel'),
  // Lighthouse port scanning
  lighthouseScan: () => ipcRenderer.invoke('lighthouse:scan'),
  lighthouseCheckPort: (port) => ipcRenderer.invoke('lighthouse:check-port', { port }),
  lighthouseSuggestPort: () => ipcRenderer.invoke('lighthouse:suggest-port'),
  lighthouseProcessDetails: (pid) => ipcRenderer.invoke('lighthouse:process-details', { pid }),
  lighthouseKillProcess: (pid) => ipcRenderer.invoke('lighthouse:kill-process', { pid }),
  lighthouseFindReferences: (oldPort, newPort) => ipcRenderer.invoke('lighthouse:find-references', { oldPort, newPort }),
  lighthouseApplyFix: (filePath, lineNumber, newLine, oldLine) => ipcRenderer.invoke('lighthouse:apply-fix', workspacePayload(filePath, 'write', { filePath, lineNumber, newLine, oldLine })),
  // Localhost Manager — launchctl wrappers
  localhostEnableAutostart: (opts) => ipcRenderer.invoke('localhost:enable-autostart', opts),
  localhostDisableAutostart: (opts) => ipcRenderer.invoke('localhost:disable-autostart', opts),
  hostsRead: () => ipcRenderer.invoke('hosts:read'),
  hostsWrite: (content) => ipcRenderer.invoke('hosts:write', content),
  aliasRead: () => ipcRenderer.invoke('alias:read'),
  aliasWrite: (content) => ipcRenderer.invoke('alias:write', content),
  localhostStartNow: (opts) => ipcRenderer.invoke('localhost:start-now', opts),
  localhostCheckHealth: (url) => ipcRenderer.invoke('localhost:check-health', { url }),
  localhostStopNow: (opts) => ipcRenderer.invoke('localhost:stop-now', opts),
  keysafeStatus: () => ipcRenderer.invoke('keysafe:status'),
  keysafeStart: () => ipcRenderer.invoke('keysafe:start'),
  dotenvxCheckInstall: () => ipcRenderer.invoke('dotenvx:check-install'),
  dotenvxInstall: () => ipcRenderer.invoke('dotenvx:install'),
  opencodeCheckInstall: () => ipcRenderer.invoke('opencode:check-install'),
  opencodeProbe: () => ipcRenderer.invoke('opencode:probe'),
  opencodeStart: () => ipcRenderer.invoke('opencode:start'),
  opencodeBuildInfo: () => ipcRenderer.invoke('opencode:build-info'),
  opencodeInstallInfo: () => ipcRenderer.invoke('opencode:install-info'),
  opencodeRebuild: () => ipcRenderer.invoke('opencode:rebuild'),
  onOpencodeRebuildProgress: (callback) => {
    const listener = (event, line) => callback(line);
    ipcRenderer.on('opencode:rebuild-progress', listener);
    return () => ipcRenderer.removeListener('opencode:rebuild-progress', listener);
  },
  getHomeDir: () => ipcRenderer.invoke('get-home-dir'),
  // G-Dash (Google Workspace dashboard) — BYO OAuth client; tokens stay in main.
  gdashStatus: () => ipcRenderer.invoke('gdash:status'),
  gdashConnect: () => ipcRenderer.invoke('gdash:connect'),
  gdashCancelConnect: () => ipcRenderer.invoke('gdash:cancel-connect'),
  gdashDisconnect: () => ipcRenderer.invoke('gdash:disconnect'),
  gdashDashboard: (opts) => ipcRenderer.invoke('gdash:dashboard', opts),
  // Eidos — persistent memory service (Docker/OrbStack lifecycle + dashboard).
  eidosStatus: () => ipcRenderer.invoke('eidos:status'),
  eidosStart: () => ipcRenderer.invoke('eidos:start'),
  eidosStop: () => ipcRenderer.invoke('eidos:stop'),
  eidosRestart: () => ipcRenderer.invoke('eidos:restart'),
  eidosProgress: () => ipcRenderer.invoke('eidos:progress'),
  eidosInsights: () => ipcRenderer.invoke('eidos:insights'),
  // Supermemory — self-hosted local memory binary.
  supermemoryStatus: () => ipcRenderer.invoke('supermemory:status'),
  supermemoryStart: () => ipcRenderer.invoke('supermemory:start'),
  supermemoryStop: () => ipcRenderer.invoke('supermemory:stop'),
  supermemoryRestart: () => ipcRenderer.invoke('supermemory:restart'),
  supermemoryProgress: () => ipcRenderer.invoke('supermemory:progress'),
  supermemoryConfig: (config) => ipcRenderer.invoke('supermemory:config', config),
  supermemoryApi: (method, path, body) => ipcRenderer.invoke('supermemory:api', method, path, body),
  // Cleanmac — developer cache cleanup runner.
  cleanmacInspectDocker: () => ipcRenderer.invoke('cleanmac:inspect-docker'),
  cleanmacRun: () => ipcRenderer.invoke('cleanmac:run'),
  onCleanmacOutput: (callback) => {
    const listener = (event, { type, data }) => callback(type, data);
    ipcRenderer.on('cleanmac:output', listener);
    return () => ipcRenderer.removeListener('cleanmac:output', listener);
  },
  // Docker/OrbStack lifecycle — generic check + start for windows that embed
  // Docker-dependent localhost services (Open Notebook, etc).
  dockerStatus: () => ipcRenderer.invoke('docker:status'),
  dockerStartOrbStack: () => ipcRenderer.invoke('docker:start-orbstack'),
  dockerList: () => ipcRenderer.invoke('docker:list'),
  dockerStop: (id) => ipcRenderer.invoke('docker:stop', { id }),
  dockerBackupVolume: (name) => ipcRenderer.invoke('docker:backup-volume', { name }),
  dockerRemove: (type, id, confirm) => ipcRenderer.invoke('docker:remove', { type, id, confirm }),
  // DB Inspector — read-only SQLite browsing via the system sqlite3 CLI.
  dbDiscover: () => ipcRenderer.invoke('db:discover'),
  dbPickFile: () => ipcRenderer.invoke('db:pick-file'),
  dbSchema: (dbPath) => ipcRenderer.invoke('db:schema', { dbPath }),
  dbQuery: (dbPath, sql) => ipcRenderer.invoke('db:query', { dbPath, sql }),
  // Packages Dashboard APIs
  packagesScan: () => ipcRenderer.invoke('packages:scan'),
  packagesGetConfig: () => ipcRenderer.invoke('packages:get-config'),
  packagesSetConfig: (config) => ipcRenderer.invoke('packages:set-config', config),
  onUpdaterState: (callback) => {
    const listener = (event, state) => callback(state);
    ipcRenderer.on('updater:state', listener);
    return () => ipcRenderer.removeListener('updater:state', listener);
  },
  triggerUpdaterAction: (action) => ipcRenderer.invoke('updater:action', action),
  detectAgentCLIs: () => ipcRenderer.invoke('skills:detect-agents'),
  getInstalledSkills: () => ipcRenderer.invoke('skills:get-installed'),
  getCodingExpertStatus: () => ipcRenderer.invoke('skills:get-coding-expert-status'),
  getPlaybookSkills: () => ipcRenderer.invoke('skills:get-playbook-skills'),
  setSkillMetadata: (data) => ipcRenderer.invoke('skills:set-metadata', data),
  getSkillMetadata: () => ipcRenderer.invoke('skills:get-metadata'),
  // AgentMail — credential management (webview loads AgentMail directly)
  agentmailGetCredentials: () => ipcRenderer.invoke('agentmail:get-credentials'),
  agentmailSetCredentials: (api_key, inbox_id) => ipcRenderer.invoke('agentmail:set-credentials', { api_key, inbox_id }),
  agentmailClearCredentials: () => ipcRenderer.invoke('agentmail:clear-credentials'),
  // AutoForge — autonomous coding agent (start/stop/status)
  autoforgeStatus: () => ipcRenderer.invoke('autoforge:status'),
  autoforgeStart: () => ipcRenderer.invoke('autoforge:start'),
  autoforgeStop: () => ipcRenderer.invoke('autoforge:stop'),
  // Usage Tracker — subscription/usage limit data (get/save)
  usageTracker: {
    get: () => ipcRenderer.invoke('usage-tracker:get'),
    save: (data) => ipcRenderer.invoke('usage-tracker:save', data),
  },
  // PWA shortcuts — extract favicon + title from a URL
  extractPwaMetadata: (url) => ipcRenderer.invoke('pwa:extract-favicon', { url }),
  getPreloadPath: () => ipcRenderer.invoke('get-preload-path'),
  onWebviewOpenInTab: (callback) => {
    const listener = (event, url) => callback(url);
    ipcRenderer.on('webview:open-in-tab', listener);
    return () => ipcRenderer.removeListener('webview:open-in-tab', listener);
  },
});
