export default {
  database: {
    type: "clickhouse",
    host: "localhost",
    port: 8123,
    database: "stile",
    username: "stile",
    password: "stile123"
  },
  batchSize: 1000,
  retries: 3
};
