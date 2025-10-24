#!/usr/bin/env node

/**
 * @stile/cli - Command-line interface for Stile
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import fs from "fs-extra";
import path from "path";
import { StileEngine } from "@stile/core";
import { StileConfig, ScanReport } from "@stile/types";

const program = new Command();

program
  .name("stile")
  .description("Stile - Design System Analytics & Adherence Platform")
  .version("0.0.0");

program
  .command("scan")
  .description("Scan codebase for design system adherence")
  .option("-p, --path <path>", "Path to scan", "./src")
  .option("-c, --config <file>", "Configuration file", "stile.config.js")
  .option("-o, --output <file>", "Output file", "stile-report.json")
  .option("--format <format>", "Output format", "json")
  .action(async (options) => {
    const spinner = ora("Initializing Stile scan...").start();
    
    try {
      // Load configuration
      const config = await loadConfig(options.config, options.path);
      spinner.text = "Loading plugins...";
      
      // Initialize engine
      const engine = new StileEngine();
      await engine.loadPlugins(config.rules.flatMap(rule => rule.use));
      
      spinner.text = "Scanning files...";
      
      // Run scan
      const report = await engine.scan(config);
      
      spinner.text = "Saving report...";
      
      // Save report
      await saveReport(report, options.output, options.format);
      
      spinner.succeed(chalk.green("Scan completed successfully!"));
      
      // Print summary
      console.log(chalk.blue("\n📊 Scan Summary:"));
      console.log(chalk.gray(`Files scanned: ${report.summary.filesScanned}`));
      console.log(chalk.gray(`Violations found: ${report.summary.violations}`));
      console.log(chalk.gray(`Adherence score: ${report.summary.adherenceScore}%`));
      console.log(chalk.gray(`Duration: ${report.summary.duration}ms`));
      
    } catch (error) {
      spinner.fail(chalk.red("Scan failed:"));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Initialize Stile configuration")
  .option("-p, --path <path>", "Project path", ".")
  .action(async (options) => {
    const configPath = path.join(options.path, "stile.config.js");
    
    if (await fs.pathExists(configPath)) {
      console.log(chalk.yellow("Configuration file already exists!"));
      return;
    }
    
    const config = generateDefaultConfig();
    await fs.writeFile(configPath, config);
    
    console.log(chalk.green("✅ Stile configuration created!"));
    console.log(chalk.gray(`Configuration file: ${configPath}`));
  });

program
  .command("validate")
  .description("Validate configuration file")
  .option("-c, --config <file>", "Configuration file", "stile.config.js")
  .action(async (options) => {
    try {
      await loadConfig(options.config);
      console.log(chalk.green("✅ Configuration is valid!"));
    } catch (error) {
      console.log(chalk.red("❌ Configuration is invalid:"));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

/**
 * Load configuration from file
 */
async function loadConfig(configPath: string, rootDir?: string): Promise<StileConfig> {
  const fullPath = path.resolve(configPath);
  
  if (!(await fs.pathExists(fullPath))) {
    throw new Error(`Configuration file not found: ${fullPath}`);
  }
  
  try {
    // In a real implementation, this would properly load and validate the config
    const config = await import(fullPath);
    const defaultConfig = config.default || config;
    
    return {
      rootDir: rootDir || defaultConfig.rootDir || "./src",
      rules: defaultConfig.rules || [],
      output: defaultConfig.output || { format: "json" },
      exclude: defaultConfig.exclude || [],
    };
  } catch (error) {
    throw new Error(`Failed to load configuration: ${error.message}`);
  }
}

/**
 * Save scan report to file
 */
async function saveReport(report: ScanReport, outputPath: string, format: string): Promise<void> {
  const content = format === "ndjson" 
    ? JSON.stringify(report.meta) + "\n" + report.findings.map(f => JSON.stringify(f)).join("\n")
    : JSON.stringify(report, null, 2);
    
  await fs.writeFile(outputPath, content);
}

/**
 * Generate default configuration
 */
function generateDefaultConfig(): string {
  return `export default {
  rootDir: "./src",
  rules: [
    {
      test: /\\.(t|j)sx?$/,
      use: ["@stile/plugin-no-inline-style", "@stile/plugin-ds-usage"]
    }
  ],
  output: {
    format: "json"
  },
  exclude: [
    "node_modules/**",
    "dist/**",
    "build/**"
  ]
};`;
}

// Parse command line arguments
program.parse();
