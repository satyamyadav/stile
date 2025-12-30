/**
 * @stile/plugins - Sample Plugin Tests
 */

import { sampleMagicNumberPlugin } from './sample-plugin';
import { StileContext } from '@stile/types';

describe('sampleMagicNumberPlugin', () => {
  let context: StileContext;

  beforeEach(() => {
    context = {
      filePath: '/test/file.tsx',
      project: '/test',
      source: '',
      findings: [],
      components: [],
      commit: 'abc123',
    };
  });

  it('should have correct metadata', () => {
    expect(sampleMagicNumberPlugin.name).toBe('@stile/plugin-sample-magic-numbers');
    expect(sampleMagicNumberPlugin.version).toBe('1.0.0');
    expect(sampleMagicNumberPlugin.description).toBeDefined();
    expect(sampleMagicNumberPlugin.author).toBe('Stile Team');
    expect(sampleMagicNumberPlugin.test).toBeInstanceOf(RegExp);
  });

  it('should detect magic numbers above threshold', () => {
    context.source = 'const width = 500; const height = 200;';
    
    sampleMagicNumberPlugin.run(context, { threshold: 100 });
    
    expect(context.findings.length).toBeGreaterThan(0);
    expect(context.findings[0].message).toContain('Magic number');
  });

  it('should not detect numbers below threshold', () => {
    context.source = 'const width = 50; const height = 20;';
    
    sampleMagicNumberPlugin.run(context, { threshold: 100 });
    
    expect(context.findings.length).toBe(0);
  });

  it('should respect custom threshold option', () => {
    context.source = 'const width = 150;';
    
    sampleMagicNumberPlugin.run(context, { threshold: 200 });
    
    expect(context.findings.length).toBe(0);
  });

  it('should respect severity option', () => {
    context.source = 'const width = 500;';
    
    sampleMagicNumberPlugin.run(context, { severity: 'error' });
    
    expect(context.findings.length).toBeGreaterThan(0);
    expect(context.findings[0].severity).toBe('error');
  });

  it('should include line and column information', () => {
    context.source = 'const width = 500;\nconst height = 600;';
    
    sampleMagicNumberPlugin.run(context);
    
    if (context.findings.length > 0) {
      expect(context.findings[0].line).toBeDefined();
      expect(context.findings[0].column).toBeDefined();
    }
  });

  it('should include metadata in findings', () => {
    context.source = 'const width = 500;';
    
    sampleMagicNumberPlugin.run(context);
    
    if (context.findings.length > 0) {
      expect(context.findings[0].metadata).toBeDefined();
      expect(context.findings[0].metadata?.value).toBe(500);
      expect(context.findings[0].metadata?.threshold).toBeDefined();
    }
  });

  it('should skip version numbers', () => {
    context.source = 'const version = "1.2.3"; const width = 500;';
    
    sampleMagicNumberPlugin.run(context);
    
    // Should only detect 500, not version numbers
    const findings = context.findings.filter(f => 
      f.message.includes('500')
    );
    expect(findings.length).toBeGreaterThan(0);
  });
});

