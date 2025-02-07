const axios = require('axios');
const uuid = require('uuid');

class YooKassaProvider {
  async processPayment(order, returnUrl) {
    const idempotenceKey = uuid.v4();

    // Формирование данных для платежа
    const paymentData = {
      amount: {
        value: order.total,
        currency: order.currency,
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
      },
      description: order.description || `Payment for the order №${order.id}`,
      metadata: {
        orderId: order.id,
      },
    };

    // Отправка запроса на создание платежа
    const paymentResponse = await axios.post(
      process.env.YOOKASSA_API_URL,
      paymentData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': idempotenceKey,
        },
        auth: {
          username: process.env.YOOKASSA_SHOP_ID,
          password: process.env.YOOKASSA_SECRET_KEY,
        },
      }
    );

    // Возврат результатов обработки платежа
    return {
      paymentId: paymentResponse.data.id,
      confirmationUrl: paymentResponse.data.confirmation.confirmation_url,
      status: paymentResponse.data.status,
    };
  }
}

module.exports = YooKassaProvider;
