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
      from: process.env.SMTP_USER,
      to: to,
      subject: 'Activation of account on the Exotic Beds website',
      text: '',
      html: `
          <div style="font-family: 'Anja Eliane', Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; background-color: #C4E2CF;">
        <style>
          @import url('https://fonts.cdnfonts.com/css/anja-eliane');
        </style>
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://ik.imagekit.io/motorolla29/exotic-beds/logo/EB-LOGO-HD.png?tr=w-500" alt="Exotic Beds Logo" style="max-width: 150px;"/>
        </div>
        <h1 style="color: #004757; font-size: 28px; text-align: center; font-weight: 400;">Welcome to Exotic Beds!</h1>
        <p style="font-size: 16px; text-align: center; color: #4F4A57;">We’re excited to have you on board. To activate your account, simply click the button below:</p>
        <div style="text-align: center; margin: 20px;">
          <a href="${link}" style="display: inline-block; text-decoration: none; padding: 12px 24px; color: #eefef6eb; background-color: #004757aa; border-radius: 5px; font-size: 18px; font-weight: 400;">Activate Account</a>
        </div>
        <p style="font-size: 14px; text-align: center; color: #4F4A57;">If the button above doesn't work, copy and paste the following link into your browser:</p>
        <p style="font-size: 14px; word-wrap: break-word; text-align: center; color: #4F4A57; background-color: #C4E2CF; padding: 10px 0;">${link}</p>
        <footer style="margin-top: 20px; text-align: center; font-size: 12px; color: #522E4C;">
          <p>© 2024 Exotic Beds. All rights reserved.</p>
          <p style="margin: 0;">Need help? Contact us at <a href="mailto:eutyou@gmail.com" style="color: #522E4C;">eutyou@gmail.com</a></p>
        </footer>
      </div>
        `,
    });
  }
}

module.exports = new MailService();
