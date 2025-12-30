export default {
  rootDir: "./src",
  rules: [
    {
      test: /\.(t|j)sx?$/,
      plugins: [
        "@stile/plugin-no-inline-style",
        "@stile/plugin-ds-usage",
        {
          name: "@stile/plugin-sample-magic-numbers",
          options: {
            threshold: 100,
            severity: "warn"
          }
        }
      ]
    }
  ],
  output: {
    format: "json",
    file: "stile-report.json"
  },
  export: {
    enabled: true,
    type: "file",
    endpoint: "./stile-export.json"
  },
  exclude: [
    "node_modules/**",
    "dist/**"
  ]
};

