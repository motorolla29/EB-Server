const ApiError = require('../error/ApiError');
const { Order, BasketProduct } = require('../models/models');
//const PaymentConversionService = require('../services/payment-convertion-service');
const PaymentProviderFactory = require('../factories/PaymentProviderFactory');
const mailService = require('../services/mail-service');
const mollieClient = require('../config/mollieClient');
const productService = require('../services/product-service');
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);

class OrderController {
  async createOrder(req, res, next) {
    try {
      const {
        userId,
        items,
        subtotal,
        total,
        currency = 'EUR',
        promocode,
        promocodeDiscountTotal,
        promocodeDiscountPercent,
        paymentProviderName,
        shippingCost,
        deliveryData,
        description,
        returnUrl,
      } = req.body;

      if (deliveryData?.phoneNumber === '+') {
        deliveryData.phoneNumber = null;
      }

      let amount = total;
      let paymentCurrency = currency.toUpperCase();
      if (paymentProviderName === 'YooKassa' && paymentCurrency !== 'RUB') {
        // Далее шла конвертация евро в рубли для оплаты суммы в рублях на ЮКассе.
        // Поскольку тестовые платежи ЮКассы блокируют большие суммы (более 300 000 руб) и не разрешают проводить оплату решено оставить сумму как есть без конвертации
        // Т.е. платим оригинальную сумму только в рублевом курсе для того чтобы платежи проходили нормально
        // В БД запишем будто оплата прошла в евро
        /////////////////////////////////////////////////////////////////////////////////////////////////////
        // amount = await PaymentConversionService.convertCurrency(
        //   total,
        //   paymentCurrency,
        //   'RUB'
        // );
        // paymentCurrency = 'RUB';
      }

      const order = await Order.create({
        userId,
        items,
        paymentProviderName,
        subtotal,
        total: amount,
        currency: paymentCurrency,
        originalTotal: total,
        originalCurrency: currency,
        promocode,
        promocodeDiscountTotal,
        promocodeDiscountPercent,
        shippingCost,
        description: description || 'Order',
        status: 'pending',
        ...deliveryData,
      });

      const paymentProvider =
        PaymentProviderFactory.getProvider(paymentProviderName);
      const paymentResult = await paymentProvider.processPayment(
        order,
        `${returnUrl}/?orderId=${order.id}&token=${order.token}`
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
      const orders = await Order.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
      });
      return res.status(200).json(orders);
    } catch (e) {
      return next(ApiError.badRequest(e.message));
    }
  }

  // Получение одного заказа по ID
  async getOrder(req, res, next) {
    try {
      const { id } = req.params;
      const token = req.query.token;

      const order = await Order.findOne({ where: { id } });
      if (!order) {
        return next(ApiError.notFound('Order not found'));
      }

      if (req.user) {
        // авторизованный пользователь
        if (order.userId !== req.user.id) {
          return next(ApiError.forbidden('You don’t have access'));
        }
      } else {
        // гость
        if (!token || token !== order.token) {
          return next(ApiError.notFound('Order not found'));
        }
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

      // Можно добавить валидацию (например, проверить, что уведомление действительно от YooKassa)
      if (!notification?.object) {
        return res.status(400).json({ error: 'Invalid notification data' });
      }

      const payment = notification.object; // объект платежа
      const orderId = payment.metadata && payment.metadata?.orderId;

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
        await order.save();

        // Уменьшаем количество товара
        try {
          await productService.decreaseProductStock(order.items);
        } catch (error) {
          console.error('Error decreasing product stock:', error.message);
          // Здесь можно уведомить администратора или выполнить откат, если это критично.
        }

        // Если заказ привязан к авторизованному пользователю, очищаем корзину в БД
        if (order.userId) {
          await BasketProduct.destroy({ where: { basketId: order.userId } });
        }
        // Отправка письма с деталями заказа
        try {
          await mailService.sendOrderDetails(order);
        } catch (emailError) {
          console.error(
            'Error sending order details email:',
            emailError.message
          );
        }
      } else if (
        notification.event === 'payment.canceled' ||
        notification.event === 'payment.failed'
      ) {
        order.status = 'failed';
        await order.save();
      }

      // Отправляем положительный ответ
      return res
        .status(200)
        .json({ message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return next(ApiError.internal(error.message));
    }
  }

  async stripeWebhook(req, res, next) {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // Секретный ключ вебхука

    let event;

    try {
      // Проверка подписи, чтобы убедиться, что запрос пришел от Stripe
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log('Received event:', event);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const orderId = session.metadata?.orderId;

          if (!orderId) {
            return res.status(400).json({ error: 'Order ID not found' });
          }

          const order = await Order.findOne({ where: { id: orderId } });

          if (!order) {
            return res.status(404).json({ error: 'Order not found' });
          }
          // Обновление статуса при успешной оплате
          if (session.payment_status === 'paid') {
            order.status = 'paid';
            await order.save();

            // Уменьшаем количество товара
            try {
              await productService.decreaseProductStock(order.items);
            } catch (error) {
              console.error('Error decreasing product stock:', error.message);
            }

            // Очистка корзины, если она связана с пользователем
            if (order.userId) {
              await BasketProduct.destroy({
                where: { basketId: order.userId },
              });
            }

            // Отправка письма с подтверждением заказа
            try {
              await mailService.sendOrderDetails(order);
            } catch (emailError) {
              console.error(
                'Error sending order details email:',
                emailError.message
              );
            }
          } else {
            console.log(
              `Payment pending for order ${orderId}, waiting for confirmation.`
            );
          }
          break;
        }
        case 'checkout.session.async_payment_succeeded': {
          const session = event.data.object;
          orderId = session.metadata?.orderId;

          if (!orderId) {
            return res.status(400).json({ error: 'Order ID not found' });
          }

          const order = await Order.findOne({ where: { id: orderId } });

          if (!order) {
            return res.status(404).json({ error: 'Order not found' });
          }

          order.status = 'paid';
          await order.save();

          // Уменьшаем количество товара
          try {
            await productService.decreaseProductStock(order.items);
          } catch (error) {
            console.error('Error decreasing product stock:', error.message);
          }

          if (order.userId) {
            await BasketProduct.destroy({ where: { basketId: order.userId } });
          }

          try {
            await mailService.sendOrderDetails(order);
          } catch (emailError) {
            console.error(
              'Error sending order details email:',
              emailError.message
            );
          }

          break;
        }

        case 'checkout.session.async_payment_failed': {
          const session = event.data.object;
          orderId = session.metadata?.orderId;

          if (!orderId) {
            return res.status(400).json({ error: 'Order ID not found' });
          }

          const order = await Order.findOne({ where: { id: orderId } });

          if (!order) {
            return res.status(404).json({ error: 'Order not found' });
          }

          order.status = 'failed';
          await order.save();

          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Возвращаем успешный ответ
      return res
        .status(200)
        .json({ message: 'Webhook processed successfully' });
    } catch (err) {
      console.error('Webhook handling error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async mollieWebhook(req, res, next) {
    try {
      const paymentId = req.body.id;

      if (!paymentId) {
        return res.status(400).json({ error: 'Payment ID not provided' });
      }

      const paymentResponse = await mollieClient.payments.get(paymentId);

      const orderId = paymentResponse.metadata?.orderId;
      if (!orderId) {
        return res
          .status(400)
          .json({ error: 'Order ID not found in metadata' });
      }

      const order = await Order.findOne({ where: { id: orderId } });
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (paymentResponse.status === 'paid') {
        order.status = 'paid';
        await order.save();

        // Уменьшаем количество товара
        try {
          await productService.decreaseProductStock(order.items);
        } catch (error) {
          console.error('Error decreasing product stock:', error.message);
        }

        if (order.userId) {
          await BasketProduct.destroy({ where: { basketId: order.userId } });
        }

        try {
          await mailService.sendOrderDetails(order);
        } catch (emailError) {
          console.error(
            'Error sending order details email:',
            emailError.message
          );
        }
      } else if (
        paymentResponse.status === 'open' ||
        paymentResponse.status === 'pending'
      ) {
        order.status = 'pending';
        await order.save();
      } else if (
        paymentResponse.status === 'cancelled' ||
        paymentResponse.status === 'failed'
      ) {
        order.status = 'failed';
        await order.save();
      }

      return res
        .status(200)
        .json({ message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return next(ApiError.internal(error.message));
    }
  }
}

module.exports = new OrderController();
