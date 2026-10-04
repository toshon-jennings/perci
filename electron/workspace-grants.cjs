const path = require('path');
const { randomUUID } = require('crypto');

const VALID_CAPABILITIES = new Set(['list', 'read', 'write', 'rename', 'delete', 'execute']);

function isContained(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizeCapabilities(capabilities) {
  if (!Array.isArray(capabilities)) return [];
  return [...new Set(capabilities.filter(capability => VALID_CAPABILITIES.has(capability)))];
}

function createWorkspaceGrantRegistry({ fileSystem, createId = randomUUID } = {}) {
  if (!fileSystem?.realpath || !fileSystem?.lstat) {
    throw new TypeError('A promise-based filesystem implementation is required.');
  }

  const grants = new Map();

  async function grantDirectory(rootPath, ownerId, options = {}) {
    if (typeof rootPath !== 'string' || !rootPath.trim()) throw new Error('A directory is required.');
    if (!Number.isInteger(ownerId)) throw new Error('A trusted owner is required.');

    const capabilities = normalizeCapabilities(options.capabilities);
    if (capabilities.length === 0) throw new Error('At least one capability is required.');

    const realRoot = await fileSystem.realpath(path.resolve(rootPath));
    const rootStat = await fileSystem.lstat(realRoot);
    if (!rootStat.isDirectory()) throw new Error('The selected workspace is not a directory.');

    const grantId = createId();
    const grant = {
      grantId,
      ownerId,
      root: realRoot,
      capabilities: new Set(capabilities),
      symlinkPolicy: options.symlinkPolicy === 'deny' ? 'deny' : 'contain',
    };
    grants.set(grantId, grant);

    return {
      grantId,
      path: realRoot,
      displayName: path.basename(realRoot) || realRoot,
      capabilities,
    };
  }

  async function resolveExistingOrParent(targetPath) {
    let cursor = path.resolve(targetPath);
    const missingParts = [];

    while (true) {
      try {
        const realExisting = await fileSystem.realpath(cursor);
        return {
          realTarget: path.join(realExisting, ...missingParts.reverse()),
          existingRealPath: realExisting,
          hasMissingParts: missingParts.length > 0,
        };
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        const parent = path.dirname(cursor);
        if (parent === cursor) throw error;
        missingParts.push(path.basename(cursor));
        cursor = parent;
      }
    }
  }

  async function authorize({ grantId, ownerId, capability, targetPath, allowMissing = false } = {}) {
    const grant = grants.get(grantId);
    if (!grant || grant.ownerId !== ownerId) throw new Error('Access Denied: invalid workspace grant.');
    if (!grant.capabilities.has(capability)) throw new Error('Access Denied: capability not granted.');
    if (typeof targetPath !== 'string' || !targetPath.trim()) throw new Error('Access Denied: invalid path.');

    const resolvedTarget = path.resolve(targetPath);
    const resolved = await resolveExistingOrParent(resolvedTarget);
    if (resolved.hasMissingParts && !allowMissing) {
      throw new Error('Access Denied: path does not exist.');
    }
    if (!isContained(grant.root, resolved.existingRealPath) || !isContained(grant.root, resolved.realTarget)) {
      throw new Error('Access Denied: real path escapes the selected workspace.');
    }
    if (grant.symlinkPolicy === 'deny' && !resolved.hasMissingParts && resolved.realTarget !== resolvedTarget) {
      throw new Error('Access Denied: symbolic links are not allowed for this workspace.');
    }

    return resolved.realTarget;
  }

  function revokeOwner(ownerId) {
    for (const [grantId, grant] of grants) {
      if (grant.ownerId === ownerId) grants.delete(grantId);
    }
  }

  function roots() {
    return [...new Set([...grants.values()].map(grant => grant.root))];
  }

  return { authorize, grantDirectory, revokeOwner, roots };
}

module.exports = { createWorkspaceGrantRegistry, isContained, normalizeCapabilities };
