#!/usr/bin/env node

try {
  require("tsconfig-paths/register");
  require("@swc-node/register");
} catch (error) {
  console.error("Failed to bootstrap loader runtime. Please run `npm install` first.");
  console.error(error);
  process.exit(1);
}

const { runLoaderCli } = require("../src/cli.ts");

runLoaderCli();
