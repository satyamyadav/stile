/**
 * @stile/loader - Load scan results into analytics databases
 */

// import { ClickHouseClient } from "clickhouse";
import { Pool } from "pg";
import Fastify from "fastify";
import { z } from "zod";
import chalk from "chalk";
import ora from "ora";
import { ScanReport, Finding, LoaderConfig } from "@stile/types";

export class StileLoader {
  private config: LoaderConfig;
  private clickhouseClient?: any;
  private postgresPool?: Pool;

  constructor(config: LoaderConfig) {
    this.config = config;
    this.initializeClients();
  }

  /**
   * Initialize database clients
   */
  private initializeClients(): void {
    switch (this.config.database.type) {
      case "clickhouse":
        // ClickHouse client initialization would go here
        // this.clickhouseClient = new ClickHouseClient({...});
        console.log("ClickHouse client would be initialized here");
        break;
        
      case "postgres":
        this.postgresPool = new Pool({
          host: this.config.database.host,
          port: this.config.database.port,
          database: this.config.database.database,
          user: this.config.database.username,
          password: this.config.database.password,
        });
        break;
    }
  }

  /**
   * Load scan report into database
   */
  async load(report: ScanReport): Promise<void> {
    const spinner = ora("Loading scan report...").start();
    
    try {
      // Validate report
      this.validateReport(report);
      
      // Load metadata
      await this.loadMetadata(report);
      
      // Load findings
      await this.loadFindings(report.findings);
      
      spinner.succeed(chalk.green("Load completed successfully!"));
    } catch (error) {
      spinner.fail(chalk.red("Load failed:"));
      throw error;
    }
  }

  /**
   * Validate scan report
   */
  private validateReport(report: ScanReport): void {
    const reportSchema = z.object({
      meta: z.object({
        project: z.string(),
        commit: z.string(),
        timestamp: z.string(),
        version: z.string(),
      }),
      findings: z.array(z.object({
        project: z.string(),
        rule: z.string(),
        file: z.string(),
        message: z.string(),
        severity: z.enum(["info", "warn", "error"]),
        line: z.number().optional(),
        column: z.number().optional(),
        commit: z.string().optional(),
        timestamp: z.string(),
      })),
      summary: z.object({
        filesScanned: z.number(),
        violations: z.number(),
        adherenceScore: z.number(),
        duration: z.number(),
      }),
    });

    reportSchema.parse(report);
  }

  /**
   * Load report metadata
   */
  private async loadMetadata(report: ScanReport): Promise<void> {
    const metadata = {
      project: report.meta.project,
      commit: report.meta.commit,
      timestamp: new Date(report.meta.timestamp),
      version: report.meta.version,
      files_scanned: report.summary.filesScanned,
      violations: report.summary.violations,
      adherence_score: report.summary.adherenceScore,
      duration: report.summary.duration,
    };

    if (this.clickhouseClient) {
      await this.clickhouseClient.insert({
        table: "ds_reports",
        values: [metadata],
        format: "JSONEachRow",
      });
    }

    if (this.postgresPool) {
      const client = await this.postgresPool.connect();
      try {
        await client.query(`
          INSERT INTO ds_reports (project, commit, timestamp, version, files_scanned, violations, adherence_score, duration)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (project, commit) DO UPDATE SET
            timestamp = EXCLUDED.timestamp,
            version = EXCLUDED.version,
            files_scanned = EXCLUDED.files_scanned,
            violations = EXCLUDED.violations,
            adherence_score = EXCLUDED.adherence_score,
            duration = EXCLUDED.duration
        `, [
          metadata.project,
          metadata.commit,
          metadata.timestamp,
          metadata.version,
          metadata.files_scanned,
          metadata.violations,
          metadata.adherence_score,
          metadata.duration,
        ]);
      } finally {
        client.release();
      }
    }
  }

  /**
   * Load findings
   */
  private async loadFindings(findings: Finding[]): Promise<void> {
    if (findings.length === 0) return;

    const batchSize = this.config.batchSize || 1000;
    
    for (let i = 0; i < findings.length; i += batchSize) {
      const batch = findings.slice(i, i + batchSize);
      await this.loadFindingsBatch(batch);
    }
  }

