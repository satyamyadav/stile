#!/usr/bin/env node

import { Command } from "commander";
import path from "path";
import fs from "fs/promises";
import chalk from "chalk";
import { StileLoader, StileLoaderAPI } from "./index";
import { LoaderConfig, ScanReport } from "@stile/types";

async function loadLoaderConfig(configPath: string): Promise<LoaderConfig> {
  const resolvedPath = path.resolve(configPath);
  const module = await import(resolvedPath);
  return module.default || module;
}

async function loadReportFromFile(reportPath: string): Promise<ScanReport> {
  const resolvedPath = path.resolve(reportPath);
  const content = await fs.readFile(resolvedPath, "utf-8");
  return JSON.parse(content) as ScanReport;
}

export async function runLoaderCli(): Promise<void> {
  const program = new Command();

  program
    .name("stile-loader")
    .description("Stile Loader CLI - load scan results into analytics databases")
    .version("0.0.0");

  program
    .command("serve")
    .description("Start the loader HTTP API")
    .option("-c, --config <file>", "Loader configuration file", "stile.loader.config.js")
    .option("-p, --port <port>", "Port to run the API on", "3001")
    .action(async (options) => {
      try {
        const config = await loadLoaderConfig(options.config);
        const loader = new StileLoader(config);
        const api = new StileLoaderAPI(loader);
        const port = Number(options.port);
        await api.start(port);

        process.on("SIGINT", async () => {
          await api.stop();
          process.exit(0);
        });
      } catch (error: any) {
        console.error(chalk.red("Failed to start loader API:"), error.message);
        process.exit(1);
      }
    });

  program
    .command("load")
    .description("Load a scan report into the configured database")
    .option("-c, --config <file>", "Loader configuration file", "stile.loader.config.js")
    .option("-f, --file <file>", "Scan report file", "stile-report.json")
    .action(async (options) => {
      try {
        const config = await loadLoaderConfig(options.config);
        const report = await loadReportFromFile(options.file);
        const loader = new StileLoader(config);
        await loader.load(report);
      } catch (error: any) {
        console.error(chalk.red("Failed to load report:"), error.message);
        process.exit(1);
      }
    });

  program
    .command("schema")
    .description("Create analytics schema in the configured database")
    .option("-c, --config <file>", "Loader configuration file", "stile.loader.config.js")
    .action(async (options) => {
      try {
        const config = await loadLoaderConfig(options.config);
        const loader = new StileLoader(config);
        await loader.createSchema();
      } catch (error: any) {
        console.error(chalk.red("Failed to create schema:"), error.message);
        process.exit(1);
      }
    });

  await program.parseAsync();
}

if (require.main === module) {
  runLoaderCli();
}
