/**
 * @stile/loader - Load scan results into analytics databases
 */

// import { ClickHouseClient } from "clickhouse";
import { Pool } from "pg";
import Fastify from "fastify";
import { z } from "zod";
import chalk from "chalk";
import ora from "ora";
import { request as httpRequest } from "http";
import { ScanReport, Finding, LoaderConfig, ComponentInsight } from "@stile/types";

type ClickHouseHttpClient = {
  exec: (query: string) => Promise<void>;
  insert: (table: string, rows: Record<string, any>[]) => Promise<void>;
};

export class StileLoader {
  private config: LoaderConfig;
  private clickhouseClient?: ClickHouseHttpClient;
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
        this.clickhouseClient = this.createClickHouseClient();
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

      // Load component insights
      await this.loadComponents(report);
      
      spinner.succeed(chalk.green("Load completed successfully!"));
    } catch (error) {
      console.error(error);
      spinner.fail(chalk.red("Load failed:"));
      throw error;
    }
  }

  /**
   * Validate scan report
   */
  private validateReport(report: ScanReport): void {
    const componentSchema = z.object({
      project: z.string(),
      file: z.string(),
      component: z.string(),
      source: z.string(),
      category: z.enum(["design-system", "custom", "third-party"]),
      occurrences: z.number(),
      props: z.array(z.string()),
      framework: z.enum(["react", "vue", "angular", "svelte"]).optional(),
      commit: z.string().optional(),
    });

    const reportSchema = z.object({
      meta: z.object({
        project: z.string(),
        commit: z.string(),
        timestamp: z.string(),
        version: z.string(),
      }),
      findings: z.array(z.object({
        project: z.string(),
        plugin: z.string(),
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
      components: z.array(componentSchema).optional(),
      metrics: z
        .object({
          componentsAnalyzed: z.number(),
          designSystemComponents: z.number(),
          customComponents: z.number(),
        })
        .optional(),
    });

    reportSchema.parse(report);
  }

  /**
   * Load report metadata
   */
  private async loadMetadata(report: ScanReport): Promise<void> {
    const timestamp = new Date(report.meta.timestamp);
    const metadata = {
      project: report.meta.project,
      commit: report.meta.commit,
      timestamp,
      version: report.meta.version,
      files_scanned: report.summary.filesScanned,
      violations: report.summary.violations,
      adherence_score: report.summary.adherenceScore,
      duration: report.summary.duration,
    };

    if (this.clickhouseClient) {
      await this.clickhouseClient.insert("ds_reports", [
        {
          ...metadata,
          timestamp: this.formatClickHouseDate(timestamp),
        },
      ]);
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
   * Load component usage insights
   */
  private async loadComponents(report: ScanReport): Promise<void> {
    const components = report.components || [];
    if (components.length === 0) return;

    const collectedAt = new Date(report.meta.timestamp);

    if (this.clickhouseClient) {
      const rows = components.map((component) => ({
        project: component.project,
        file: component.file,
        component: component.component,
        source: component.source,
        category: component.category,
        occurrences: component.occurrences,
        props: component.props,
        framework: component.framework || null,
        commit: component.commit || report.meta.commit,
        collected_at: this.formatClickHouseDate(collectedAt),
      }));

      await this.clickhouseClient.insert("ds_component_usage", rows);
    }

    if (this.postgresPool) {
      const client = await this.postgresPool.connect();
      try {
        const values = components
          .map((_, index) => {
            const offset = index * 10;
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`;
          })
          .join(", ");

        const params = components.flatMap((component) => [
          component.project,
          component.file,
          component.component,
          component.source,
          component.category,
          component.occurrences,
          component.props,
          component.framework || null,
          component.commit || report.meta.commit,
          collectedAt,
        ]);

        await client.query(
          `
          INSERT INTO ds_component_usage (
            project,
            file,
            component,
            source,
            category,
            occurrences,
            props,
            framework,
            commit,
            collected_at
          )
          VALUES ${values}
          ON CONFLICT (project, file, component, commit) DO UPDATE SET
            source = EXCLUDED.source,
            category = EXCLUDED.category,
            occurrences = EXCLUDED.occurrences,
            props = EXCLUDED.props,
            framework = EXCLUDED.framework,
            collected_at = EXCLUDED.collected_at
        `,
          params
        );
      } finally {
        client.release();
      }
    }
  }

  /**
   * Load a batch of findings
   */
  private async loadFindingsBatch(findings: Finding[]): Promise<void> {
    const processedFindings = findings.map(finding => ({
      project: finding.project,
      plugin: finding.plugin,
      file: finding.file,
      message: finding.message,
      severity: finding.severity,
      line: finding.line || null,
      column: finding.column || null,
      commit: finding.commit || null,
      timestamp: new Date(finding.timestamp),
    }));

    if (this.clickhouseClient) {
      const clickhouseRows = processedFindings.map(finding => ({
        ...finding,
        timestamp: this.formatClickHouseDate(finding.timestamp as Date),
      }));
      await this.clickhouseClient.insert("ds_findings", clickhouseRows);
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
          finding.plugin,
          finding.file,
          finding.message,
          finding.severity,
          finding.line,
          finding.column,
          finding.timestamp,
        ]);

        await client.query(`
          INSERT INTO ds_findings (project, plugin, file, message, severity, line, column, timestamp)
          VALUES ${values}
          ON CONFLICT (project, plugin, file, line, column) DO UPDATE SET
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
        plugin String,
        file String,
        message String,
        severity String,
        line Nullable(UInt32),
        column Nullable(UInt32),
        commit Nullable(String),
        timestamp DateTime
      ) ENGINE = MergeTree()
      ORDER BY (project, plugin, timestamp)
    `);

    await this.clickhouseClient.exec(`
      CREATE TABLE IF NOT EXISTS ds_component_usage (
        project String,
        file String,
        component String,
        source String,
        category String,
        occurrences UInt32,
        props Array(String),
        framework Nullable(String),
        commit Nullable(String),
        collected_at DateTime
      ) ENGINE = MergeTree()
      ORDER BY (project, component, collected_at)
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
          plugin VARCHAR(255) NOT NULL,
          file TEXT NOT NULL,
          message TEXT NOT NULL,
          severity VARCHAR(10) NOT NULL,
          line INTEGER,
          column INTEGER,
          commit VARCHAR(40),
          timestamp TIMESTAMP NOT NULL,
          UNIQUE(project, plugin, file, line, column)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS ds_component_usage (
          id SERIAL PRIMARY KEY,
          project VARCHAR(255) NOT NULL,
          file TEXT NOT NULL,
          component VARCHAR(255) NOT NULL,
          source TEXT NOT NULL,
          category VARCHAR(50) NOT NULL,
          occurrences INTEGER NOT NULL,
          props TEXT[] NOT NULL,
          framework VARCHAR(50),
          commit VARCHAR(40),
          collected_at TIMESTAMP NOT NULL,
          UNIQUE(project, file, component, commit)
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ds_findings_project ON ds_findings(project)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ds_findings_plugin ON ds_findings(plugin)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ds_findings_timestamp ON ds_findings(timestamp)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ds_component_usage_project ON ds_component_usage(project)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ds_component_usage_component ON ds_component_usage(component)
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Initialize a lightweight ClickHouse HTTP client
   */
  private createClickHouseClient(): ClickHouseHttpClient {
    const { host, port, username, password, database } = this.config.database;
    const exec = async (query: string, body?: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const headers: Record<string, string> = {};
        if (username) headers["X-ClickHouse-User"] = username;
        if (password) headers["X-ClickHouse-Key"] = password;
        if (body) headers["Content-Type"] = "application/json";

        const path = `/?database=${encodeURIComponent(
          database
        )}&query=${encodeURIComponent(query)}`;

        const req = httpRequest(
          {
            host,
            port,
            path,
            method: "POST",
            headers,
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            res.on("end", () => {
              const statusCode = res.statusCode ?? 0;
              if (statusCode >= 200 && statusCode < 300) {
                resolve();
              } else {
                const message = Buffer.concat(chunks).toString("utf-8");
                reject(
                  new Error(
                    `ClickHouse error (${statusCode}): ${message || "Unknown error"}`
                  )
                );
              }
            });
          }
        );

        req.on("error", (error) => reject(error));

        if (body) {
          req.write(body);
        }

        req.end();
      });
    };

    return {
      exec: (query: string) => exec(query),
      insert: (table: string, rows: Record<string, any>[]) => {
        if (rows.length === 0) return Promise.resolve();
        const payload = rows.map((row) => JSON.stringify(row)).join("\n");
        return exec(`INSERT INTO ${table} FORMAT JSONEachRow`, payload);
      },
    };
  }

  private formatClickHouseDate(input: Date): string {
    const iso = input.toISOString();
    const withoutMs = iso.split(".")[0];
    return withoutMs.replace("T", " ");
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
