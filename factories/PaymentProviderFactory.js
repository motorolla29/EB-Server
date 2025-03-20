const StripeProvider = require('../payment-providers/StripeProvider');
const YooKassaProvider = require('../payment-providers/YooKassaProvider');

class PaymentProviderFactory {
  static getProvider(providerName) {
    switch (providerName) {
      case 'YooKassa':
        return new YooKassaProvider();
      case 'Stripe':
        return new StripeProvider();
      default:
        throw new Error('Unknown payment provider');
    }
  }
}

module.exports = PaymentProviderFactory;
