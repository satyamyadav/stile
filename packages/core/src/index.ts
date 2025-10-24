/**
 * @stile/core - Core engine and plugin system for Stile
 */

import { Project } from "ts-morph";
import { glob } from "glob";
import chalk from "chalk";
import {
  Finding,
  ScanReport,
  StileConfig,
  Plugin,
  FileContext,
} from "@stile/types";

export class StileEngine {
  private project: Project;
  private plugins: Map<string, Plugin> = new Map();

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
    });
  }

  /**
   * Register a plugin with the engine
   */
  registerPlugin(plugin: Plugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Load plugins from configuration
   */
  async loadPlugins(pluginNames: string[]): Promise<void> {
    for (const pluginName of pluginNames) {
      try {
        const plugin = await this.loadPlugin(pluginName);
        this.registerPlugin(plugin);
      } catch (error) {
        console.warn(chalk.yellow(`Failed to load plugin ${pluginName}:`, error));
      }
    }
  }

  /**
   * Load a single plugin dynamically
   */
  private async loadPlugin(pluginName: string): Promise<Plugin> {
    // In a real implementation, this would load from npm or local files
    // For now, we'll return a mock plugin
    return {
      name: pluginName,
      version: "1.0.0",
      apply: (file: FileContext) => {
        // Mock implementation - in real plugins, this would contain actual logic
        return [];
      },
    };
  }

  /**
   * Scan files based on configuration
   */
  async scan(config: StileConfig): Promise<ScanReport> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    let filesScanned = 0;

    console.log(chalk.blue("🔍 Starting Stile scan..."));
    console.log(chalk.gray(`Root directory: ${config.rootDir}`));

    // Find all files to scan
    const files = await this.findFiles(config);
    console.log(chalk.gray(`Found ${files.length} files to scan`));

    for (const filePath of files) {
      try {
        const fileFindings = await this.scanFile(filePath, config);
        findings.push(...fileFindings);
        filesScanned++;
      } catch (error) {
        console.warn(chalk.yellow(`Failed to scan ${filePath}:`, error));
      }
    }

    const duration = Date.now() - startTime;
    const violations = findings.filter(f => f.severity !== "info").length;
    const adherenceScore = this.calculateAdherenceScore(filesScanned, violations);

    const report: ScanReport = {
      meta: {
        project: config.rootDir,
        commit: this.getCurrentCommit(),
        timestamp: new Date().toISOString(),
        version: "0.0.0",
      },
      findings,
      summary: {
        filesScanned,
        violations,
        adherenceScore,
        duration,
      },
    };

    console.log(chalk.green(`✅ Scan completed in ${duration}ms`));
    console.log(chalk.gray(`Files scanned: ${filesScanned}`));
    console.log(chalk.gray(`Violations found: ${violations}`));
    console.log(chalk.gray(`Adherence score: ${adherenceScore}%`));

    return report;
  }

  /**
   * Find files to scan based on configuration
   */
  private async findFiles(config: StileConfig): Promise<string[]> {
    const patterns = config.rules.map(rule => rule.test.toString().slice(1, -1));
    const excludePatterns = config.exclude || [];
    
    const allFiles: string[] = [];
    
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: config.rootDir,
        ignore: excludePatterns,
        absolute: true,
      });
      allFiles.push(...files);
    }

    // Remove duplicates
    return [...new Set(allFiles)];
  }

  /**
   * Scan a single file
   */
  private async scanFile(filePath: string, config: StileConfig): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    // Read file content
    const content = await this.readFile(filePath);
    
    // Create file context
    const fileContext: FileContext = {
      path: filePath,
      content,
      project: config.rootDir,
      commit: this.getCurrentCommit(),
    };

    // Apply rules
    for (const rule of config.rules) {
      if (this.matchesFile(filePath, rule.test)) {
        for (const pluginName of rule.use) {
          const plugin = this.plugins.get(pluginName);
          if (plugin) {
            try {
              const pluginFindings = plugin.apply(fileContext);
              findings.push(...pluginFindings);
            } catch (error) {
              console.warn(chalk.yellow(`Plugin ${pluginName} failed for ${filePath}:`, error));
            }
          }
        }
      }
    }

    return findings;
  }

  /**
   * Check if a file matches a test pattern
   */
  private matchesFile(filePath: string, test: RegExp | string): boolean {
    if (test instanceof RegExp) {
      return test.test(filePath);
    }
    return filePath.includes(test);
  }

  /**
   * Read file content
   */
  private async readFile(filePath: string): Promise<string> {
    const fs = await import("fs/promises");
    return await fs.readFile(filePath, "utf-8");
  }

  /**
   * Get current git commit hash
   */
  private getCurrentCommit(): string {
    try {
      const { execSync } = require("child_process");
      return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
    } catch {
      return "unknown";
    }
  }

  /**
   * Calculate adherence score
   */
  private calculateAdherenceScore(filesScanned: number, violations: number): number {
    if (filesScanned === 0) return 100;
    return Math.max(0, Math.round(((filesScanned - violations) / filesScanned) * 100));
  }
}

// Export the StileEngine class
