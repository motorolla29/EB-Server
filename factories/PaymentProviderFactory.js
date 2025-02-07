const YooKassaProvider = require('../payment-providers/YooKassaProvider');

class PaymentProviderFactory {
  static getProvider(providerName) {
    switch (providerName) {
      case 'YooKassa':
        return new YooKassaProvider();
      default:
        throw new Error('Unknown payment provider');
    }
  }
}

module.exports = PaymentProviderFactory;
