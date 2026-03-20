const nodemailer = require('nodemailer');
const logger = require('../config/logger');

/**
 * Email Service
 * Handles email sending for verification codes and notifications
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    const config = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    };

    if (!config.auth.user || !config.auth.pass) {
      logger.warn('Email service not configured');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport(config);
      logger.info('Email service initialized');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Check if email service is configured
   */
  isConfigured() {
    return this.transporter !== null;
  }

  /**
   * Send verification code email
   */
  async sendVerificationCode(email, name, code) {
    if (!this.isConfigured()) {
      logger.warn(`Verification code for ${email}: ${code}`);
      console.log(`\n\n🔐 VERIFICATION CODE for ${email}: ${code}\n\n`);
      return { success: true, logged: true };
    }

    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Webtrackly'}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify Your Email - Webtrackly',
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .code-box { background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌐 Webtrackly</h1>
      <p>Email Verification</p>
    </div>
    <div class="content">
      <h2>Hi ${name}!</h2>
      <p>Thanks for signing up! Please verify your email address to access your dashboard.</p>

      <div class="code-box">
        <p style="margin: 0; font-size: 14px; color: #666;">Your verification code:</p>
        <div class="code">${code}</div>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Valid for 10 minutes</p>
      </div>

      <p>Enter this code on the verification page to activate your account.</p>

      <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
        <strong>Didn't sign up?</strong> You can safely ignore this email.
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Webtrackly. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
        text: `
Hi ${name}!

Thanks for signing up for Webtrackly!

Your verification code is: ${code}

This code will expire in 10 minutes.

Enter this code on the verification page to activate your account.

If you didn't sign up for Webtrackly, you can safely ignore this email.

Best regards,
Webtrackly Team
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info(`Verification email sent to ${email}: ${info.messageId}`);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Failed to send verification email:', error);

      // Fallback: log code if email fails
      console.log(`\n\n🔐 VERIFICATION CODE for ${email}: ${code}\n\n`);

      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email, name) {
    if (!this.isConfigured()) {
      return { success: true, logged: true };
    }

    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Webtrackly'}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Welcome to Webtrackly! 🎉',
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .feature { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; border-radius: 5px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Webtrackly! 🎉</h1>
    </div>
    <div class="content">
      <h2>Hi ${name}!</h2>
      <p>Your email has been verified successfully! You're all set to start tracking your website.</p>

      <h3>What you can do now:</h3>

      <div class="feature">
        <strong>📊 Track Website Traffic</strong>
        <p>Monitor visitors, sources, and locations in real-time</p>
      </div>

      <div class="feature">
        <strong>🔍 SEO Health Monitoring</strong>
        <p>Get automated scans and improvement suggestions</p>
      </div>

      <div class="feature">
        <strong>📞 Event Tracking</strong>
        <p>Track clicks, calls, and form submissions</p>
      </div>

      <p style="margin-top: 30px;">Ready to get started? Log in to your dashboard and add your first website!</p>

      <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
        Need help? Reply to this email and we'll be happy to assist!
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Webtrackly. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info(`Welcome email sent to ${email}: ${info.messageId}`);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      // Non-blocking - don't throw error
      return { success: false };
    }
  }
}

module.exports = new EmailService();
