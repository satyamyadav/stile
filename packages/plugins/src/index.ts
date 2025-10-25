/**
 * @stile/plugins - Default plugin bundle for Stile
 */

import { Project, SyntaxKind } from "ts-morph";
import { StilePlugin } from "@stile/types";

const jsxTest = /\.(t|j)sx$/;

export const noInlineStylePlugin: StilePlugin = {
  name: "@stile/plugin-no-inline-style",
  test: jsxTest,
  run(ctx) {
    const inlineStyleRegex = /style\s*=\s*\{[^}]*\}/g;
    const matches = ctx.source.match(inlineStyleRegex);
    if (!matches) return;

    for (const match of matches) {
      ctx.findings.push({
        plugin: "@stile/plugin-no-inline-style",
        message: `Inline style detected: ${match.slice(0, 60)}…`,
        severity: "warn",
        file: ctx.filePath,
        project: ctx.project,
        timestamp: new Date().toISOString(),
      });
    }
  },
};

export const designSystemUsagePlugin: StilePlugin = {
  name: "@stile/plugin-ds-usage",
  test: jsxTest,
  run(ctx) {
    const dsImportRegex = /import.*from\s+["'](@design-system|@ui|@components|@mui\/)/g;
    const hasDesignSystemImports = dsImportRegex.test(ctx.source);

    if (!hasDesignSystemImports) {
      ctx.findings.push({
        plugin: "@stile/plugin-ds-usage",
        message: "No design system imports detected",
        severity: "warn",
        file: ctx.filePath,
        project: ctx.project,
        timestamp: new Date().toISOString(),
      });
    }

    const colorRegex = /#[0-9a-fA-F]{3,6}|rgba?\(|hsla?\(/g;
    const colorMatches = ctx.source.match(colorRegex);
    if (colorMatches && colorMatches.length > 0) {
      ctx.findings.push({
        plugin: "@stile/plugin-ds-usage",
        message: `Hardcoded colors detected: ${colorMatches.length}`,
        severity: "warn",
        file: ctx.filePath,
        project: ctx.project,
        timestamp: new Date().toISOString(),
      });
    }
  },
};

export const unusedComponentsPlugin: StilePlugin = {
  name: "@stile/plugin-unused-components",
  test: jsxTest,
  run(ctx) {
    const componentRegex = /export\s+(?:const|function)\s+([A-Z][A-Za-z0-9]*)/g;
    const declarations = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = componentRegex.exec(ctx.source)) !== null) {
      declarations.add(match[1]);
    }

    for (const component of declarations) {
      const usageRegex = new RegExp(`<${component}[\\s>]`, "g");
      if (!usageRegex.test(ctx.source)) {
        ctx.findings.push({
          plugin: "@stile/plugin-unused-components",
          message: `Unused component export detected: ${component}`,
          severity: "info",
          file: ctx.filePath,
          project: ctx.project,
          timestamp: new Date().toISOString(),
        });
      }
    }
  },
};

export const inconsistentSpacingPlugin: StilePlugin = {
  name: "@stile/plugin-inconsistent-spacing",
  run(ctx) {
    const lines = ctx.source.split("\n");

    lines.forEach((line, index) => {
      if (/^\s*[\t ]+/.test(line) && /^\s*[ \t]+/.test(line)) {
        ctx.findings.push({
          plugin: "@stile/plugin-inconsistent-spacing",
          message: "Mixed tabs and spaces detected",
          severity: "warn",
          file: ctx.filePath,
          project: ctx.project,
          timestamp: new Date().toISOString(),
          line: index + 1,
        });
      }

      if (/\s+$/.test(line)) {
        ctx.findings.push({
          plugin: "@stile/plugin-inconsistent-spacing",
          message: "Trailing whitespace detected",
          severity: "info",
          file: ctx.filePath,
          project: ctx.project,
          timestamp: new Date().toISOString(),
          line: index + 1,
        });
      }
    });
  },
};

export const accessibilityPlugin: StilePlugin = {
  name: "@stile/plugin-accessibility",
  test: jsxTest,
  run(ctx) {
    const imgRegex = /<img[^>]*(?!alt=)[^>]*>/g;
    const imgMatches = ctx.source.match(imgRegex) || [];
    imgMatches.forEach(() => {
      ctx.findings.push({
        plugin: "@stile/plugin-accessibility",
        message: "Image without alt attribute detected",
        severity: "error",
        file: ctx.filePath,
        project: ctx.project,
        timestamp: new Date().toISOString(),
      });
    });

    const buttonRegex = /<button[^>]*(?!aria-label|aria-labelledby)[^>]*>/g;
    const buttonMatches = ctx.source.match(buttonRegex) || [];
    buttonMatches.forEach(() => {
      ctx.findings.push({
        plugin: "@stile/plugin-accessibility",
        message: "Button without accessible label detected",
        severity: "warn",
        file: ctx.filePath,
        project: ctx.project,
        timestamp: new Date().toISOString(),
      });
    });
  },
};

const reactProject = new Project({ useInMemoryFileSystem: true });

export const reactComponentAnalysisPlugin: StilePlugin = {
  name: "@stile/plugin-react-component-analysis",
  test: jsxTest,
  async run(ctx) {
    const sourceFile = reactProject.createSourceFile(ctx.filePath, ctx.source, {
      overwrite: true,
    });

    const importMap = new Map<string, string>();
    sourceFile.getImportDeclarations().forEach((declaration) => {
      const specifier = declaration.getModuleSpecifierValue();
      const defaultImport = declaration.getDefaultImport();
      if (defaultImport) {
        importMap.set(defaultImport.getText(), specifier);
      }
      declaration.getNamedImports().forEach((named) => {
        importMap.set(named.getName(), specifier);
      });
    });

    const designSystemPrefixes = ["@mui/", "@stile/", "@ds/", "@design-system/"];

    const handleElement = (node: any) => {
      const tagNameNode = node.getTagNameNode?.();
      if (!tagNameNode) return;

      const tagName = tagNameNode.getText();
      if (!/^[A-Z]/.test(tagName)) return;

      const source = importMap.get(tagName) || ".";
      let category: "design-system" | "custom" | "third-party" = "custom";

      if (source === "." || source.startsWith(".")) {
        category = "custom";
      } else if (designSystemPrefixes.some((prefix) => source.startsWith(prefix))) {
        category = "design-system";
      } else {
        category = "third-party";
      }

      const props = new Set<string>();
      node.getAttributes?.().forEach((attribute: any) => {
        if (attribute.getKind() === SyntaxKind.JsxSpreadAttribute) {
          props.add("spread");
          return;
        }
        const nameNode = attribute.getNameNode?.();
        if (nameNode) {
          props.add(nameNode.getText());
        }
      });

      const existing = ctx.components.find(
        (entry) => entry.component === tagName && entry.source === source && entry.file === ctx.filePath
      );

      if (existing) {
        existing.occurrences += 1;
        existing.props = Array.from(new Set([...existing.props, ...props])).sort();
      } else {
        ctx.components.push({
          component: tagName,
          source,
          category,
          occurrences: 1,
          props: Array.from(props).sort(),
          project: ctx.project,
          file: ctx.filePath,
          framework: "react",
          commit: ctx.commit,
        });
      }
    };

    sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).forEach(handleElement);
    sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).forEach(handleElement);
  },
};

export const plugins: StilePlugin[] = [
  noInlineStylePlugin,
  designSystemUsagePlugin,
  unusedComponentsPlugin,
  inconsistentSpacingPlugin,
  accessibilityPlugin,
  reactComponentAnalysisPlugin,
];