  /**
   * Load a batch of findings
   */
  private async loadFindingsBatch(findings: Finding[]): Promise<void> {
    const processedFindings = findings.map(finding => ({
      project: finding.project,
      rule: finding.rule,
      file: finding.file,
      message: finding.message,
      severity: finding.severity,
      line: finding.line || null,
      column: finding.column || null,
      commit: finding.commit || null,
      timestamp: new Date(finding.timestamp),
    }));

    if (this.clickhouseClient) {
      await this.clickhouseClient.insert({
        table: "ds_findings",
        values: processedFindings,
        format: "JSONEachRow",
      });
    }

    if (this.postgresPool) {
      const client = await this.postgresPool.connect();
      try {
        const values = processedFindings.map((_, index) => {
          const offset = index * 8;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
        }).join(", ");

        const params = processedFindings.flatMap(finding => [
          finding.project,
          finding.rule,
          finding.file,
          finding.message,
          finding.severity,
          finding.line,
          finding.column,
          finding.timestamp,
        ]);

        await client.query(`
          INSERT INTO ds_findings (project, rule, file, message, severity, line, column, timestamp)
          VALUES ${values}
          ON CONFLICT (project, rule, file, line, column) DO UPDATE SET
            message = EXCLUDED.message,
            severity = EXCLUDED.severity,
            timestamp = EXCLUDED.timestamp
        `, params);
      } finally {
        client.release();
      }
    }
  }

  /**
   * Create database schema
   */
  async createSchema(): Promise<void> {
    const spinner = ora("Creating database schema...").start();
    
    try {
      if (this.clickhouseClient) {
        await this.createClickHouseSchema();
      }
      
      if (this.postgresPool) {
        await this.createPostgresSchema();
      }
      
      spinner.succeed(chalk.green("Schema created successfully!"));
    } catch (error) {
      spinner.fail(chalk.red("Schema creation failed:"));
      throw error;
    }
  }

  /**
   * Create ClickHouse schema
   */
  private async createClickHouseSchema(): Promise<void> {
    if (!this.clickhouseClient) return;

    // Create reports table
    await this.clickhouseClient.exec(`
      CREATE TABLE IF NOT EXISTS ds_reports (
        project String,
        commit String,
        timestamp DateTime,
        version String,
        files_scanned UInt32,
        violations UInt32,
        adherence_score UInt8,
        duration UInt32
      ) ENGINE = MergeTree()
      ORDER BY (project, commit, timestamp)
    `);

    // Create findings table
    await this.clickhouseClient.exec(`
      CREATE TABLE IF NOT EXISTS ds_findings (
        project String,
        rule String,
        file String,
        message String,
        severity String,
        line Nullable(UInt32),
        column Nullable(UInt32),
        commit Nullable(String),
        timestamp DateTime
      ) ENGINE = MergeTree()
      ORDER BY (project, rule, timestamp)
    `);
  }

  /**
   * Create Postgres schema
   */
  private async createPostgresSchema(): Promise<void> {
    if (!this.postgresPool) return;

    const client = await this.postgresPool.connect();
    try {
      // Create reports table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ds_reports (
          id SERIAL PRIMARY KEY,
          project VARCHAR(255) NOT NULL,
          commit VARCHAR(40) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          version VARCHAR(50) NOT NULL,
          files_scanned INTEGER NOT NULL,
          violations INTEGER NOT NULL,
          adherence_score INTEGER NOT NULL,
          duration INTEGER NOT NULL,
          UNIQUE(project, commit)
        )
      `);

      // Create findings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ds_findings (
          id SERIAL PRIMARY KEY,
          project VARCHAR(255) NOT NULL,
          rule VARCHAR(255) NOT NULL,
          file TEXT NOT NULL,
          message TEXT NOT NULL,
          severity VARCHAR(10) NOT NULL,
          line INTEGER,
          column INTEGER,
          commit VARCHAR(40),
          timestamp TIMESTAMP NOT NULL,
          UNIQUE(project, rule, file, line, column)
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ds_findings_project ON ds_findings(project)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ds_findings_rule ON ds_findings(rule)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ds_findings_timestamp ON ds_findings(timestamp)
      `);
    } finally {
      client.release();
    }
  }
}

/**
 * HTTP API for the loader
 */
export class StileLoaderAPI {
  private loader: StileLoader;
  private fastify: any;

  constructor(loader: StileLoader) {
    this.loader = loader;
    this.fastify = Fastify({ logger: true });
    this.setupRoutes();
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.fastify.get("/health", async () => {
      return { status: "ok", timestamp: new Date().toISOString() };
    });

    // Load report
    this.fastify.post("/reports", async (request: any, reply: any) => {
      try {
        const report = request.body as ScanReport;
        await this.loader.load(report);
        return { success: true };
      } catch (error) {
        reply.code(400);
        return { error: error.message };
      }
    });

    // Get reports
    this.fastify.get("/reports", async (request: any) => {
      // Implementation would query the database
      return { reports: [] };
    });
  }

  /**
   * Start the API server
   */
  async start(port: number = 3001): Promise<void> {
    try {
      await this.fastify.listen({ port, host: "0.0.0.0" });
      console.log(chalk.green(`🚀 Stile Loader API running on port ${port}`));
    } catch (error) {
      console.error(chalk.red("Failed to start API server:"), error);
      throw error;
    }
  }

  /**
   * Stop the API server
   */
  async stop(): Promise<void> {
    await this.fastify.close();
  }
}
