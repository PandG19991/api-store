/**
 * 支付公开 API 路由
 * 处理支付创建和回调
 */

import paymentService, { PaymentMethod } from '../../services/payment.service.js';
import orderService from '../../services/order.service.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { BadRequestError } from '../../middleware/errorHandler.js';

/**
 * 注册支付路由
 * @param {FastifyInstance} fastify - Fastify 实例
 */
export default async function paymentRoutes(fastify) {
  /**
   * GET /api/payments/methods
   * 获取可用的支付方式
   */
  fastify.get('/methods', asyncHandler(async (request, reply) => {
    const methods = paymentService.getAvailableMethods();

    return {
      success: true,
      data: {
        methods: methods.map(method => ({
          code: method,
          name: method === PaymentMethod.ALIPAY ? '支付宝' : '微信支付',
          available: paymentService.isMethodAvailable(method),
        })),
      },
    };
  }));

  /**
   * POST /api/payments/alipay/notify
   * 支付宝支付回调通知
   */
  fastify.post('/alipay/notify', asyncHandler(async (request, reply) => {
    const params = request.body;

    fastify.log.info('[Alipay] Received payment notification', {
      out_trade_no: params.out_trade_no,
      trade_status: params.trade_status,
    });

    // 验证签名
    const isValid = paymentService.verifyCallback(PaymentMethod.ALIPAY, params);

    if (!isValid) {
      fastify.log.error('[Alipay] Invalid signature');
      return reply.code(400).send('fail');
    }

    // 验证订单金额等参数
    const {
      out_trade_no: orderNo,
      trade_no: transactionId,
      trade_status: tradeStatus,
      total_amount: totalAmount,
    } = params;

    try {
      // 调用订单服务处理支付结果
      await orderService.handlePaymentCallback({
        orderNo,
        transactionId,
        paymentMethod: PaymentMethod.ALIPAY,
        status: tradeStatus === 'TRADE_SUCCESS' ? 'success' : 'pending',
        amount: parseFloat(totalAmount),
      });

      fastify.log.info('[Alipay] Payment notification processed successfully', {
        orderNo,
        transactionId,
        tradeStatus,
      });

      // 返回 success 给支付宝
      return reply.code(200).send('success');
    } catch (error) {
      fastify.log.error('[Alipay] Failed to process payment notification', error);
      return reply.code(500).send('fail');
    }
  }));

  /**
   * GET /api/payments/alipay/return
   * 支付宝支付同步返回
   */
  fastify.get('/alipay/return', asyncHandler(async (request, reply) => {
    const params = request.query;

    // 验证签名
    const isValid = paymentService.verifyCallback(PaymentMethod.ALIPAY, params);

    if (!isValid) {
      throw new BadRequestError('Invalid signature');
    }

    const { out_trade_no: orderNo, trade_no: transactionId } = params;

    // 重定向到前端订单详情页
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/orders/${orderNo}?success=true`;

    return reply.redirect(302, redirectUrl);
  }));

  /**
   * POST /api/payments/wechat/notify
   * 微信支付回调通知
   */
  fastify.post('/wechat/notify', {
    config: {
      rawBody: true, // 微信要求使用原始 body 进行签名验证
    },
  }, asyncHandler(async (request, reply) => {
    // 微信回调是 XML 格式
    const xmlData = request.body;

    fastify.log.info('[WeChat Pay] Received payment notification');

    // 解析 XML (payment.service 中的 parseXml 方法)
    const provider = paymentService.getProvider(PaymentMethod.WECHAT);
    const params = provider.parseXml(xmlData);

    fastify.log.info('[WeChat Pay] Parsed notification data', {
      out_trade_no: params.out_trade_no,
      result_code: params.result_code,
    });

    // 验证签名
    const isValid = paymentService.verifyCallback(PaymentMethod.WECHAT, params);

    if (!isValid) {
      fastify.log.error('[WeChat Pay] Invalid signature');
      return reply
        .code(200)
        .header('Content-Type', 'application/xml')
        .send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[签名失败]]></return_msg></xml>');
    }

    // 检查支付结果
    if (params.return_code !== 'SUCCESS' || params.result_code !== 'SUCCESS') {
      fastify.log.error('[WeChat Pay] Payment failed', {
        return_code: params.return_code,
        result_code: params.result_code,
      });

      return reply
        .code(200)
        .header('Content-Type', 'application/xml')
        .send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
    }

    try {
      const {
        out_trade_no: orderNo,
        transaction_id: transactionId,
        total_fee,
      } = params;

      // 调用订单服务处理支付结果
      await orderService.handlePaymentCallback({
        orderNo,
        transactionId,
        paymentMethod: PaymentMethod.WECHAT,
        status: 'success',
        amount: parseInt(total_fee) / 100,
      });

      fastify.log.info('[WeChat Pay] Payment notification processed successfully', {
        orderNo,
        transactionId,
      });

      // 返回成功响应
      return reply
        .code(200)
        .header('Content-Type', 'application/xml')
        .send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
    } catch (error) {
      fastify.log.error('[WeChat Pay] Failed to process payment notification', error);

      return reply
        .code(200)
        .header('Content-Type', 'application/xml')
        .send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[处理失败]]></return_msg></xml>');
    }
  }));

  /**
   * POST /api/payments/:method/query
   * 查询支付状态
   */
  fastify.post('/:method/query', asyncHandler(async (request, reply) => {
    const { method } = request.params;
    const { orderNo } = request.body;

    if (!orderNo) {
      throw new BadRequestError('Order number is required');
    }

    if (!paymentService.isMethodAvailable(method)) {
      throw new BadRequestError(`Unsupported payment method: ${method}`);
    }

    const result = await paymentService.queryPayment(method, orderNo);

    return {
      success: true,
      data: result,
    };
  }));

  /**
   * POST /api/payments/:method/refund
   * 退款（需要管理员权限，这里先放在公开路由，后续移到 admin 路由）
   */
  fastify.post('/:method/refund', asyncHandler(async (request, reply) => {
    const { method } = request.params;
    const { orderNo, refundAmount, totalAmount, refundReason } = request.body;

    if (!orderNo || !refundAmount) {
      throw new BadRequestError('Order number and refund amount are required');
    }

    if (!paymentService.isMethodAvailable(method)) {
      throw new BadRequestError(`Unsupported payment method: ${method}`);
    }

    const refundParams = {
      orderNo,
      refundAmount,
      ...(method === PaymentMethod.ALIPAY && { refundReason }),
      ...(method === PaymentMethod.WECHAT && { totalAmount }),
    };

    const result = await paymentService.refund(method, refundParams);

    return {
      success: true,
      data: result,
    };
  }));
}
