/**
 * 支付服务
 * 集成支付宝和微信支付
 */

import crypto from 'crypto';
import axios from 'axios';
import config from '../config/env.js';
import { BadRequestError } from '../middleware/errorHandler.js';

/**
 * 支付方式枚举
 */
export const PaymentMethod = {
  ALIPAY: 'alipay',
  WECHAT: 'wechat',
};

/**
 * 支付状态枚举
 */
export const PaymentStatus = {
  PENDING: 'pending',       // 待支付
  PROCESSING: 'processing', // 处理中
  SUCCESS: 'success',       // 支付成功
  FAILED: 'failed',         // 支付失败
  CANCELLED: 'cancelled',   // 已取消
  REFUNDED: 'refunded',     // 已退款
};

/**
 * 支付服务基类
 */
class BasePaymentProvider {
  /**
   * 创建支付订单
   * @param {Object} params - 支付参数
   * @returns {Promise<Object>} 支付信息
   */
  async createPayment(params) {
    throw new Error('createPayment must be implemented');
  }

  /**
   * 验证支付回调签名
   * @param {Object} params - 回调参数
   * @returns {boolean} 是否验证通过
   */
  verifyCallback(params) {
    throw new Error('verifyCallback must be implemented');
  }

  /**
   * 查询支付状态
   * @param {string} transactionId - 交易ID
   * @returns {Promise<Object>} 支付状态
   */
  async queryPayment(transactionId) {
    throw new Error('queryPayment must be implemented');
  }

  /**
   * 退款
   * @param {Object} params - 退款参数
   * @returns {Promise<Object>} 退款结果
   */
  async refund(params) {
    throw new Error('refund must be implemented');
  }
}

/**
 * 支付宝支付服务
 * 使用支付宝电脑网站支付 API
 */
class AlipayProvider extends BasePaymentProvider {
  constructor() {
    super();
    this.appId = config.payment.alipay.appId;
    this.privateKey = config.payment.alipay.privateKey;
    this.publicKey = config.payment.alipay.publicKey;
    this.gatewayUrl = 'https://openapi.alipay.com/gateway.do';
    this.notifyUrl = `${config.payment.callbackUrl}/api/payments/alipay/notify`;
    this.returnUrl = `${config.payment.callbackUrl}/api/payments/alipay/return`;
  }

  /**
   * 创建支付订单
   * @param {Object} params
   * @param {string} params.orderNo - 订单号
   * @param {number} params.amount - 金额（元）
   * @param {string} params.subject - 商品标题
   * @param {string} params.description - 商品描述
   * @returns {Promise<Object>} 支付表单 HTML
   */
  async createPayment({ orderNo, amount, subject, description }) {
    // 检查配置
    if (!this.appId || !this.privateKey) {
      throw new BadRequestError('Alipay not configured');
    }

    // 构建请求参数
    const bizContent = {
      out_trade_no: orderNo,
      total_amount: amount.toFixed(2),
      subject: subject,
      body: description,
      product_code: 'FAST_INSTANT_TRADE_PAY', // 电脑网站支付
    };

    const params = {
      app_id: this.appId,
      method: 'alipay.trade.page.pay',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.getTimestamp(),
      version: '1.0',
      notify_url: this.notifyUrl,
      return_url: this.returnUrl,
      biz_content: JSON.stringify(bizContent),
    };

    // 签名
    const sign = this.sign(params);
    params.sign = sign;

    // 构建支付 URL
    const paymentUrl = this.buildUrl(params);

    return {
      method: PaymentMethod.ALIPAY,
      paymentUrl,
      orderNo,
    };
  }

  /**
   * 验证支付回调签名
   * @param {Object} params - 支付宝回调参数
   * @returns {boolean} 是否验证通过
   */
  verifyCallback(params) {
    if (!this.publicKey) {
      console.warn('[Alipay] Public key not configured, skipping verification');
      return false;
    }

    const { sign, sign_type, ...paramsWithoutSign } = params;

    if (!sign) {
      return false;
    }

    // 按字典序排序并生成签名字符串
    const signString = this.getSignContent(paramsWithoutSign);

    // 验证签名
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signString, 'utf8');

