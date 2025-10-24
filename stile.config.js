export default {
  rootDir: "./src",
  rules: [
    {
      test: /\.(t|j)sx?$/,
      use: ["@stile/plugin-no-inline-style", "@stile/plugin-ds-usage"]
    },
    {
      test: /\.(css|scss|sass)$/,
      use: ["@stile/plugin-inconsistent-spacing"]
    }
  ],
  output: {
    format: "json"
  },
  exclude: [
    "node_modules/**",
    "dist/**",
    "build/**",
    "**/*.test.*",
    "**/*.spec.*"
  ]
};
