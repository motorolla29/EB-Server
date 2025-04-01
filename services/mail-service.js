const dayjs = require('dayjs');
const nodemailer = require('nodemailer');

class MailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  async sendActivationLink(to, link) {
    await this.transporter.sendMail({
      from: process.env.SMTP_MAIL_FROM,
      to: to,
      subject: 'Activation of account on the Exotic Beds website',
      text: '',
      html: `
          <div style="font-family: Anja Eliane, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif; color: #333; line-height: 1.6; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; background-color: #C4E2CF;">
      <style>
        @import url('https://fonts.cdnfonts.com/css/anja-eliane');
      </style>
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://ik.imagekit.io/motorolla29/exotic-beds/logo/EB-LOGO-HD.png?tr=w-500" alt="Exotic Beds Logo" style="max-width: 150px;"/>
      </div>
      <h1 style="color: #004757; font-size: 28px; text-align: center; font-weight: 400;">Welcome to Exotic Beds!</h1>
      <p style="font-size: 16px; text-align: center; color: #4F4A57;">We’re excited to have you on board. To activate your account, simply click the button below:</p>
      <div style="text-align: center; margin: 20px;">
        <a href="${link}" style="display: inline-block; text-decoration: none; padding: 12px 24px; color: #E0F4ED; background-color: #417A7F; border-radius: 5px; font-size: 18px; font-weight: 400;">Activate Account</a>
      </div>
      <p style="font-size: 14px; text-align: center; color: #4F4A57;">If the button above doesn't work, copy and paste the following link into your browser:</p>
      <p style="font-size: 14px; word-wrap: break-word; text-align: center; color: #4F4A57; background-color: #C4E2CF; padding: 10px 0;">${link}</p>
      <footer style="margin-top: 20px; text-align: center; font-size: 12px; color: #522E4C;">
        <p>© 2025 Exotic Beds. All rights reserved.</p>
        <p style="margin: 0;">Need help? Contact us at <a href="mailto:eutyou@gmail.com" style="color: #522E4C;">eutyou@gmail.com</a></p>
      </footer>
    </div>
        `,
    });
  }

  async sendOrderDetails(order) {
    const { email } = order;
    if (!email) return;

    const expectedDeliveryDate = dayjs(order.createdAt)
      .add(10, 'day')
      .format('DD MMMM YYYY');

    const itemsList = order.items
      .map(
        (item) =>
          `<tr style="border-bottom: 1px solid #A1C6BA">
            <td style="padding: 20px 0; display: flex; align-items: flex-start;">
              <img src="https://ik.imagekit.io/motorolla29/exotic-beds/catalog/${
                item.photo
              }?tr=w-150" alt="product_photo" style="width: 50px; height: 50px; border-radius: 5px; object-fit: contain; object-position: center; background: #eefef664">
              <span style="font-size: 14px; color: #004757; padding-left: 10px;">
                ${item.title}
              </span>
            </td>
            <td style="padding: 20px 10px 20px 10px; text-align: center; vertical-align: top; font-size: 14px; color: #004757;">
              ${item.quantity}
            </td>
            <td style="padding: 20px 10px 20px 10px; text-align: right; vertical-align: top; font-size: 14px; color: #004757; white-space: nowrap">
              ${item.sale || item.price} EUR
            </td>
          </tr>`
      )
      .join('');

    const deliveryInfo = `
    <h3 style="color: #004757; font-size: 20px; text-align: center; font-weight: 400; margin-bottom: 5px;">Delivery Details</h3>
    <p style="font-size: 16px; text-align: center; color: #4F4A57; margin: 0">
      ${order.country}, ${order.city}, ${order.address}${
      order.apartment ? ` apt. ${order.apartment}` : ''
    }
    </p>
    <p style="font-size: 16px; text-align: center; color: #4F4A57; margin: 0">
      Estimated Delivery Date: ${expectedDeliveryDate}
    </p>
    <h3 style="color: #004757; font-size: 20px; text-align: center; font-weight: 400; margin-bottom: 5px;">Recipient Details</h3>
    <p style="font-size: 16px; text-align: center; color: #4F4A57; margin: 0;">
      Name: ${order.name} ${order.surname || ''} <br>
      ${order.company ? `Company: ${order.company} <br>` : ''}
      ${
        order.phoneNumber && order.phoneNumber.length > 1
          ? `Phone number: ${order.phoneNumber}`
          : ''
      }
    </p>`;

    await this.transporter.sendMail({
      from: process.env.SMTP_MAIL_FROM,
      to: email,
      subject: 'Your Exotic Beds Order',
      text: '',
      html: `
        <div style="font-family: 'Anja Eliane', system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif; color: #333; line-height: 1.6; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; background-color: #C4E2CF;">
          <style>
            @import url('https://fonts.cdnfonts.com/css/anja-eliane');
          </style>
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://ik.imagekit.io/motorolla29/exotic-beds/logo/EB-LOGO-HD.png?tr=w-500" alt="Exotic Beds Logo" style="max-width: 150px;">
          </div>
          <h1 style="color: #004757; font-size: 28px; text-align: center; font-weight: 400;">Thank You for Your Order!</h1>
          <p style="font-size: 16px; text-align: center; color: #4F4A57;">Your order <strong>№${
            order.id
          }</strong> has been successfully placed.</p>
          <h2 style="color: #004757; font-size: 22px; text-align: center; font-weight: 400;">Order Summary</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 40px;">
            <thead>
              <tr style="background-color: #417A7F; color: #E0F4ED;">
                <th style="font-weight: 400; font-size: 16px; padding: 10px; text-align: left;">Item</th>
                <th style="font-weight: 400; font-size: 16px; padding: 10px; text-align: center;">Qty</th>
                <th style="font-weight: 400; font-size: 16px; padding: 10px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
            ${itemsList}
            </tbody>
            <tfoot style="border-bottom: 1px solid #004757a0">
              <tr>
                <td colspan="2" style="padding: 10px 0 5px 0; text-align: right;  color: #4F4A57;">Shipping cost:</td>
                <td style="font-size: 14px; padding: 10px 0 5px 20px; text-align: right; white-space: nowrap; color: #4F4A57;">
                  ${order.shippingCost} ${order.originalCurrency}
                </td>
              </tr>
              ${
                order.promocode &&
                order.promocodeDiscountTotal &&
                order.promocodeDiscountPercent
                  ? `<tr>
                      <td
                        colspan="2"
                        style="padding: 5px 0 5px 0; text-align: right;  color: #4F4A57;"
                      >
                        Promocode "${order.promocode}" (-${order.promocodeDiscountPercent}%):
                      </td>
                      <td style="font-size: 14px; padding: 5px 0 5px 20px; text-align: right; white-space: nowrap; color: #4F4A57">
                        -${order.promocodeDiscountTotal} ${order.originalCurrency}
                      </td>
                    </tr>`
                  : ''
              }
              <tr>
                <td colspan="2" style="font-size: 16px; padding: 5px 0 10px 0; text-align: right;">Total:</td>
                <td style="font-size: 16px; padding: 5px 0 10px 20px; text-align: right; white-space: nowrap;">${
                  order.originalTotal
                } ${order.originalCurrency}</td>
              </tr>
            </tfoot>
          </table>
          ${deliveryInfo}
          <footer style="margin-top: 50px; text-align: center; font-size: 12px; color: #522E4C;">
            <p>© 2025 Exotic Beds. All rights reserved.</p>
            <p style="margin: 0;">Need help? Contact us at <a href="mailto:eutyou@gmail.com" style="color: #522E4C;">eutyou@gmail.com</a></p>
          </footer>
        </div>`,
    });
  }
  async sendPasswordResetCode(email, code) {
    await this.transporter.sendMail({
      from: process.env.SMTP_MAIL_FROM,
      to: email,
      subject: 'Your Password Reset Code for Exotic Beds',
      text: `Your password reset code is ${code}.`,
      html: `
          <div style="font-family: 'Anja Eliane', system-ui, sans-serif; color: #333; line-height: 1.6; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; background-color: #C4E2CF;">
            <style>
              @import url('https://fonts.cdnfonts.com/css/anja-eliane');
            </style>
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="https://ik.imagekit.io/motorolla29/exotic-beds/logo/EB-LOGO-HD.png?tr=w-500" alt="Exotic Beds Logo" style="max-width: 150px;"/>
            </div>
            <h1 style="color: #004757; font-size: 28px; text-align: center; font-weight: 400;">Password Reset</h1>
            <p style="font-size: 16px; text-align: center; color: #4F4A57;">
              We received a request to reset your password.
            </p>
            <p style="font-size: 20px; text-align: center; color: #004757; margin: 20px 0;">
              <strong>${code}</strong>
            </p>
            <p style="font-size: 14px; text-align: center; color: #4F4A57;">
              Use the code above to reset your password.
            </p>
            <footer style="margin-top: 20px; text-align: center; font-size: 12px; color: #522E4C;">
              <p>© 2025 Exotic Beds. All rights reserved.</p>
              <p style="margin: 0;">Need help? Contact us at <a href="mailto:eutyou@gmail.com" style="color: #522E4C;">eutyou@gmail.com</a></p>
            </footer>
          </div>
        `,
    });
  }
}

module.exports = new MailService();
