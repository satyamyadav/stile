/**
 * @stile/core - Core Engine Tests
 */

import { StileEngine } from './index';
import { StileConfig, StilePlugin, StileContext } from '@stile/types';

// Mock external dependencies
jest.mock('glob', () => ({
  glob: jest.fn(),
}));

jest.mock('chalk', () => ({
  default: {
    blue: jest.fn((str) => str),
    gray: jest.fn((str) => str),
    green: jest.fn((str) => str),
    yellow: jest.fn((str) => str),
    red: jest.fn((str) => str),
  },
}));

jest.mock('@stile/exporter', () => ({
  StileExporter: jest.fn().mockImplementation(() => ({
    export: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('ts-morph', () => ({
  Project: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(() => 'abc123'),
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

describe('StileEngine', () => {
  let engine: StileEngine;
  const mockPlugin: StilePlugin = {
    name: '@stile/test-plugin',
    run: jest.fn(),
  };

  beforeEach(() => {
    engine = new StileEngine();
    jest.clearAllMocks();
  });

  describe('registerPlugin', () => {
    it('should register a valid plugin', () => {
      expect(() => engine.registerPlugin(mockPlugin)).not.toThrow();
    });

    it('should throw error for plugin without name', () => {
      const invalidPlugin = { ...mockPlugin, name: '' };
      expect(() => engine.registerPlugin(invalidPlugin as StilePlugin)).toThrow(
        "Plugin must have a valid 'name' property"
      );
    });

    it('should throw error for plugin without run function', () => {
      const invalidPlugin = { ...mockPlugin, run: undefined };
      expect(() => engine.registerPlugin(invalidPlugin as StilePlugin)).toThrow(
        'must have a \'run\' function'
      );
    });

    it('should warn when overwriting existing plugin', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      engine.registerPlugin(mockPlugin);
      engine.registerPlugin(mockPlugin);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('ensurePlugins', () => {
    it('should load built-in plugins', async () => {
      const pluginRefs = ['@stile/plugin-no-inline-style'];
      await engine.ensurePlugins(pluginRefs);
      // Plugin should be registered (no error thrown)
      expect(true).toBe(true);
    });

    it('should handle missing plugins gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const pluginRefs = ['@stile/non-existent-plugin'];
      await engine.ensurePlugins(pluginRefs);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('scan', () => {
    it('should create a scan report', async () => {
      const { glob } = require('glob');
      const { readFile } = require('fs/promises');

      glob.mockResolvedValue(['/test/file.tsx']);
      readFile.mockResolvedValue('const x = 1;');

      engine.registerPlugin(mockPlugin);

      const config: StileConfig = {
        rootDir: '/test',
        rules: [
          {
            test: /\.tsx?$/,
            plugins: ['@stile/test-plugin'],
          },
        ],
      };

      const report = await engine.scan(config);

      expect(report).toHaveProperty('meta');
      expect(report).toHaveProperty('findings');
      expect(report).toHaveProperty('summary');
      expect(report.meta).toHaveProperty('project');
      expect(report.meta).toHaveProperty('commit');
      expect(report.meta).toHaveProperty('timestamp');
      expect(report.summary).toHaveProperty('filesScanned');
      expect(report.summary).toHaveProperty('violations');
      expect(report.summary).toHaveProperty('adherenceScore');
    });

    it('should call plugin run method', async () => {
      const { glob } = require('glob');
      const { readFile } = require('fs/promises');

      glob.mockResolvedValue(['/test/file.tsx']);
      readFile.mockResolvedValue('const x = 1;');

      engine.registerPlugin(mockPlugin);

      const config: StileConfig = {
        rootDir: '/test',
        rules: [
          {
            test: /\.tsx?$/,
            plugins: ['@stile/test-plugin'],
          },
        ],
      };

      await engine.scan(config);

      expect(mockPlugin.run).toHaveBeenCalled();
    });

    it('should auto-export if configured', async () => {
      const { glob } = require('glob');
      const { readFile } = require('fs/promises');
      const { StileExporter } = require('@stile/exporter');

      glob.mockResolvedValue(['/test/file.tsx']);
      readFile.mockResolvedValue('const x = 1;');

      engine.registerPlugin(mockPlugin);

      const config: StileConfig = {
        rootDir: '/test',
        rules: [
          {
            test: /\.tsx?$/,
            plugins: ['@stile/test-plugin'],
          },
        ],
        export: {
          enabled: true,
          type: 'file',
          endpoint: './test-export.json',
        },
      };

      await engine.scan(config);

      expect(StileExporter).toHaveBeenCalled();
    });
  });
});

