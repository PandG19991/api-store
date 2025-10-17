/**
 * 邮件服务
 * 使用 Nodemailer 发送各类邮件
 */

import nodemailer from 'nodemailer';
import config from '../config/env.js';

/**
 * 邮件模板
 */
const EmailTemplates = {
  /**
   * 验证码邮件模板
   */
  verificationCode: (code, lang = 'zh') => {
    const templates = {
      zh: {
        subject: '您的验证码',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .code { font-size: 32px; font-weight: bold; color: #667eea; text-align: center; padding: 20px; background: white; border-radius: 5px; margin: 20px 0; letter-spacing: 8px; }
              .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📧 验证码</h1>
              </div>
              <div class="content">
                <p>您好，</p>
                <p>您的验证码是：</p>
                <div class="code">${code}</div>
                <p>该验证码将在 <strong>10 分钟</strong> 后过期。</p>
                <p>如果这不是您的操作，请忽略此邮件。</p>
                <div class="footer">
                  <p>此邮件由系统自动发送，请勿回复。</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      },
      en: {
        subject: 'Your Verification Code',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .code { font-size: 32px; font-weight: bold; color: #667eea; text-align: center; padding: 20px; background: white; border-radius: 5px; margin: 20px 0; letter-spacing: 8px; }
              .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📧 Verification Code</h1>
              </div>
              <div class="content">
                <p>Hello,</p>
                <p>Your verification code is:</p>
                <div class="code">${code}</div>
                <p>This code will expire in <strong>10 minutes</strong>.</p>
                <p>If you didn't request this, please ignore this email.</p>
                <div class="footer">
                  <p>This is an automated email. Please do not reply.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      },
    };

    return templates[lang] || templates['en'];
  },

  /**
   * 订单确认邮件模板
   */
  orderConfirmation: (order, licenseKeys, lang = 'zh') => {
    const formatPrice = (amount, currency) => {
      return `${currency} ${parseFloat(amount).toFixed(2)}`;
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US');
    };

    const keysHtml = licenseKeys
      .map(
        (key) => `
        <div style="background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; font-family: monospace;">
          ${key.key}
        </div>
      `
      )
      .join('');

    const templates = {
      zh: {
        subject: `订单确认 - ${order.orderNo}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .order-info { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
              .keys-section { margin-top: 20px; }
              .key-item { background: #f0f0f0; padding: 15px; margin: 10px 0; border-radius: 5px; font-family: monospace; word-break: break-all; }
              .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background: #f5f5f5; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ 支付成功</h1>
                <p>感谢您的购买！</p>
              </div>
              <div class="content">
                <div class="order-info">
                  <h2>订单信息</h2>
                  <table>
                    <tr>
                      <th>订单号</th>
                      <td>${order.orderNo}</td>
                    </tr>
                    <tr>
                      <th>支付时间</th>
                      <td>${formatDate(order.paidAt || order.createdAt)}</td>
                    </tr>
                    <tr>
                      <th>支付金额</th>
                      <td>${formatPrice(order.totalAmount, order.currency)}</td>
                    </tr>
                    <tr>
                      <th>支付方式</th>
                      <td>${order.paymentMethod === 'alipay' ? '支付宝' : '微信支付'}</td>
                    </tr>
                  </table>

                  <h3 style="margin-top: 30px;">商品清单</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>商品名称</th>
                        <th>数量</th>
                        <th>单价</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${order.items
                        .map(
                          (item) => `
                        <tr>
                          <td>${item.productName}</td>
                          <td>${item.quantity}</td>
                          <td>${formatPrice(item.unitPrice, order.currency)}</td>
                        </tr>
                      `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>

                <div class="keys-section">
                  <h2>🔑 您的密钥</h2>
                  <p>请妥善保管以下密钥，建议截图或复制保存：</p>
                  ${keysHtml}
                </div>

                <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-radius: 5px;">
                  <h3>⚠️ 重要提示</h3>
                  <ul>
                    <li>请妥善保管您的密钥，密钥一经发放不支持退款</li>
                    <li>如有任何问题，请联系客服并提供订单号</li>
                    <li>您可以随时使用邮箱和验证码查询订单详情</li>
                  </ul>
                </div>

                <div class="footer">
                  <p>此邮件由系统自动发送，请勿回复。</p>
                  <p>如有疑问，请联系客服。</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      },
      en: {
        subject: `Order Confirmation - ${order.orderNo}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .order-info { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
              .keys-section { margin-top: 20px; }
              .key-item { background: #f0f0f0; padding: 15px; margin: 10px 0; border-radius: 5px; font-family: monospace; word-break: break-all; }
              .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background: #f5f5f5; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Payment Successful</h1>
                <p>Thank you for your purchase!</p>
              </div>
              <div class="content">
                <div class="order-info">
                  <h2>Order Information</h2>
                  <table>
                    <tr>
                      <th>Order No.</th>
                      <td>${order.orderNo}</td>
                    </tr>
                    <tr>
                      <th>Payment Time</th>
                      <td>${formatDate(order.paidAt || order.createdAt)}</td>
                    </tr>
                    <tr>
                      <th>Amount Paid</th>
                      <td>${formatPrice(order.totalAmount, order.currency)}</td>
                    </tr>
                    <tr>
                      <th>Payment Method</th>
                      <td>${order.paymentMethod === 'alipay' ? 'Alipay' : 'WeChat Pay'}</td>
                    </tr>
                  </table>

                  <h3 style="margin-top: 30px;">Items</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${order.items
                        .map(
                          (item) => `
                        <tr>
                          <td>${item.productName}</td>
                          <td>${item.quantity}</td>
                          <td>${formatPrice(item.unitPrice, order.currency)}</td>
                        </tr>
                      `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>

                <div class="keys-section">
                  <h2>🔑 Your License Keys</h2>
                  <p>Please keep the following keys safe. We recommend taking a screenshot or copying them:</p>
                  ${keysHtml}
                </div>

                <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-radius: 5px;">
                  <h3>⚠️ Important Notice</h3>
                  <ul>
                    <li>Please keep your keys safe. Keys are non-refundable once issued</li>
                    <li>If you have any questions, please contact support with your order number</li>
                    <li>You can check your order details anytime using your email and verification code</li>
                  </ul>
                </div>

                <div class="footer">
                  <p>This is an automated email. Please do not reply.</p>
                  <p>If you have any questions, please contact support.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      },
    };

    return templates[lang] || templates['en'];
  },

  /**
   * 库存预警邮件模板
   */
  lowStockAlert: (product, stockCount, lang = 'zh') => {
    const templates = {
      zh: {
        subject: `库存预警 - ${product.name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #ff6b6b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .alert-box { background: #fff3cd; padding: 20px; border-left: 5px solid #ff6b6b; margin: 20px 0; border-radius: 5px; }
              .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⚠️ 库存预警</h1>
              </div>
              <div class="content">
                <div class="alert-box">
                  <h2>${product.name}</h2>
                  <p>当前库存：<strong style="color: #ff6b6b; font-size: 24px;">${stockCount}</strong> 个</p>
                  <p>库存已低于预警阈值，请及时补货！</p>
                </div>

                <div style="margin-top: 20px;">
                  <h3>产品信息</h3>
                  <ul>
                    <li>产品 ID: ${product.id}</li>
                    <li>产品名称: ${product.name}</li>
                    <li>产品状态: ${product.status === 'active' ? '上架' : '下架'}</li>
                  </ul>
                </div>

                <div style="margin-top: 30px; padding: 15px; background: white; border-radius: 5px;">
                  <p><strong>建议操作：</strong></p>
                  <ol>
                    <li>登录管理后台查看详细库存</li>
                    <li>批量导入新的密钥</li>
                    <li>如库存耗尽，考虑临时下架产品</li>
                  </ol>
                </div>

                <div class="footer">
                  <p>此邮件由系统自动发送。</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      },
      en: {
        subject: `Low Stock Alert - ${product.name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #ff6b6b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .alert-box { background: #fff3cd; padding: 20px; border-left: 5px solid #ff6b6b; margin: 20px 0; border-radius: 5px; }
              .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⚠️ Low Stock Alert</h1>
              </div>
              <div class="content">
                <div class="alert-box">
                  <h2>${product.name}</h2>
                  <p>Current Stock: <strong style="color: #ff6b6b; font-size: 24px;">${stockCount}</strong> units</p>
                  <p>Stock is below the warning threshold. Please restock soon!</p>
                </div>

                <div style="margin-top: 20px;">
                  <h3>Product Information</h3>
                  <ul>
                    <li>Product ID: ${product.id}</li>
                    <li>Product Name: ${product.name}</li>
                    <li>Product Status: ${product.status === 'active' ? 'Active' : 'Inactive'}</li>
                  </ul>
                </div>

                <div style="margin-top: 30px; padding: 15px; background: white; border-radius: 5px;">
                  <p><strong>Recommended Actions:</strong></p>
                  <ol>
                    <li>Log in to admin panel to check detailed inventory</li>
                    <li>Bulk import new license keys</li>
                    <li>Consider temporarily deactivating the product if stock runs out</li>
                  </ol>
                </div>

                <div class="footer">
                  <p>This is an automated email.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      },
    };

    return templates[lang] || templates['en'];
  },
};

/**
 * 邮件服务类
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.initializeTransporter();
  }

  /**
   * 初始化邮件传输器
   */
  initializeTransporter() {
    try {
      // 检查邮件配置 (至少需要host)
      if (!config.email.host) {
        console.warn('[Email] Email service not configured. Emails will not be sent.');
        return;
      }

      // 配置传输器选项
      const transportOptions = {
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure, // true for 465, false for other ports
      };

      // 如果提供了认证信息,则添加auth配置
      if (config.email.user && config.email.pass) {
        transportOptions.auth = {
          user: config.email.user,
          pass: config.email.pass,
        };
      }

      this.transporter = nodemailer.createTransport(transportOptions);

      // 验证连接
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('[Email] SMTP connection failed:', error);
        } else {
          console.log('[Email] SMTP server is ready to send emails');
          this.initialized = true;
        }
      });
    } catch (error) {
      console.error('[Email] Failed to initialize email service:', error);
    }
  }

  /**
   * 发送邮件（通用方法）
   * @param {Object} options - 邮件选项
   * @returns {Promise<Object>} 发送结果
   */
  async sendMail({ to, subject, html, text }) {
    if (!this.initialized || !this.transporter) {
      console.warn('[Email] Email service not initialized. Skipping email to:', to);
      // 开发环境下返回成功（方便测试）
      return {
        success: true,
        messageId: 'dev-mode-no-email',
        preview: process.env.NODE_ENV === 'development' ? { to, subject } : null,
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${config.email.fromName}" <${config.email.fromAddress}>`,
        to,
        subject,
        html,
        text: text || '', // Plain text version (optional)
      });

      console.log('[Email] Email sent successfully:', {
        to,
        subject,
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('[Email] Failed to send email:', error);
      throw error;
    }
  }

  /**
   * 发送验证码邮件
   * @param {string} email - 收件人邮箱
   * @param {string} code - 验证码
   * @param {string} lang - 语言
   * @returns {Promise<Object>} 发送结果
   */
  async sendVerificationCode(email, code, lang = 'zh') {
    const template = EmailTemplates.verificationCode(code, lang);

    return await this.sendMail({
      to: email,
      subject: template.subject,
      html: template.html,
    });
  }

  /**
   * 发送订单确认邮件
   * @param {string} email - 收件人邮箱
   * @param {Object} order - 订单信息
   * @param {Array} licenseKeys - 密钥列表
   * @param {string} lang - 语言
   * @returns {Promise<Object>} 发送结果
   */
  async sendOrderConfirmation(email, order, licenseKeys, lang = 'zh') {
    const template = EmailTemplates.orderConfirmation(order, licenseKeys, lang);

    return await this.sendMail({
      to: email,
      subject: template.subject,
      html: template.html,
    });
  }

  /**
   * 发送库存预警邮件
   * @param {string} email - 收件人邮箱（管理员）
   * @param {Object} product - 产品信息
   * @param {number} stockCount - 当前库存
   * @param {string} lang - 语言
   * @returns {Promise<Object>} 发送结果
   */
  async sendLowStockAlert(email, product, stockCount, lang = 'zh') {
    const template = EmailTemplates.lowStockAlert(product, stockCount, lang);

    return await this.sendMail({
      to: email,
      subject: template.subject,
      html: template.html,
    });
  }
}

export default new EmailService();
