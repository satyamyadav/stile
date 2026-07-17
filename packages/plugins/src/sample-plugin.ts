/**
 * @stile/plugins - Sample Plugin
 * 
 * This is a clean example plugin that demonstrates the StilePlugin interface
 * and follows the TRD specification for plugin development.
 */

import { StilePlugin, StileContext } from "@stile/types";

/**
 * Sample Plugin: Detects hardcoded magic numbers
 * 
 * This plugin demonstrates:
 * - Plugin structure with metadata
 * - Context usage (reading source, writing findings)
 * - Options handling
 * - Line/column detection
 */
export const sampleMagicNumberPlugin: StilePlugin = {
  name: "@stile/plugin-sample-magic-numbers",
  version: "1.0.0",
  description: "Detects hardcoded magic numbers that should be design tokens",
  author: "Stile Team",
  test: /\.(t|j)sx?$/, // Only run on TypeScript/JavaScript files
  
  run(context: StileContext, options?: { 
    threshold?: number;  // Minimum number to flag (default: 100)
    severity?: "warn" | "error";
  }) {
    const { source, filePath, findings } = context;
    const threshold = options?.threshold ?? 100;
    const severity = options?.severity || "warn";
    
    // Find magic numbers (integers >= threshold)
    // This regex matches standalone numbers that aren't part of variable names
    const magicNumberRegex = /\b(\d{3,})\b/g;
    const lines = source.split('\n');
    
    let match: RegExpExecArray | null;
    while ((match = magicNumberRegex.exec(source)) !== null) {
      const number = parseInt(match[1], 10);
      
      // Skip if below threshold
      if (number < threshold) continue;
      
      // Calculate line and column
      const matchIndex = match.index;
      let currentIndex = 0;
      let lineNumber = 1;
      let columnNumber = 1;
      
      for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length + 1; // +1 for newline
        if (currentIndex + lineLength > matchIndex) {
          lineNumber = i + 1;
          columnNumber = matchIndex - currentIndex + 1;
          break;
        }
        currentIndex += lineLength;
      }
      
      // Check if it's likely a magic number (not a version, date, etc.)
      const line = lines[lineNumber - 1];
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      
      // Check if the number is part of a version string (e.g., "1.2.3" or "v1.2.3")
      const beforeMatch = source.substring(Math.max(0, matchStart - 10), matchStart);
      const afterMatch = source.substring(matchEnd, Math.min(source.length, matchEnd + 10));
      const contextAround = beforeMatch + match[0] + afterMatch;
      
      const isLikelyMagicNumber = 
        !contextAround.match(/v?\d+\.\d+\.\d+/) && // Not a semver version
        !contextAround.match(/\d{4}-\d{2}-\d{2}/) && // Not a date
        !contextAround.match(/version\s*[:=]\s*["']?\d/); // Not a version assignment
      
      if (isLikelyMagicNumber) {
        findings.push({
          plugin: "@stile/plugin-sample-magic-numbers",
          message: `Magic number detected: ${number}. Consider using a design token instead.`,
          severity,
          file: filePath,
          project: context.project,
          timestamp: new Date().toISOString(),
          line: lineNumber,
          column: columnNumber,
          metadata: {
            value: number,
            threshold,
            suggestion: "Replace with a design token from your design system",
          },
        });
      }
    }
  },
};