    try {
      return verifier.verify(
        this.formatPublicKey(this.publicKey),
        sign,
        'base64'
      );
    } catch (error) {
      console.error('[Alipay] Signature verification error:', error);
      return false;
    }
  }

  /**
   * 查询支付状态
   * @param {string} orderNo - 商户订单号
   * @returns {Promise<Object>} 支付状态
   */
  async queryPayment(orderNo) {
    if (!this.appId || !this.privateKey) {
      throw new BadRequestError('Alipay not configured');
    }

    const params = {
      app_id: this.appId,
      method: 'alipay.trade.query',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.getTimestamp(),
      version: '1.0',
      biz_content: JSON.stringify({
        out_trade_no: orderNo,
      }),
    };

    const sign = this.sign(params);
    params.sign = sign;

    try {
      const response = await axios.post(this.gatewayUrl, null, { params });
      const result = response.data.alipay_trade_query_response;

      return {
        success: result.code === '10000',
        tradeNo: result.trade_no,
        orderNo: result.out_trade_no,
        tradeStatus: result.trade_status,
        totalAmount: result.total_amount,
      };
    } catch (error) {
      console.error('[Alipay] Query error:', error);
      throw new BadRequestError('Failed to query payment status');
    }
  }

  /**
   * 退款
   * @param {Object} params
   * @param {string} params.orderNo - 商户订单号
   * @param {number} params.refundAmount - 退款金额
   * @param {string} params.refundReason - 退款原因
   * @returns {Promise<Object>} 退款结果
   */
  async refund({ orderNo, refundAmount, refundReason }) {
    if (!this.appId || !this.privateKey) {
      throw new BadRequestError('Alipay not configured');
    }

    const params = {
      app_id: this.appId,
      method: 'alipay.trade.refund',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.getTimestamp(),
      version: '1.0',
      biz_content: JSON.stringify({
        out_trade_no: orderNo,
        refund_amount: refundAmount.toFixed(2),
        refund_reason: refundReason,
      }),
    };

    const sign = this.sign(params);
    params.sign = sign;

    try {
      const response = await axios.post(this.gatewayUrl, null, { params });
      const result = response.data.alipay_trade_refund_response;

      return {
        success: result.code === '10000',
        refundFee: result.refund_fee,
        gmtRefundPay: result.gmt_refund_pay,
      };
    } catch (error) {
      console.error('[Alipay] Refund error:', error);
      throw new BadRequestError('Failed to process refund');
    }
  }

  /**
   * 签名
   * @param {Object} params - 参数对象
   * @returns {string} 签名字符串
   */
  sign(params) {
    const signString = this.getSignContent(params);
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signString, 'utf8');
    return sign.sign(this.formatPrivateKey(this.privateKey), 'base64');
  }

  /**
   * 获取签名内容
   * @param {Object} params - 参数对象
   * @returns {string} 签名字符串
   */
  getSignContent(params) {
    return Object.keys(params)
      .sort()
      .filter(key => params[key] !== '' && params[key] !== null && params[key] !== undefined)
      .map(key => `${key}=${params[key]}`)
      .join('&');
  }

  /**
   * 构建支付 URL
   * @param {Object} params - 参数对象
   * @returns {string} URL
   */
  buildUrl(params) {
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    return `${this.gatewayUrl}?${queryString}`;
  }

  /**
   * 格式化私钥
   * @param {string} privateKey - 私钥
   * @returns {string} 格式化后的私钥
   */
  formatPrivateKey(privateKey) {
    if (privateKey.includes('BEGIN RSA PRIVATE KEY')) {
      return privateKey;
    }
    return `-----BEGIN RSA PRIVATE KEY-----\n${privateKey}\n-----END RSA PRIVATE KEY-----`;
  }

  /**
   * 格式化公钥
   * @param {string} publicKey - 公钥
   * @returns {string} 格式化后的公钥
   */
  formatPublicKey(publicKey) {
    if (publicKey.includes('BEGIN PUBLIC KEY')) {
      return publicKey;
    }
    return `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
  }

  /**
   * 获取当前时间戳字符串
   * @returns {string} 时间戳
   */
  getTimestamp() {
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }
}

/**
 * 微信支付服务
 * 使用微信 Native 支付（扫码支付）
 */
class WechatPayProvider extends BasePaymentProvider {
  constructor() {
    super();
    this.appId = config.payment.wechat.appId;
    this.mchId = config.payment.wechat.mchId;
    this.apiKey = config.payment.wechat.apiKey;
    this.unifiedOrderUrl = 'https://api.mch.weixin.qq.com/pay/unifiedorder';
    this.orderQueryUrl = 'https://api.mch.weixin.qq.com/pay/orderquery';
    this.refundUrl = 'https://api.mch.weixin.qq.com/secapi/pay/refund';
    this.notifyUrl = `${config.payment.callbackUrl}/api/payments/wechat/notify`;
  }

  /**
   * 创建支付订单
   * @param {Object} params
   * @param {string} params.orderNo - 订单号
   * @param {number} params.amount - 金额（元）
   * @param {string} params.subject - 商品标题
   * @param {string} params.description - 商品描述
   * @returns {Promise<Object>} 支付二维码链接
   */
  async createPayment({ orderNo, amount, subject, description }) {
    if (!this.appId || !this.mchId || !this.apiKey) {
      throw new BadRequestError('WeChat Pay not configured');
    }

    // 构建请求参数
    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      nonce_str: this.generateNonceStr(),
      body: subject,
      detail: description,
      out_trade_no: orderNo,
      total_fee: Math.round(amount * 100), // 金额单位为分
      spbill_create_ip: '127.0.0.1', // 应使用真实 IP
      notify_url: this.notifyUrl,
      trade_type: 'NATIVE', // Native 扫码支付
    };

    // 签名
    params.sign = this.sign(params);

    // 构建 XML
    const xml = this.buildXml(params);

    try {
      const response = await axios.post(this.unifiedOrderUrl, xml, {
        headers: { 'Content-Type': 'application/xml' },
      });

      const result = this.parseXml(response.data);

      if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') {
        throw new BadRequestError(
          `WeChat Pay error: ${result.return_msg || result.err_code_des}`
        );
      }

      return {
        method: PaymentMethod.WECHAT,
        qrCodeUrl: result.code_url, // 二维码链接
        orderNo,
      };
    } catch (error) {
      console.error('[WeChat Pay] Create payment error:', error);
      throw new BadRequestError('Failed to create WeChat payment');
    }
  }

  /**
   * 验证支付回调签名
   * @param {Object} params - 微信回调参数
   * @returns {boolean} 是否验证通过
   */
  verifyCallback(params) {
    if (!this.apiKey) {
      console.warn('[WeChat Pay] API key not configured, skipping verification');
      return false;
    }

    const { sign, ...paramsWithoutSign } = params;

    if (!sign) {
      return false;
    }

    const calculatedSign = this.sign(paramsWithoutSign);
    return sign === calculatedSign;
  }

  /**
   * 查询支付状态
   * @param {string} orderNo - 商户订单号
   * @returns {Promise<Object>} 支付状态
   */
  async queryPayment(orderNo) {
    if (!this.appId || !this.mchId || !this.apiKey) {
      throw new BadRequestError('WeChat Pay not configured');
    }

    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      out_trade_no: orderNo,
      nonce_str: this.generateNonceStr(),
    };

    params.sign = this.sign(params);

    const xml = this.buildXml(params);

    try {
      const response = await axios.post(this.orderQueryUrl, xml, {
        headers: { 'Content-Type': 'application/xml' },
      });

      const result = this.parseXml(response.data);

      return {
        success: result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS',
        tradeNo: result.transaction_id,
        orderNo: result.out_trade_no,
        tradeState: result.trade_state,
        totalFee: parseInt(result.total_fee) / 100, // 分转元
      };
    } catch (error) {
      console.error('[WeChat Pay] Query error:', error);
      throw new BadRequestError('Failed to query payment status');
    }
  }

  /**
   * 退款
   * @param {Object} params
   * @param {string} params.orderNo - 商户订单号
   * @param {number} params.refundAmount - 退款金额
   * @param {number} params.totalAmount - 订单总金额
   * @returns {Promise<Object>} 退款结果
   */
  async refund({ orderNo, refundAmount, totalAmount }) {
    if (!this.appId || !this.mchId || !this.apiKey) {
      throw new BadRequestError('WeChat Pay not configured');
    }

    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      nonce_str: this.generateNonceStr(),
      out_trade_no: orderNo,
      out_refund_no: `REFUND_${orderNo}_${Date.now()}`,
      total_fee: Math.round(totalAmount * 100),
      refund_fee: Math.round(refundAmount * 100),
    };

    params.sign = this.sign(params);

    const xml = this.buildXml(params);

    try {
      const response = await axios.post(this.refundUrl, xml, {
        headers: { 'Content-Type': 'application/xml' },
      });

      const result = this.parseXml(response.data);

      return {
        success: result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS',
        refundId: result.refund_id,
        refundFee: parseInt(result.refund_fee) / 100,
      };
    } catch (error) {
      console.error('[WeChat Pay] Refund error:', error);
      throw new BadRequestError('Failed to process refund');
    }
  }

  /**
   * 签名
   * @param {Object} params - 参数对象
   * @returns {string} 签名字符串
   */
  sign(params) {
    // 过滤空值并按字典序排序
    const signString = Object.keys(params)
      .filter(key => params[key] !== '' && params[key] !== null && params[key] !== undefined)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    // 拼接密钥
    const stringSignTemp = `${signString}&key=${this.apiKey}`;

    // MD5 加密并转大写
    return crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex').toUpperCase();
  }

  /**
   * 生成随机字符串
   * @returns {string} 随机字符串
   */
  generateNonceStr() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 构建 XML
   * @param {Object} params - 参数对象
   * @returns {string} XML 字符串
   */
  buildXml(params) {
    const xml = Object.keys(params)
      .map(key => `<${key}>${params[key]}</${key}>`)
      .join('');
    return `<xml>${xml}</xml>`;
  }

  /**
   * 解析 XML
   * @param {string} xml - XML 字符串
   * @returns {Object} 参数对象
   */
  parseXml(xml) {
    const result = {};
    const regex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>|<(\w+)>(.*?)<\/\3>/g;
    let match;

    while ((match = regex.exec(xml)) !== null) {
      const key = match[1] || match[3];
      const value = match[2] || match[4];
      result[key] = value;
    }

    return result;
  }
}

/**
 * 支付服务类
 */
class PaymentService {
  constructor() {
    this.providers = {
      [PaymentMethod.ALIPAY]: new AlipayProvider(),
      [PaymentMethod.WECHAT]: new WechatPayProvider(),
    };
  }

  /**
   * 创建支付订单
   * @param {string} method - 支付方式 ('alipay' | 'wechat')
   * @param {Object} params - 支付参数
   * @returns {Promise<Object>} 支付信息
   */
  async createPayment(method, params) {
    const provider = this.getProvider(method);
    return await provider.createPayment(params);
  }

  /**
   * 验证支付回调
   * @param {string} method - 支付方式
   * @param {Object} params - 回调参数
   * @returns {boolean} 是否验证通过
   */
  verifyCallback(method, params) {
    const provider = this.getProvider(method);
    return provider.verifyCallback(params);
  }

  /**
   * 查询支付状态
   * @param {string} method - 支付方式
   * @param {string} orderNo - 订单号
   * @returns {Promise<Object>} 支付状态
   */
  async queryPayment(method, orderNo) {
    const provider = this.getProvider(method);
    return await provider.queryPayment(orderNo);
  }

  /**
   * 退款
   * @param {string} method - 支付方式
   * @param {Object} params - 退款参数
   * @returns {Promise<Object>} 退款结果
   */
  async refund(method, params) {
    const provider = this.getProvider(method);
    return await provider.refund(params);
  }

  /**
   * 获取支付提供商
   * @param {string} method - 支付方式
   * @returns {BasePaymentProvider} 支付提供商实例
   */
  getProvider(method) {
    const provider = this.providers[method];

    if (!provider) {
      throw new BadRequestError(`Unsupported payment method: ${method}`);
    }

    return provider;
  }

  /**
   * 检查支付方式是否可用
   * @param {string} method - 支付方式
   * @returns {boolean} 是否可用
   */
  isMethodAvailable(method) {
    return method in this.providers;
  }

  /**
   * 获取所有可用的支付方式
   * @returns {Array<string>} 支付方式列表
   */
  getAvailableMethods() {
    return Object.keys(this.providers);
  }
}

export default new PaymentService();
