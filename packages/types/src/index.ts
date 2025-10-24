/**
 * @stile/types - Shared TypeScript interfaces for the Stile platform
 */

export interface Finding {
  project: string;
  rule: string;
  file: string;
  message: string;
  severity: "info" | "warn" | "error";
  line?: number;
  column?: number;
  commit?: string;
  timestamp: string;
}

export interface ScanReport {
  meta: {
    project: string;
    commit: string;
    timestamp: string;
    version: string;
  };
  findings: Finding[];
  summary: {
    filesScanned: number;
    violations: number;
    adherenceScore: number;
    duration: number;
  };
}

export interface PluginConfig {
  test: RegExp | string;
  use: string[];
  options?: Record<string, any>;
}

export interface StileConfig {
  rootDir: string;
  rules: PluginConfig[];
  output?: {
    format: "json" | "ndjson";
    file?: string;
  };
  exclude?: string[];
}

export interface Plugin {
  name: string;
  version: string;
  apply: (file: FileContext) => Finding[];
}

export interface FileContext {
  path: string;
  content: string;
  project: string;
  commit?: string;
}

export interface ExporterConfig {
  type: "http" | "s3" | "kafka";
  endpoint: string;
  batchSize?: number;
  retries?: number;
  timeout?: number;
  auth?: {
    type: "api-key" | "bearer" | "basic";
    value: string;
  };
}

export interface LoaderConfig {
  database: {
    type: "clickhouse" | "postgres";
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  batchSize?: number;
  retries?: number;
}

export interface DashboardConfig {
  port: number;
  database: {
    type: "clickhouse" | "postgres";
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
}
