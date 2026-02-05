#!/usr/bin/env node

const major = Number(process.versions.node.split(".")[0]);

// This repo uses better-sqlite3 (native module) which regularly breaks on bleeding-edge Node.
// Keep local dev and CI on an LTS-ish Node major.
if (Number.isNaN(major) || major < 22 || major >= 25) {
  console.error(
    `\n[velvet-alchemy] Unsupported Node.js version: ${process.versions.node}.\n` +
      `Use Node 24 (recommended) or Node 22.\n\n` +
      `Fix (nvm):\n` +
      `  nvm install 24\n` +
      `  nvm use 24\n\n` +
      `Then reinstall deps:\n` +
      `  corepack enable\n` +
      `  corepack pnpm install\n`
  );
  process.exit(1);
}
