/**
 * 订单服务
 * 处理订单创建、支付回调、密钥分配等核心业务逻辑
 */

import prisma from '../config/database.js';
import productService from './product.service.js';
import paymentService, { PaymentMethod, PaymentStatus } from './payment.service.js';
import emailService from './email.service.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { generateOrderNo } from '../utils/helpers.js';
import { NotFoundError, BadRequestError, AppError } from '../middleware/errorHandler.js';

/**
 * 订单状态枚举
 */
export const OrderStatus = {
  PENDING: 'pending',       // 待支付
  PAID: 'paid',             // 已支付
  COMPLETED: 'completed',   // 已完成（已发货）
  CANCELLED: 'cancelled',   // 已取消
  REFUNDED: 'refunded',     // 已退款
};

/**
 * 订单服务类
 */
class OrderService {
  /**
   * 创建订单
   * @param {Object} params - 订单参数
   * @param {number} params.productId - 产品 ID
   * @param {string} params.email - 买家邮箱
   * @param {string} params.paymentMethod - 支付方式
   * @param {string} params.ip - 客户端 IP
   * @param {string} params.lang - 语言
   * @returns {Promise<Object>} 订单信息和支付链接
   */
  async createOrder({ productId, email, paymentMethod, ip, lang = 'zh' }) {
    // 1. 验证产品和库存
    const product = await productService.getProductById(productId);

    if (product.status !== 'active') {
      throw new BadRequestError('Product is not available');
    }

    const hasStock = await productService.hasStock(productId);
    if (!hasStock) {
      throw new BadRequestError('Product is out of stock');
    }

    // 2. 获取价格
    const price = await productService.getProductPriceByIP(productId, ip);

    // 3. 验证支付方式
    if (!paymentService.isMethodAvailable(paymentMethod)) {
      throw new BadRequestError(`Payment method ${paymentMethod} is not available`);
    }

    // 4. 生成订单号
    const orderNo = generateOrderNo();

    // 5. 创建订单（使用事务确保原子性）
    const order = await prisma.$transaction(async (tx) => {
      // 创建订单
      const newOrder = await tx.order.create({
        data: {
          orderNo,
          email,
          totalAmount: price.amount,
          currency: price.currency,
          countryCode: price.countryCode,
          status: OrderStatus.PENDING,
          paymentMethod,
          customerIp: ip,
          orderItems: {
            create: {
              productId,
              productName: product.name,
              quantity: 1,
              unitPrice: price.amount,
              subtotal: price.amount,
            },
          },
        },
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      return newOrder;
    });

    // 6. 创建支付订单
    const localizedProduct = productService.getLocalizedProduct(product, lang);
    const payment = await paymentService.createPayment(paymentMethod, {
      orderNo: order.orderNo,
      amount: parseFloat(order.totalAmount),
      subject: localizedProduct.name,
      description: localizedProduct.description || localizedProduct.name,
    });

    // 7. 返回订单和支付信息
    return {
      order: {
        id: order.id,
        orderNo: order.orderNo,
        email: order.email,
        totalAmount: parseFloat(order.totalAmount),
        currency: order.currency,
        status: order.status,
        createdAt: order.createdAt,
        items: order.orderItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unitPrice),
        })),
      },
      payment: {
        method: payment.method,
        // 支付宝返回支付 URL，微信返回二维码链接
        ...(payment.paymentUrl && { paymentUrl: payment.paymentUrl }),
        ...(payment.qrCodeUrl && { qrCodeUrl: payment.qrCodeUrl }),
      },
    };
  }

  /**
   * 处理支付回调
   * @param {Object} params - 支付回调参数
   * @param {string} params.orderNo - 订单号
   * @param {string} params.transactionId - 支付平台交易号
   * @param {string} params.paymentMethod - 支付方式
   * @param {string} params.status - 支付状态
   * @param {number} params.amount - 支付金额
   * @returns {Promise<Object>} 处理结果
   */
  async handlePaymentCallback({ orderNo, transactionId, paymentMethod, status, amount }) {
    // 使用事务处理，确保数据一致性
    return await prisma.$transaction(async (tx) => {
      // 1. 查询订单
      const order = await tx.order.findUnique({
        where: { orderNo },
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundError(`Order ${orderNo} not found`);
      }

      // 2. 检查订单状态，避免重复处理
      if (order.status !== OrderStatus.PENDING) {
        console.log(`[Order] Order ${orderNo} already processed, status: ${order.status}`);
        return { success: true, message: 'Order already processed' };
      }

      // 3. 验证金额
      const orderAmount = parseFloat(order.totalAmount);
      if (Math.abs(orderAmount - amount) > 0.01) {
        console.error(`[Order] Amount mismatch for order ${orderNo}. Expected: ${orderAmount}, Got: ${amount}`);
        throw new BadRequestError('Payment amount mismatch');
      }

      // 4. 根据支付状态更新订单
      if (status === 'success') {
        // 支付成功，分配密钥
        await this._completeOrder(tx, order, transactionId);

        console.log(`[Order] Order ${orderNo} completed successfully`);

        return {
          success: true,
          message: 'Order completed',
          orderNo,
        };
      } else {
        // 支付失败或其他状态
        await tx.order.update({
          where: { id: order.id },
          data: {
            transactionId,
            paidAt: new Date(),
            status: OrderStatus.CANCELLED,
          },
        });

        console.log(`[Order] Order ${orderNo} payment failed`);

        return {
          success: false,
          message: 'Payment failed',
          orderNo,
        };
      }
    });
  }

  /**
   * 完成订单（内部方法）
   * @private
   * @param {Object} tx - Prisma 事务对象
   * @param {Object} order - 订单对象
   * @param {string} transactionId - 交易 ID
   */
  async _completeOrder(tx, order, transactionId) {
    // 1. 为每个订单项分配密钥
    for (const item of order.orderItems) {
      const quantity = item.quantity;

      // 查找可用密钥
      const availableKeys = await tx.licenseKey.findMany({
        where: {
          productId: item.productId,
          status: 'available',
        },
        take: quantity,
        orderBy: {
          createdAt: 'asc', // 先进先出
        },
      });

      if (availableKeys.length < quantity) {
        throw new BadRequestError(
          `Insufficient license keys for product ${item.productName}. ` +
          `Required: ${quantity}, Available: ${availableKeys.length}`
        );
      }

      // 分配密钥给订单
      const keyIds = availableKeys.map(key => key.id);
      await tx.licenseKey.updateMany({
        where: {
          id: { in: keyIds },
        },
        data: {
          status: 'sold',
          orderId: order.id,
          soldAt: new Date(),
        },
      });
    }

    // 2. 更新订单状态
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.COMPLETED,
        transactionId,
        paidAt: new Date(),
      },
      include: {
        orderItems: {
          include: {
            licenseKeys: true,
          },
        },
      },
    });

    // 3. 发送订单确认邮件（包含密钥）
    try {
      // 解密密钥
      const licenseKeys = updatedOrder.orderItems.flatMap(item =>
        item.licenseKeys.map(key => ({
          id: key.id,
          productId: key.productId,
          key: decrypt(key.keyValueEncrypted), // 解密密钥
        }))
      );

      // 发送邮件
      await emailService.sendOrderConfirmation(
        order.email,
        this._formatOrder(updatedOrder),
        licenseKeys,
        'zh' // TODO: 从订单中获取语言偏好
      );

      console.log(`[Order] Order confirmation email sent to ${order.email}`);
    } catch (error) {
      // 邮件发送失败不影响订单流程
      console.error('[Order] Failed to send order confirmation email:', error);
    }
  }

  /**
   * 根据订单号查询订单
   * @param {string} orderNo - 订单号
   * @returns {Promise<Object>} 订单详情
   */
  async getOrderByOrderNo(orderNo) {
    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: {
        orderItems: {
          include: {
            product: true,
            licenseKeys: {
              where: {
                status: 'sold',
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    return this._formatOrder(order);
  }

  /**
   * 根据订单 ID 查询订单
   * @param {number} orderId - 订单 ID
   * @returns {Promise<Object>} 订单详情
   */
  async getOrderById(orderId) {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: {
        orderItems: {
          include: {
            product: true,
            licenseKeys: {
              where: {
                status: 'sold',
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    return this._formatOrder(order);
  }

  /**
   * 根据邮箱查询订单列表
   * @param {string} email - 邮箱地址
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 订单列表
   */
  async getOrdersByEmail(email, { page = 1, pageSize = 10 } = {}) {
    const skip = (page - 1) * pageSize;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { email },
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      prisma.order.count({
        where: { email },
      }),
    ]);

    return {
      orders: orders.map(order => this._formatOrder(order, false)), // 不显示密钥
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 查询所有订单（管理后台）
   * @param {Object} filters - 过滤条件
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 订单列表和分页信息
   */
  async getAllOrders(filters = {}, { page = 1, pageSize = 20 } = {}) {
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.email) {
      where.email = { contains: filters.email };
    }

    if (filters.orderNo) {
      where.orderNo = { contains: filters.orderNo };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map(order => this._formatOrder(order, true)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 取消订单
   * @param {string} orderNo - 订单号
   * @returns {Promise<Object>} 更新后的订单
   */
  async cancelOrder(orderNo) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderNo },
      });

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestError(`Cannot cancel order with status: ${order.status}`);
      }

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });

      return this._formatOrder(updatedOrder);
    });
  }

  /**
   * 退款（管理员操作）
   * @param {string} orderNo - 订单号
   * @param {number} refundAmount - 退款金额（可选，默认全额退款）
   * @param {string} refundReason - 退款原因
   * @returns {Promise<Object>} 退款结果
   */
  async refundOrder(orderNo, refundAmount, refundReason = 'Customer request') {
    return await prisma.$transaction(async (tx) => {
      // 1. 查询订单
      const order = await tx.order.findUnique({
        where: { orderNo },
        include: {
          orderItems: {
            include: {
              licenseKeys: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.PAID) {
        throw new BadRequestError(`Cannot refund order with status: ${order.status}`);
      }

      // 2. 调用支付服务退款
      const totalAmount = parseFloat(order.totalAmount);
      const actualRefundAmount = refundAmount || totalAmount;

      if (actualRefundAmount > totalAmount) {
        throw new BadRequestError('Refund amount exceeds order total');
      }

      const refundResult = await paymentService.refund(order.paymentMethod, {
        orderNo: order.orderNo,
        refundAmount: actualRefundAmount,
        totalAmount,
        refundReason,
      });

      if (!refundResult.success) {
        throw new AppError('Refund failed', 500);
      }

      // 3. 释放密钥（标记为可用）
      const licenseKeyIds = order.orderItems.flatMap(item =>
        item.licenseKeys.map(key => key.id)
      );

      if (licenseKeyIds.length > 0) {
        await tx.licenseKey.updateMany({
          where: {
            id: { in: licenseKeyIds },
          },
          data: {
            status: 'available',
            orderId: null,
            soldAt: null,
          },
        });
      }

      // 4. 更新订单状态
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.REFUNDED,
        },
      });

      return {
        success: true,
        order: this._formatOrder(updatedOrder),
        refundAmount: actualRefundAmount,
      };
    });
  }

  /**
   * 获取订单统计数据（管理后台）
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} 统计数据
   */
  async getOrderStats(filters = {}) {
    const where = {};

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    const [
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      refundedOrders,
      totalRevenue,
    ] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.count({ where: { ...where, status: OrderStatus.COMPLETED } }),
      prisma.order.count({ where: { ...where, status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { ...where, status: OrderStatus.CANCELLED } }),
      prisma.order.count({ where: { ...where, status: OrderStatus.REFUNDED } }),
      prisma.order.aggregate({
        where: {
          ...where,
          status: { in: [OrderStatus.COMPLETED, OrderStatus.PAID] },
        },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    return {
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      refundedOrders,
      totalRevenue: totalRevenue._sum.totalAmount
        ? parseFloat(totalRevenue._sum.totalAmount)
        : 0,
      completionRate: totalOrders > 0
        ? ((completedOrders / totalOrders) * 100).toFixed(2)
        : 0,
    };
  }

  /**
   * 格式化订单数据
   * @private
   * @param {Object} order - 原始订单对象
   * @param {boolean} includeKeys - 是否包含密钥（仅管理员可见）
   * @returns {Object} 格式化后的订单
   */
  _formatOrder(order, includeKeys = true) {
    const formatted = {
      id: order.id,
      orderNo: order.orderNo,
      email: order.email,
      totalAmount: parseFloat(order.totalAmount),
      currency: order.currency,
      countryCode: order.countryCode,
      status: order.status,
      paymentMethod: order.paymentMethod,
      transactionId: order.transactionId,
      customerIp: order.customerIp,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      items: order.orderItems?.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        subtotal: parseFloat(item.subtotal),
        product: item.product ? {
          name: item.product.name,
          slug: item.product.slug,
          imageUrl: item.product.imageUrl,
        } : null,
      })) || [],
    };

    // 只在订单完成且允许的情况下显示密钥
    if (includeKeys && order.status === OrderStatus.COMPLETED && order.orderItems) {
      formatted.licenseKeys = order.orderItems.flatMap(item =>
        (item.licenseKeys || []).map(key => ({
          id: key.id,
          // 注意：这里不解密密钥，只返回基本信息
          // 实际密钥在查询订单详情时才解密
          productId: key.productId,
          status: key.status,
          soldAt: key.soldAt,
        }))
      );
    }

    return formatted;
  }
}

export default new OrderService();
