const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);

class StripeProvider {
  async processPayment(order, returnUrl) {
    try {
      // Создание платежной сессии
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: order.originalCurrency,
              product_data: {
                name: `Exotic Beds Order №${order.id} Payment`, // Название товара, например, "Оплата заказа"
              },
              unit_amount: Math.round(order.total * 100), // Строка с общей суммой заказа (в центах)
            },
            quantity: 1, // Одна единица товара (заказа)
          },
        ],
        mode: 'payment',
        success_url: returnUrl,
        cancel_url: returnUrl,
        metadata: {
          orderId: order.id,
        },
      });

      // Возврат результатов обработки платежа
      return {
        paymentId: session.id,
        confirmationUrl: session.url,
        status: session.payment_status,
      };
    } catch (error) {
      console.error('Ошибка при обработке платежа через Stripe:', error);
      throw error;
    }
  }
}

module.exports = StripeProvider;
