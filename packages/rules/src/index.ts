/**
 * @stile/rules - Default rule plugins for Stile
 */

import { Project, SourceFile } from "ts-morph";
import { Plugin, Finding, FileContext } from "@stile/types";

/**
 * Plugin to detect inline styles
 */
export class NoInlineStylePlugin implements Plugin {
  name = "@stile/plugin-no-inline-style";
  version = "1.0.0";

  apply(file: FileContext): Finding[] {
    const findings: Finding[] = [];
    
    // Check for inline styles in JSX/TSX files
    if (file.path.endsWith('.tsx') || file.path.endsWith('.jsx')) {
      const inlineStyleRegex = /style\s*=\s*\{[^}]*\}/g;
      const matches = file.content.match(inlineStyleRegex);
      
      if (matches) {
        matches.forEach((match, index) => {
          findings.push({
            project: file.project,
            rule: this.name,
            file: file.path,
            message: `Inline style detected: ${match.substring(0, 50)}...`,
            severity: "error",
            timestamp: new Date().toISOString(),
          });
        });
      }
    }

    return findings;
  }
}

/**
 * Plugin to detect design system usage
 */
export class DesignSystemUsagePlugin implements Plugin {
  name = "@stile/plugin-ds-usage";
  version = "1.0.0";

  apply(file: FileContext): Finding[] {
    const findings: Finding[] = [];
    
    // Check for design system component imports
    const dsImportRegex = /import.*from\s+['"](@design-system|@ui|@components)/g;
    const hasDSImports = dsImportRegex.test(file.content);
    
    if (!hasDSImports && (file.path.endsWith('.tsx') || file.path.endsWith('.jsx'))) {
      findings.push({
        project: file.project,
        rule: this.name,
        file: file.path,
        message: "No design system imports detected",
        severity: "warn",
        timestamp: new Date().toISOString(),
      });
    }

    // Check for hardcoded colors
    const colorRegex = /#[0-9a-fA-F]{3,6}|rgb\(|rgba\(|hsl\(|hsla\(/g;
    const colorMatches = file.content.match(colorRegex);
    
    if (colorMatches) {
      findings.push({
        project: file.project,
        rule: this.name,
        file: file.path,
        message: `Hardcoded colors detected: ${colorMatches.length} instances`,
        severity: "warn",
        timestamp: new Date().toISOString(),
      });
    }

    return findings;
  }
}

/**
 * Plugin to detect unused components
 */
export class UnusedComponentsPlugin implements Plugin {
  name = "@stile/plugin-unused-components";
  version = "1.0.0";

  apply(file: FileContext): Finding[] {
    const findings: Finding[] = [];
    
    // This is a simplified version - in a real implementation,
    // this would analyze the entire codebase to find truly unused components
    const componentRegex = /export\s+(?:const|function)\s+([A-Z][a-zA-Z0-9]*)/g;
    const components: string[] = [];
    let match;
    
    while ((match = componentRegex.exec(file.content)) !== null) {
      components.push(match[1]);
    }

    // Check if components are used elsewhere in the file
    components.forEach(component => {
      const usageRegex = new RegExp(`<${component}[\\s>]`, 'g');
      const usages = file.content.match(usageRegex);
      
      if (!usages || usages.length === 0) {
        findings.push({
          project: file.project,
          rule: this.name,
          file: file.path,
          message: `Unused component detected: ${component}`,
          severity: "info",
          timestamp: new Date().toISOString(),
        });
      }
    });

    return findings;
  }
}

/**
 * Plugin to detect inconsistent spacing
 */
export class InconsistentSpacingPlugin implements Plugin {
  name = "@stile/plugin-inconsistent-spacing";
  version = "1.0.0";

  apply(file: FileContext): Finding[] {
    const findings: Finding[] = [];
    
    // Check for inconsistent spacing patterns
    const lines = file.content.split('\n');
    
    lines.forEach((line, index) => {
      // Check for mixed tabs and spaces
      if (line.match(/^\s*[\t ]+/) && line.match(/^\s*[ \t]+/)) {
        findings.push({
          project: file.project,
          rule: this.name,
          file: file.path,
          message: "Mixed tabs and spaces detected",
          severity: "warn",
          line: index + 1,
          timestamp: new Date().toISOString(),
        });
      }

      // Check for trailing whitespace
      if (line.match(/\s+$/)) {
        findings.push({
          project: file.project,
          rule: this.name,
          file: file.path,
          message: "Trailing whitespace detected",
          severity: "info",
          line: index + 1,
          timestamp: new Date().toISOString(),
        });
      }
    });

    return findings;
  }
}

/**
 * Plugin to detect missing accessibility attributes
 */
export class AccessibilityPlugin implements Plugin {
  name = "@stile/plugin-accessibility";
  version = "1.0.0";

  apply(file: FileContext): Finding[] {
    const findings: Finding[] = [];
    
    if (file.path.endsWith('.tsx') || file.path.endsWith('.jsx')) {
      // Check for images without alt text
      const imgRegex = /<img[^>]*(?!alt=)[^>]*>/g;
      const imgMatches = file.content.match(imgRegex);
      
      if (imgMatches) {
        imgMatches.forEach(() => {
          findings.push({
            project: file.project,
            rule: this.name,
            file: file.path,
            message: "Image without alt attribute detected",
            severity: "error",
            timestamp: new Date().toISOString(),
          });
        });
      }

      // Check for buttons without proper labeling
      const buttonRegex = /<button[^>]*(?!aria-label|aria-labelledby)[^>]*>/g;
      const buttonMatches = file.content.match(buttonRegex);
      
      if (buttonMatches) {
        buttonMatches.forEach(() => {
          findings.push({
            project: file.project,
            rule: this.name,
            file: file.path,
            message: "Button without proper labeling detected",
            severity: "warn",
            timestamp: new Date().toISOString(),
          });
        });
      }
    }

    return findings;
  }
}

// Export all plugins
export const plugins = [
  new NoInlineStylePlugin(),
  new DesignSystemUsagePlugin(),
  new UnusedComponentsPlugin(),
  new InconsistentSpacingPlugin(),
  new AccessibilityPlugin(),
];
