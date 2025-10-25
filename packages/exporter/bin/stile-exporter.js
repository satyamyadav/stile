#!/usr/bin/env node

try {
  require("tsconfig-paths/register");
  require("@swc-node/register");
} catch (error) {
  console.error("Failed to bootstrap exporter runtime. Please run `npm install` first.");
  console.error(error);
  process.exit(1);
}

const { runExporterCli } = require("../src/index.ts");

runExporterCli();
