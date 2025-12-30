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
  .option("--export", "Force export after scan (overrides config)")
  .option("--no-export", "Disable export even if configured")
  .action(async (options) => {
    const spinner = ora("Initializing Stile scan...").start();
    
    try {
      const config = await loadConfig(options.config, options.path);
      
      // Handle export override flags
      if (options.export !== undefined) {
        if (options.export) {
          // Force enable export
          if (!config.export) {
            throw new Error("--export flag used but no export configuration found in stile.config.js");
          }
          config.export.enabled = true;
        } else {
          // Disable export
          if (config.export) {
            config.export.enabled = false;
          }
        }
      }
      
      spinner.text = "Validating configuration...";
      validateConfig(config);
      
      spinner.text = "Loading plugins...";
      const engine = new StileEngine();
      const pluginNames = config.rules.flatMap((rule) =>
        rule.plugins.map((plugin) => (typeof plugin === "string" ? plugin : plugin.name))
      );
      await engine.ensurePlugins(pluginNames);

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
      
      if (config.export?.enabled) {
        console.log(chalk.green("\n✅ Report exported successfully"));
      }
      
    } catch (error) {
      spinner.fail(chalk.red("Scan failed:"));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
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
    const config = await import(fullPath);
    const defaultConfig = config.default || config;
    
    const rawConfig = defaultConfig || {};

    return {
      rootDir: rootDir || rawConfig.rootDir || "./src",
      rules: normalizeRules(rawConfig.rules || []),
      output: rawConfig.output || { format: "json" },
      export: rawConfig.export, // Include export config
      exclude: rawConfig.exclude || [],
    };
  } catch (error) {
    throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate configuration structure
 */
function validateConfig(config: StileConfig): void {
  if (!config.rootDir) {
    throw new Error("Configuration must have a 'rootDir' property");
  }
  
  if (!config.rules || !Array.isArray(config.rules) || config.rules.length === 0) {
    throw new Error("Configuration must have at least one rule in 'rules' array");
  }
  
  for (const rule of config.rules) {
    if (!rule.plugins || !Array.isArray(rule.plugins) || rule.plugins.length === 0) {
      throw new Error("Each rule must have at least one plugin in 'plugins' array");
    }
    
    // Validate test regex if provided
    if (rule.test && !(rule.test instanceof RegExp)) {
      throw new Error("Rule 'test' property must be a RegExp");
    }
  }
  
  // Validate export config if provided
  if (config.export) {
    if (!config.export.type) {
      throw new Error("Export configuration must have a 'type' property");
    }
    
    const validTypes = ["http", "s3", "kafka", "file"];
    if (!validTypes.includes(config.export.type)) {
      throw new Error(`Export type must be one of: ${validTypes.join(", ")}`);
    }
    
    if (!config.export.endpoint) {
      throw new Error("Export configuration must have an 'endpoint' property");
    }
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
      plugins: [
        "@stile/plugin-no-inline-style",
        "@stile/plugin-ds-usage",
        "@stile/plugin-react-component-analysis"
      ]
    }
  ],
  output: {
    format: "json"
  },
  // Optional: Auto-export after scan
  // Uncomment and configure to enable automatic export
  // export: {
  //   enabled: true,
  //   type: "http",  // http | s3 | kafka | file
  //   endpoint: "http://localhost:3001",  // HTTP endpoint, S3 bucket, or Kafka broker
  //   batchSize: 100,
  //   retries: 3,
  //   timeout: 30000,
  //   auth: {
  //     type: "api-key",  // api-key | bearer | basic
  //     value: "your-api-key-here"
  //   }
  // },
  // Example: Export to file
  // export: {
  //   enabled: true,
  //   type: "file",
  //   endpoint: "./stile-export.json"
  // },
  exclude: [
    "node_modules/**",
    "dist/**",
    "build/**"
  ]
};`;
}

function normalizeRules(rules: any[]): StileConfig["rules"] {
  return rules.map((rule: any) => {
    let test: RegExp | undefined;
    if (rule.test instanceof RegExp) {
      test = rule.test;
    } else if (typeof rule.test === "string") {
      const regexMatch = rule.test.match(/^\/(.+)\/([gimsuy]*)$/);
      test = regexMatch ? new RegExp(regexMatch[1], regexMatch[2]) : new RegExp(rule.test);
    }
    const plugins =
      rule.plugins ||
      rule.use ||
      [];

    const normalizedPlugins = Array.isArray(plugins)
      ? plugins.map((entry: any) => {
          if (typeof entry === "string") return entry;
          if (entry?.name) return { name: entry.name, options: entry.options };
          throw new Error(`Invalid plugin reference: ${JSON.stringify(entry)}`);
        })
      : [];

    return {
      test,
      plugins: normalizedPlugins,
    };
  });
}

// Parse command line arguments
program.parse();
