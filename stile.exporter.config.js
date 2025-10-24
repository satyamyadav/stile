export default {
  type: "http",
  endpoint: "http://localhost:3001",
  batchSize: 100,
  retries: 3,
  timeout: 30000,
  auth: {
    type: "api-key",
    value: "your-api-key-here"
  }
};
