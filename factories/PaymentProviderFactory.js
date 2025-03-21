const MollieProvider = require('../payment-providers/MollieProvider');
const StripeProvider = require('../payment-providers/StripeProvider');
const YooKassaProvider = require('../payment-providers/YooKassaProvider');

class PaymentProviderFactory {
  static getProvider(providerName) {
    switch (providerName) {
      case 'YooKassa':
        return new YooKassaProvider();
      case 'Stripe':
        return new StripeProvider();
      case 'Mollie':
        return new MollieProvider();
      default:
        throw new Error('Unknown payment provider');
    }
  }
}

module.exports = PaymentProviderFactory;
