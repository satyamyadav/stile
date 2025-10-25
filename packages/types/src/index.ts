/**
 * @stile/types - Shared TypeScript interfaces for the Stile platform
 */

export interface Finding {
  plugin: string;
  message: string;
  severity: "info" | "warn" | "error";
  file: string;
  project: string;
  timestamp: string;
  line?: number;
  column?: number;
  commit?: string;
  metadata?: Record<string, any>;
}

export interface ComponentInsight {
  project: string;
  file: string;
  component: string;
  source: string;
  category: "design-system" | "custom" | "third-party";
  occurrences: number;
  props: string[];
  commit?: string;
  framework?: "react" | "vue" | "angular" | "svelte";
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
  components?: ComponentInsight[];
  metrics?: {
    componentsAnalyzed: number;
    designSystemComponents: number;
    customComponents: number;
  };
}

export interface StileRule {
  test?: RegExp;
  plugins: Array<string | { name: string; options?: Record<string, any> }>;
}

export interface StileConfig {
  rootDir: string;
  rules: StileRule[];
  output?: {
    format: "json" | "ndjson";
    file?: string;
  };
  exclude?: string[];
}

export interface StileContext {
  filePath: string;
  project: string;
  source: string;
  findings: Finding[];
  components: ComponentInsight[];
  commit?: string;
}

export interface StilePlugin {
  name: string;
  test?: RegExp;
  run: (context: StileContext, options?: Record<string, any>) => void | Promise<void>;
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
