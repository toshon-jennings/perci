import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import workspaceGrants from '../electron/workspace-grants.cjs';

const { createWorkspaceGrantRegistry } = workspaceGrants;

describe('workspace grant registry', () => {
  let sandbox;
  let workspace;
  let outside;
  let registry;

  beforeEach(async () => {
    sandbox = await mkdtemp(path.join(os.tmpdir(), 'perci-workspace-grants-'));
    workspace = path.join(sandbox, 'project');
    outside = path.join(sandbox, 'project-two');
    await mkdir(workspace);
    await mkdir(outside);
    await writeFile(path.join(workspace, 'inside.txt'), 'inside');
    await writeFile(path.join(outside, 'outside.txt'), 'outside');
    registry = createWorkspaceGrantRegistry({ fileSystem: await import('node:fs/promises') });
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  async function grant(options = {}) {
    return registry.grantDirectory(workspace, 7, {
      capabilities: ['list', 'read'],
      ...options,
    });
  }

  it('authorizes a normal file only for the owning renderer', async () => {
    const issued = await grant();
    await expect(registry.authorize({
      grantId: issued.grantId,
      ownerId: 7,
      capability: 'read',
      targetPath: path.join(workspace, 'inside.txt'),
    })).resolves.toBe(path.join(issued.path, 'inside.txt'));

    await expect(registry.authorize({
      grantId: issued.grantId,
      ownerId: 8,
      capability: 'read',
      targetPath: path.join(workspace, 'inside.txt'),
    })).rejects.toThrow('invalid workspace grant');
  });

  it('denies sibling-prefix and relative traversal paths', async () => {
    const issued = await grant();
    for (const targetPath of [
      path.join(outside, 'outside.txt'),
      path.join(workspace, '..', 'project-two', 'outside.txt'),
    ]) {
      await expect(registry.authorize({
        grantId: issued.grantId,
        ownerId: 7,
        capability: 'read',
        targetPath,
      })).rejects.toThrow('real path escapes');
    }
  });

  it('denies a symlink that resolves outside the selected workspace', async () => {
    const issued = await grant();
    const linkPath = path.join(workspace, 'escape.txt');
    await symlink(path.join(outside, 'outside.txt'), linkPath);

    await expect(registry.authorize({
      grantId: issued.grantId,
      ownerId: 7,
      capability: 'read',
      targetPath: linkPath,
    })).rejects.toThrow('real path escapes');
  });

  it('can deny even contained symlinks for read-only context grants', async () => {
    const issued = await grant({ symlinkPolicy: 'deny' });
    const linkPath = path.join(workspace, 'alias.txt');
    await symlink(path.join(workspace, 'inside.txt'), linkPath);

    await expect(registry.authorize({
      grantId: issued.grantId,
      ownerId: 7,
      capability: 'read',
      targetPath: linkPath,
    })).rejects.toThrow('symbolic links are not allowed');
  });

  it('enforces capabilities and validates missing write targets through their real parent', async () => {
    const readOnly = await grant();
    await expect(registry.authorize({
      grantId: readOnly.grantId,
      ownerId: 7,
      capability: 'write',
      targetPath: path.join(workspace, 'new.txt'),
      allowMissing: true,
    })).rejects.toThrow('capability not granted');

    const writable = await grant({ capabilities: ['write'] });
    await expect(registry.authorize({
      grantId: writable.grantId,
      ownerId: 7,
      capability: 'write',
      targetPath: path.join(workspace, 'nested', 'new.txt'),
      allowMissing: true,
    })).resolves.toBe(path.join(writable.path, 'nested', 'new.txt'));
  });

  it('revokes every grant when its owner is destroyed', async () => {
    const issued = await grant();
    registry.revokeOwner(7);
    await expect(registry.authorize({
      grantId: issued.grantId,
      ownerId: 7,
      capability: 'read',
      targetPath: path.join(workspace, 'inside.txt'),
    })).rejects.toThrow('invalid workspace grant');
  });
});
