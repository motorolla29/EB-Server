const { createMollieClient } = require('@mollie/api-client');

const mollieClient = createMollieClient({
  apiKey: process.env.MOLLIE_API_KEY,
});

module.exports = mollieClient;
