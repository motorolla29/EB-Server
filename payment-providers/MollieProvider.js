const mollieClient = require('../config/mollieClient');

class MollieProvider {
  async processPayment(order, returnUrl) {
    try {
      const payment = await mollieClient.payments.create({
        amount: {
          value: order.total, // Mollie требует строковый формат суммы
          currency: order.originalCurrency,
        },
        description: `Order №${order.id} Payment`,
        redirectUrl: returnUrl,
        webhookUrl:
          'https://630f-185-77-216-5.ngrok-free.app/api/orders/molliewebhook',
        metadata: {
          orderId: order.id,
        },
      });

      return {
        paymentId: payment.id,
        confirmationUrl: payment.getCheckoutUrl(),
        status: payment.status,
      };
    } catch (error) {
      console.error('Error processing payment via Mollie:', error);
      throw error;
    }
  }
}

module.exports = MollieProvider;
