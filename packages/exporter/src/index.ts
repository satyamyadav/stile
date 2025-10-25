/**
 * @stile/exporter - Export scan results to various destinations
 */

import axios, { AxiosInstance } from "axios";
import { S3 } from "aws-sdk";
import { Kafka } from "kafkajs";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs-extra";
import * as path from "path";
import { ScanReport, ExporterConfig } from "@stile/types";

export class StileExporter {
  private config: ExporterConfig;
  private httpClient?: AxiosInstance;
  private s3Client?: S3;
  private kafkaClient?: Kafka;

  constructor(config: ExporterConfig) {
    this.config = config;
    this.initializeClients();
  }

  /**
   * Initialize clients based on configuration
   */
  private initializeClients(): void {
    switch (this.config.type) {
      case "http":
        this.httpClient = axios.create({
          baseURL: this.config.endpoint,
          timeout: this.config.timeout || 30000,
          headers: this.getAuthHeaders(),
        });
        break;
        
      case "s3":
        this.s3Client = new S3({
          region: "us-east-1", // Default region
          ...(this.config.auth && {
            accessKeyId: this.config.auth.value,
            secretAccessKey: this.config.auth.value,
          }),
        });
        break;
        
      case "kafka":
        this.kafkaClient = new Kafka({
          clientId: "stile-exporter",
          brokers: [this.config.endpoint],
          ...(this.config.auth && {
            sasl: {
              mechanism: "plain",
              username: "stile",
              password: this.config.auth.value,
            },
          }),
        });
        break;
    }
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    if (!this.config.auth) return {};
    
    switch (this.config.auth.type) {
      case "api-key":
        return { "X-API-Key": this.config.auth.value };
      case "bearer":
        return { Authorization: `Bearer ${this.config.auth.value}` };
      case "basic":
        return { Authorization: `Basic ${Buffer.from(this.config.auth.value).toString("base64")}` };
      default:
        return {};
    }
  }

  /**
   * Export scan report
   */
  async export(report: ScanReport): Promise<void> {
    const spinner = ora("Exporting scan report...").start();
    
    try {
      switch (this.config.type) {
        case "http":
          await this.exportToHttp(report);
          break;
        case "s3":
          await this.exportToS3(report);
          break;
        case "kafka":
          await this.exportToKafka(report);
          break;
        default:
          throw new Error(`Unsupported export type: ${this.config.type}`);
      }
      
      spinner.succeed(chalk.green("Export completed successfully!"));
    } catch (error) {
      console.error(error);
      spinner.fail(chalk.red("Export failed:"));
      throw error;
    }
  }

  /**
   * Export to HTTP endpoint
   */
  private async exportToHttp(report: ScanReport): Promise<void> {
    if (!this.httpClient) {
      throw new Error("HTTP client not initialized");
    }

    await this.httpClient.post("/reports", report);
  }

  /**
   * Export to S3
   */
  private async exportToS3(report: ScanReport): Promise<void> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    const key = `stile-reports/${report.meta.project}/${report.meta.timestamp}.json`;
    const content = JSON.stringify(report, null, 2);

    await this.s3Client.upload({
      Bucket: this.config.endpoint,
      Key: key,
      Body: content,
      ContentType: "application/json",
    }).promise();
  }

  /**
   * Export to Kafka
   */
  private async exportToKafka(report: ScanReport): Promise<void> {
    if (!this.kafkaClient) {
      throw new Error("Kafka client not initialized");
    }

    const producer = this.kafkaClient.producer();
    await producer.connect();

    try {
      // Send metadata
      await producer.send({
        topic: "stile-reports",
        messages: [{
          key: report.meta.project,
          value: JSON.stringify({
            meta: report.meta,
            summary: report.summary,
          }),
        }],
      });

      // Send findings in batches
      const batchSize = this.config.batchSize || 100;
      const findings = report.findings;
      const components = report.components || [];
      
      for (let i = 0; i < findings.length; i += batchSize) {
        const batch = findings.slice(i, i + batchSize);
        await producer.send({
          topic: "stile-findings",
          messages: batch.map(finding => ({
            key: finding.project,
            value: JSON.stringify(finding),
          })),
        });
      }

      for (let i = 0; i < components.length; i += batchSize) {
        const batch = components.slice(i, i + batchSize);
        await producer.send({
          topic: "stile-components",
          messages: batch.map(component => ({
            key: component.project,
            value: JSON.stringify(component),
          })),
        });
      }
    } finally {
      await producer.disconnect();
    }
  }

  /**
   * Export from file
   */
  async exportFromFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, "utf-8");
    const report: ScanReport = JSON.parse(content);
    await this.export(report);
  }
}

/**
 * CLI interface for the exporter
 */
export async function runExporterCli(): Promise<void> {
  const { Command } = await import("commander");
  const program = new Command();

  program
    .name("stile-exporter")
    .description("Export Stile scan results")
    .version("0.0.0");

  program
    .command("push")
    .description("Push scan results to destination")
    .option("-c, --config <file>", "Configuration file", "stile.exporter.config.js")
    .option("-f, --file <file>", "Scan report file", "stile-report.json")
    .action(async (options) => {
      try {
        const config = await loadExporterConfig(options.config);
        const exporter = new StileExporter(config);
        await exporter.exportFromFile(options.file);
      } catch (error) {
        console.error(chalk.red("Export failed:"), error.message);
        process.exit(1);
      }
    });

  program.parse();
}

/**
 * Load exporter configuration
 */
async function loadExporterConfig(configPath: string): Promise<ExporterConfig> {
  const config = await import(path.resolve(configPath));
  return config.default || config;
}
