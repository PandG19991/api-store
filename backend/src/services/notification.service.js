/**
 * 通知服务
 * 支持微信通知 (Server酱)、企业微信等
 */

import axios from 'axios';
import config from '../config/env.js';

/**
 * Server酱（Server Chan）服务
 * 官网: https://sct.ftqq.com/
 *
 * 使用方法:
 * 1. 注册 Server酱 账号
 * 2. 获取 SendKey
 * 3. 配置环境变量 SERVERCHAN_SEND_KEY
 */
class ServerChanNotification {
  constructor() {
    this.sendKey = config.notification?.serverChan?.sendKey;
    this.apiUrl = 'https://sctapi.ftqq.com';
    this.enabled = !!this.sendKey;
  }

  /**
   * 发送通知
   * @param {string} title - 通知标题
   * @param {string} content - 通知内容 (支持 Markdown)
   * @param {Object} options - 其他选项
   * @returns {Promise<Object>} 发送结果
   */
  async send(title, content, options = {}) {
    if (!this.enabled) {
      console.warn('[ServerChan] SendKey not configured. Notification skipped.');
      return { success: false, message: 'Not configured' };
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/${this.sendKey}.send`,
        {
          title,
          desp: content,
          ...options,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code === 0) {
        console.log('[ServerChan] Notification sent successfully:', title);
        return {
          success: true,
          messageId: response.data.data.pushid,
        };
      } else {
        console.error('[ServerChan] Failed to send notification:', response.data.message);
        return {
          success: false,
          message: response.data.message,
        };
      }
    } catch (error) {
      console.error('[ServerChan] Error sending notification:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 发送库存预警通知
   * @param {Object} product - 产品信息
   * @param {number} stockCount - 当前库存
   * @param {number} threshold - 预警阈值
   * @returns {Promise<Object>} 发送结果
   */
  async sendLowStockAlert(product, stockCount, threshold) {
    const title = `⚠️ 库存预警 - ${product.name}`;

    const content = `
### 📦 产品信息

- **产品名称**: ${product.name}
- **产品 ID**: ${product.id}
- **当前库存**: **${stockCount}** 个
- **预警阈值**: ${threshold} 个
- **产品状态**: ${product.status === 'active' ? '✅ 上架中' : '⛔ 已下架'}

---

### ⚠️ 警告

当前库存已低于预警阈值，请及时补货！

---

### 💡 建议操作

1. 登录管理后台查看详细库存
2. 批量导入新的密钥
3. 如库存耗尽，考虑临时下架产品

---

**时间**: ${new Date().toLocaleString('zh-CN')}
    `.trim();

    return await this.send(title, content);
  }

  /**
   * 发送订单通知
   * @param {Object} order - 订单信息
   * @returns {Promise<Object>} 发送结果
   */
  async sendOrderNotification(order) {
    const title = `🎉 新订单 - ${order.orderNo}`;

    const content = `
### 📋 订单信息

- **订单号**: ${order.orderNo}
- **邮箱**: ${order.email}
- **金额**: ${order.currency} ${parseFloat(order.totalAmount).toFixed(2)}
- **支付方式**: ${order.paymentMethod === 'alipay' ? '支付宝' : '微信支付'}
- **订单状态**: ${this._getOrderStatusText(order.status)}

---

### 🛍️ 商品清单

${order.items.map(item => `- ${item.productName} x ${item.quantity}`).join('\n')}

---

**时间**: ${new Date().toLocaleString('zh-CN')}
    `.trim();

    return await this.send(title, content);
  }

  /**
   * 获取订单状态文本
   * @private
   */
  _getOrderStatusText(status) {
    const statusMap = {
      pending: '⏳ 待支付',
      paid: '💳 已支付',
      completed: '✅ 已完成',
      cancelled: '❌ 已取消',
      refunded: '💸 已退款',
    };
    return statusMap[status] || status;
  }
}

/**
 * 企业微信机器人通知
 * 官方文档: https://developer.work.weixin.qq.com/document/path/91770
 */
class WeComBotNotification {
  constructor() {
    this.webhookUrl = config.notification?.weCom?.webhookUrl;
    this.enabled = !!this.webhookUrl;
  }

  /**
   * 发送 Markdown 消息
   * @param {string} content - Markdown 内容
   * @returns {Promise<Object>} 发送结果
   */
  async sendMarkdown(content) {
    if (!this.enabled) {
      console.warn('[WeCom] Webhook URL not configured. Notification skipped.');
      return { success: false, message: 'Not configured' };
    }

    try {
      const response = await axios.post(
        this.webhookUrl,
        {
          msgtype: 'markdown',
          markdown: {
            content,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.errcode === 0) {
        console.log('[WeCom] Notification sent successfully');
        return { success: true };
      } else {
        console.error('[WeCom] Failed to send notification:', response.data.errmsg);
        return {
          success: false,
          message: response.data.errmsg,
        };
      }
    } catch (error) {
      console.error('[WeCom] Error sending notification:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 发送库存预警
   */
  async sendLowStockAlert(product, stockCount, threshold) {
    const content = `
### ⚠️ 库存预警
> 产品: **${product.name}**
> 当前库存: <font color="warning">${stockCount}</font> 个
> 预警阈值: ${threshold} 个
>
> 请及时补货！
    `.trim();

    return await this.sendMarkdown(content);
  }
}

/**
 * 通知服务管理器
 */
class NotificationService {
  constructor() {
    // 初始化各种通知渠道
    this.serverChan = new ServerChanNotification();
    this.weCom = new WeComBotNotification();
  }

  /**
   * 发送库存预警（多渠道）
   * @param {Object} product - 产品信息
   * @param {number} stockCount - 当前库存
   * @param {number} threshold - 预警阈值
   * @returns {Promise<Object>} 发送结果
   */
  async sendLowStockAlert(product, stockCount, threshold = 10) {
    const results = {
      serverChan: null,
      weCom: null,
    };

    // 发送 Server酱 通知
    if (this.serverChan.enabled) {
      results.serverChan = await this.serverChan.sendLowStockAlert(
        product,
        stockCount,
        threshold
      );
    }

    // 发送企业微信通知
    if (this.weCom.enabled) {
      results.weCom = await this.weCom.sendLowStockAlert(
        product,
        stockCount,
        threshold
      );
    }

    // 判断是否至少有一个渠道发送成功
    const success =
      (results.serverChan && results.serverChan.success) ||
      (results.weCom && results.weCom.success);

    return {
      success,
      results,
    };
  }

  /**
   * 发送新订单通知
   * @param {Object} order - 订单信息
   * @returns {Promise<Object>} 发送结果
   */
  async sendOrderNotification(order) {
    const results = {
      serverChan: null,
    };

    // 发送 Server酱 通知
    if (this.serverChan.enabled) {
      results.serverChan = await this.serverChan.sendOrderNotification(order);
    }

    return {
      success: results.serverChan && results.serverChan.success,
      results,
    };
  }

  /**
   * 检查是否配置了任何通知渠道
   * @returns {boolean} 是否配置
   */
  isConfigured() {
    return this.serverChan.enabled || this.weCom.enabled;
  }

  /**
   * 获取已启用的通知渠道
   * @returns {Array<string>} 通知渠道列表
   */
  getEnabledChannels() {
    const channels = [];
    if (this.serverChan.enabled) channels.push('ServerChan');
    if (this.weCom.enabled) channels.push('WeCom');
    return channels;
  }
}

export default new NotificationService();
