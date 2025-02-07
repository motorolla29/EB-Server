const axios = require('axios');

class PaymentConversionService {
  constructor() {
    this.apiKey = process.env.FIXER_API_KEY;
    this.baseURL = process.env.FIXER_BASE_URL;
  }

  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      const { data } = await axios.get(this.baseURL, {
        params: {
          access_key: this.apiKey,
          base: fromCurrency,
          symbols: toCurrency,
        },
      });
      if (!data.success) {
        throw new Error(
          data.error ? data.error.info : 'Error getting exchange rate'
        );
      }

      return parseFloat(data.rates[toCurrency]);
    } catch (error) {
      console.error(
        `Error receiving exchange rate ${fromCurrency}→${toCurrency}:`,
        error.message
      );
      throw error;
    }
  }

  async convertCurrency(amount, fromCurrency, toCurrency) {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    return (amount * rate).toFixed(2);
  }
}

module.exports = new PaymentConversionService();
