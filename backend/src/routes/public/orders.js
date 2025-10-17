/**
 * 订单公开 API 路由
 * 处理订单创建和查询
 */

import orderService, { OrderStatus } from '../../services/order.service.js';
import emailService from '../../services/email.service.js';
import { getClientIP } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { BadRequestError } from '../../middleware/errorHandler.js';
import redis from '../../config/redis.js';
import { decrypt } from '../../utils/encryption.js';
import prisma from '../../config/database.js';

/**
 * 注册订单路由
 * @param {FastifyInstance} fastify - Fastify 实例
 */
export default async function orderRoutes(fastify) {
  /**
   * POST /api/orders
   * 创建新订单
   */
  fastify.post('/', asyncHandler(async (request, reply) => {
    const { productId, email, paymentMethod, lang = 'zh' } = request.body;

    // 验证必填字段
    if (!productId || !email || !paymentMethod) {
      throw new BadRequestError('Missing required fields: productId, email, paymentMethod');
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestError('Invalid email format');
    }

    // 获取客户端 IP
    const clientIP = getClientIP(request);

    // 创建订单
    const result = await orderService.createOrder({
      productId: parseInt(productId),
      email,
      paymentMethod,
      ip: clientIP,
      lang,
    });

    fastify.log.info(`[Order] Created order ${result.order.orderNo} for ${email}`);

    return {
      success: true,
      data: result,
    };
  }));

  /**
   * GET /api/orders/:orderNo
   * 查询订单详情（需要验证码验证）
   *
   * 注意：此接口返回订单详情，包括解密后的密钥（如果订单已完成）
   * 因此需要验证码验证以确保安全
   */
  fastify.get('/:orderNo', asyncHandler(async (request, reply) => {
    const { orderNo } = request.params;
    const { code, email } = request.query;

    // 验证必填参数
    if (!code || !email) {
      throw new BadRequestError('Verification code and email are required');
    }

    // 验证验证码
    const isValid = await redis.verifyCode(email, code);

    if (!isValid) {
      throw new BadRequestError('Invalid or expired verification code');
    }

    // 查询订单
    const order = await orderService.getOrderByOrderNo(orderNo);

    // 验证邮箱匹配
    if (order.email !== email) {
      throw new BadRequestError('Email does not match order');
    }

    // 如果订单已完成，解密并返回密钥
    if (order.status === OrderStatus.COMPLETED) {
      // 查询订单的密钥
      const licenseKeys = await prisma.licenseKey.findMany({
        where: {
          orderId: order.id,
          status: 'sold',
        },
      });

      // 解密密钥
      order.licenseKeys = licenseKeys.map(key => ({
        id: key.id,
        productId: key.productId,
        key: decrypt(key.keyValueEncrypted), // 解密密钥
        soldAt: key.soldAt,
      }));
    }

    return {
      success: true,
      data: order,
    };
  }));

  /**
   * POST /api/orders/send-code
   * 发送验证码到邮箱
   */
  fastify.post('/send-code', asyncHandler(async (request, reply) => {
    const { email, orderNo } = request.body;

    if (!email) {
      throw new BadRequestError('Email is required');
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestError('Invalid email format');
    }

    // 如果提供了订单号，验证订单是否存在
    if (orderNo) {
      const order = await orderService.getOrderByOrderNo(orderNo);

      if (order.email !== email) {
        throw new BadRequestError('Email does not match order');
      }
    }

    // 生成并存储验证码
    const code = await redis.generateCode(email);

    // 发送验证码邮件
    try {
      await emailService.sendVerificationCode(email, code, 'zh');
      fastify.log.info(`[Order] Verification code email sent to ${email}`);
    } catch (error) {
      fastify.log.error(`[Order] Failed to send verification code email:`, error);
      // 邮件发送失败不影响验证码生成
    }

    // 开发环境下返回验证码（生产环境应该只发送邮件）
    const isDevelopment = process.env.NODE_ENV === 'development';

    fastify.log.info(`[Order] Verification code sent to ${email}${isDevelopment ? `: ${code}` : ''}`);

    return {
      success: true,
      message: 'Verification code sent to your email',
      // 开发环境下返回验证码
      ...(isDevelopment && { code }),
    };
  }));

  /**
   * POST /api/orders/verify-code
   * 验证验证码（可选接口，用于前端预验证）
   */
  fastify.post('/verify-code', asyncHandler(async (request, reply) => {
    const { email, code } = request.body;

    if (!email || !code) {
      throw new BadRequestError('Email and verification code are required');
    }

    const isValid = await redis.verifyCode(email, code);

    return {
      success: true,
      data: {
        valid: isValid,
      },
    };
  }));

  /**
   * GET /api/orders/email/:email
   * 根据邮箱查询订单列表（需要验证码验证）
   */
  fastify.get('/email/:email', asyncHandler(async (request, reply) => {
    const { email } = request.params;
    const { code, page = 1, pageSize = 10 } = request.query;

    // 验证验证码
    if (!code) {
      throw new BadRequestError('Verification code is required');
    }

    const isValid = await redis.verifyCode(email, code);

    if (!isValid) {
      throw new BadRequestError('Invalid or expired verification code');
    }

    // 查询订单列表
    const result = await orderService.getOrdersByEmail(email, {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });

    return {
      success: true,
      data: result,
    };
  }));

  /**
   * POST /api/orders/:orderNo/cancel
   * 取消待支付订单
   */
  fastify.post('/:orderNo/cancel', asyncHandler(async (request, reply) => {
    const { orderNo } = request.params;
    const { email, code } = request.body;

    // 验证必填参数
    if (!email || !code) {
      throw new BadRequestError('Email and verification code are required');
    }

    // 验证验证码
    const isValid = await redis.verifyCode(email, code);

    if (!isValid) {
      throw new BadRequestError('Invalid or expired verification code');
    }

    // 查询订单验证邮箱
    const order = await orderService.getOrderByOrderNo(orderNo);

    if (order.email !== email) {
      throw new BadRequestError('Email does not match order');
    }

    // 取消订单
    const cancelledOrder = await orderService.cancelOrder(orderNo);

    fastify.log.info(`[Order] Order ${orderNo} cancelled by user`);

    return {
      success: true,
      data: cancelledOrder,
    };
  }));
}
