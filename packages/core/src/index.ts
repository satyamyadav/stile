/**
 * @stile/core - Core engine and plugin system for Stile
 */

import { Project } from "ts-morph";
import { glob } from "glob";
import chalk from "chalk";
import {
  ComponentInsight,
  Finding,
  ScanReport,
  StileConfig,
  StilePlugin,
  StileContext,
} from "@stile/types";
import { StileExporter } from "@stile/exporter";

type LoadedPlugin = {
  definition: StilePlugin;
  options?: Record<string, any>;
};

export class StileEngine {
  private project: Project;
  private pluginRegistry: Map<string, StilePlugin> = new Map();

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
    });
  }

  registerPlugin(plugin: StilePlugin): void {
    // Validate plugin structure
    if (!plugin.name || typeof plugin.name !== "string") {
      throw new Error("Plugin must have a valid 'name' property");
    }
    if (typeof plugin.run !== "function") {
      throw new Error(`Plugin ${plugin.name} must have a 'run' function`);
    }
    
    // Check for duplicate plugin names
    if (this.pluginRegistry.has(plugin.name)) {
      console.warn(chalk.yellow(`Plugin ${plugin.name} is already registered. Overwriting...`));
    }
    
    this.pluginRegistry.set(plugin.name, plugin);
  }

  async ensurePlugins(pluginRefs: string[]): Promise<void> {
    const missingPlugins: string[] = [];
    
    for (const name of pluginRefs) {
      if (this.pluginRegistry.has(name)) continue;
      try {
        const plugin = await this.resolvePlugin(name);
        this.registerPlugin(plugin);
      } catch (error) {
        missingPlugins.push(name);
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(
          chalk.yellow(`⚠️  Failed to load plugin "${name}": ${errorMessage}`)
        );
      }
    }
    
    if (missingPlugins.length > 0) {
      console.warn(
        chalk.yellow(
          `\n⚠️  ${missingPlugins.length} plugin(s) failed to load: ${missingPlugins.join(", ")}\n` +
          `   Make sure these plugins are installed and properly exported.\n`
        )
      );
    }
  }

  private async resolvePlugin(name: string): Promise<StilePlugin> {
    // Try built-in plugins first
    if (name.startsWith("@stile/plugin")) {
      try {
        const builtin = await import("@stile/plugins");
        const lookup: Record<string, string> = {
          "@stile/plugin-no-inline-style": "noInlineStylePlugin",
          "@stile/plugin-ds-usage": "designSystemUsagePlugin",
          "@stile/plugin-unused-components": "unusedComponentsPlugin",
          "@stile/plugin-inconsistent-spacing": "inconsistentSpacingPlugin",
          "@stile/plugin-accessibility": "accessibilityPlugin",
          "@stile/plugin-react-component-analysis": "reactComponentAnalysisPlugin",
          "@stile/plugin-sample-magic-numbers": "sampleMagicNumberPlugin",
        };
        const exportName = lookup[name] || name;
        const candidate = (builtin as Record<string, any>)[exportName];
        if (candidate && typeof candidate === "object" && "run" in candidate) {
          return candidate as StilePlugin;
        }
        throw new Error(`Built-in plugin "${name}" not found. Available: ${Object.keys(lookup).join(", ")}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Built-in plugin")) {
          throw error;
        }
        throw new Error(`Failed to load built-in plugin "${name}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Try external plugin
    try {
      const module = await import(name);
      
      // Check default export
      if (module?.default && typeof module.default === "object" && "run" in module.default) {
        return module.default as StilePlugin;
      }
      
      // Check named export matching the plugin name
      if (module[name] && typeof module[name] === "object" && "run" in module[name]) {
        return module[name] as StilePlugin;
      }
      
      // Check first exported object with 'run' method
      const exported = Object.values(module).find(
        (exp) => typeof exp === "object" && exp !== null && "run" in exp
      );
      if (exported) {
        return exported as StilePlugin;
      }
      
      throw new Error(
        `Module "${name}" does not export a valid StilePlugin. ` +
        `Expected an object with a 'run' function.`
      );
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes("cannot find module") || errorMessage.includes("module not found")) {
          throw new Error(
            `Plugin "${name}" not found. ` +
            `Make sure it's installed: npm install ${name}`
          );
        }
      }
      throw new Error(
        `Failed to load plugin "${name}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async scan(config: StileConfig): Promise<ScanReport> {
    const startTime = Date.now();

    const pluginNames = config.rules.flatMap((rule) =>
      rule.plugins.map((entry) => (typeof entry === "string" ? entry : entry.name))
    );
    await this.ensurePlugins([...new Set(pluginNames)]);

    const findings: Finding[] = [];
    const components: ComponentInsight[] = [];
    let filesScanned = 0;

    console.log(chalk.blue("🔍 Starting Stile scan..."));
    console.log(chalk.gray(`Root directory: ${config.rootDir}`));

    const files = await this.findFiles(config);
    console.log(chalk.gray(`Found ${files.length} files to scan`));

    for (const file of files) {
      try {
        const result = await this.scanFile(file, config);
        findings.push(...result.findings);
        components.push(...result.components);
        filesScanned++;
      } catch (error) {
        console.warn(chalk.yellow(`Failed to scan ${file}: ${error instanceof Error ? error.message : error}`));
      }
    }

    const duration = Date.now() - startTime;
    const violations = findings.filter((finding) => finding.severity !== "info").length;
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
      components,
      metrics: {
        componentsAnalyzed: components.length,
        designSystemComponents: components.filter((c) => c.category === "design-system").length,
        customComponents: components.filter((c) => c.category === "custom").length,
      },
    };

    console.log(chalk.green(`✅ Scan completed in ${duration}ms`));
    console.log(chalk.gray(`Files scanned: ${filesScanned}`));
    console.log(chalk.gray(`Violations found: ${violations}`));
    console.log(chalk.gray(`Adherence score: ${adherenceScore}%`));

    // Auto-export if configured
    if (config.export?.enabled) {
      await this.exportReport(report, config);
    }

    return report;
  }

  /**
   * Export scan report using configured exporter
   */
  private async exportReport(report: ScanReport, config: StileConfig): Promise<void> {
    if (!config.export || !config.export.enabled) {
      return;
    }

    try {
      // Map StileConfig.export to ExporterConfig
      const exporterConfig = {
        type: config.export.type,
        endpoint: config.export.endpoint,
        batchSize: config.export.batchSize,
        retries: config.export.retries,
        timeout: config.export.timeout,
        auth: config.export.auth,
      };

      const exporter = new StileExporter(exporterConfig);
      await exporter.export(report);
      console.log(chalk.green("✅ Report exported successfully"));
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Export failed: ${error instanceof Error ? error.message : error}`));
      // Don't throw - export failure shouldn't fail the scan
    }
  }

  private async findFiles(config: StileConfig): Promise<string[]> {
    const exclude = config.exclude || [];
    const files = await glob("**/*", {
      cwd: config.rootDir,
      ignore: exclude,
      absolute: true,
      nodir: true,
    });

    return files.filter((file) =>
      config.rules.some((rule) => this.fileMatchesRule(file, rule.test))
    );
  }

  private async scanFile(
    filePath: string,
    config: StileConfig
  ): Promise<{ findings: Finding[]; components: ComponentInsight[] }> {
    const source = await this.readFile(filePath);
    const findings: Finding[] = [];
    const components: ComponentInsight[] = [];
    const commit = this.getCurrentCommit();
    const project = config.rootDir;

    const context: StileContext = {
      filePath,
      project,
      source,
      findings,
      components,
      commit,
    };

    for (const rule of config.rules) {
      if (!this.fileMatchesRule(filePath, rule.test)) continue;

      for (const pluginRef of rule.plugins) {
        const { definition, options } = this.resolvePluginReference(pluginRef);
        if (!definition) continue;

        if (definition.test && !definition.test.test(filePath)) continue;

        try {
          const findingStart = findings.length;
          const componentStart = components.length;

          await definition.run(context, options);

          for (let i = findingStart; i < findings.length; i++) {
            const entry = findings[i];
            entry.plugin = entry.plugin || definition.name;
            entry.project = entry.project || project;
            entry.file = entry.file || filePath;
            entry.timestamp = entry.timestamp || new Date().toISOString();
            entry.commit = entry.commit || commit;
          }

          for (let i = componentStart; i < components.length; i++) {
            const comp = components[i];
            comp.project = comp.project || project;
            comp.file = comp.file || filePath;
            comp.commit = comp.commit || commit;
          }
        } catch (error) {
          console.warn(chalk.yellow(`Plugin ${definition.name} failed for ${filePath}: ${error instanceof Error ? error.message : error}`));
        }
      }
    }

    return {
      findings,
      components,
    };
  }

  private resolvePluginReference(
    entry: string | { name: string; options?: Record<string, any> }
  ): LoadedPlugin {
    const name = typeof entry === "string" ? entry : entry.name;
    const definition = this.pluginRegistry.get(name);

    return {
      definition: definition ?? undefined,
      options: typeof entry === "string" ? undefined : entry.options,
    };
  }

  private fileMatchesRule(filePath: string, test?: RegExp): boolean {
    if (!test) return true;
    return test.test(filePath);
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
