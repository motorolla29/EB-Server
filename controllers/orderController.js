const ApiError = require('../error/ApiError');
const { Order } = require('../models/models');
const PaymentConversionService = require('../services/payment-convertion-service');
const PaymentProviderFactory = require('../factories/PaymentProviderFactory');

class OrderController {
  async createOrder(req, res, next) {
    try {
      const {
        items,
        total,
        currency = 'EUR',
        paymentProviderName,
        deliveryData,
        description,
        returnUrl,
      } = req.body;

      const userId = req.user?.id || null;

      let amount = total.toString();
      let paymentCurrency = currency.toUpperCase();
      if (paymentProviderName === 'YooKassa' && paymentCurrency !== 'RUB') {
        amount = await PaymentConversionService.convertCurrency(
          total,
          paymentCurrency,
          'RUB'
        );
        paymentCurrency = 'RUB';
      }

      const order = await Order.create({
        userId,
        items,
        paymentProviderName,
        total: amount,
        currency: paymentCurrency,
        originalTotal: total,
        originalCurrency: currency,
        description: description || 'Order',
        status: 'pending',
        ...deliveryData,
      });

      const paymentProvider =
        PaymentProviderFactory.getProvider(paymentProviderName);
      const paymentResult = await paymentProvider.processPayment(
        order,
        `${returnUrl}/?orderId=${order.id}`
      );

      order.paymentId = paymentResult.paymentId;
      order.confirmationUrl = paymentResult.confirmationUrl;
      order.status = paymentResult.status;
      await order.save();

      return res.status(200).json(order);
    } catch (e) {
      console.error(e);
      return next(ApiError.badRequest(e.message));
    }
  }

  // Получение заказов для конкретного пользователя
  async getOrders(req, res, next) {
    try {
      const userId = req.user.id;
      const orders = await Order.findAll({ where: { userId } });
      return res.status(200).json(orders);
    } catch (e) {
      return next(ApiError.badRequest(e.message));
    }
  }

  // Получение одного заказа по ID
  async getOrder(req, res, next) {
    try {
      const { id } = req.params;
      const order = await Order.findOne({ where: { id } });
      if (!order) {
        return next(ApiError.badRequest('Order not found'));
      }
      return res.status(200).json(order);
    } catch (e) {
      return next(ApiError.badRequest(e.message));
    }
  }

  // Обновление заказа, например, при изменении статуса после платежа
  async updateOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { status, paymentId } = req.body;
      const order = await Order.findOne({ where: { id } });
      if (!order) {
        return next(ApiError.badRequest('Order not found'));
      }
      order.status = status;
      if (paymentId) order.paymentId = paymentId;
      await order.save();
      return res.status(200).json(order);
    } catch (e) {
      return next(ApiError.badRequest(e.message));
    }
  }

  async yookassaWebhook(req, res, next) {
    try {
      // Получаем уведомление из тела запроса
      const notification = req.body;
      console.log(notification);

      // Можно добавить валидацию (например, проверить, что уведомление действительно от YooKassa)
      if (!notification || !notification.object) {
        return res.status(400).json({ error: 'Invalid notification data' });
      }

      const payment = notification.object; // объект платежа
      const orderId = payment.metadata && payment.metadata.orderId;

      if (!orderId) {
        return res
          .status(400)
          .json({ error: 'Order ID not found in metadata' });
      }

      // Ищем заказ по orderId (сохранённому в metadata)
      const order = await Order.findOne({ where: { id: orderId } });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Обновляем статус заказа в зависимости от события
      if (notification.event === 'payment.succeeded') {
        order.status = 'paid';

        // Если заказ привязан к авторизованному пользователю, очищаем корзину в БД
        if (order.userId) {
          // Предполагается, что Cart — модель для корзины
          await Cart.destroy({ where: { userId: order.userId } });
        }
      } else if (
        notification.event === 'payment.canceled' ||
        notification.event === 'payment.failed'
      ) {
        order.status = 'failed'; // или 'canceled'
      }

      await order.save();

      // Отправляем положительный ответ
      return res
        .status(200)
        .json({ message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return next(ApiError.internal(error.message));
    }
  }
}

module.exports = new OrderController();
