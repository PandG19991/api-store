/**
 * 管理后台订单管理路由
 * 提供订单的查看、搜索、状态更新等功能
 */

import prisma from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';

/**
 * 注册订单管理路由
 * @param {Object} fastify - Fastify 实例
 * @param {Object} options - 路由选项
 */
export default async function adminOrderRoutes(fastify, options) {
  /**
   * 获取订单列表（分页、搜索、筛选）
   * GET /api/admin/orders
   */
  fastify.get('/', {
    preHandler: [authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' }, // 搜索订单号或邮箱
          status: { type: 'string', enum: ['pending', 'paid', 'completed', 'failed', 'refunded'] },
          paymentMethod: { type: 'string', enum: ['alipay', 'wechat'] },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          sortBy: { type: 'string', enum: ['createdAt', 'totalAmount', 'paidAt', 'completedAt'], default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status,
        paymentMethod,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = request.query;
      const skip = (page - 1) * limit;

      // 构建查询条件
      const where = {};

      // 搜索订单号或邮箱
      if (search) {
        where.OR = [
          { orderNo: { contains: search, mode: 'insensitive' } },
          { customerEmail: { contains: search, mode: 'insensitive' } },
        ];
      }

      // 筛选订单状态
      if (status) {
        where.status = status;
      }

      // 筛选支付方式
      if (paymentMethod) {
        where.paymentMethod = paymentMethod;
      }

      // 筛选日期范围
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      // 并行查询订单列表和总数
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [sortBy]: sortOrder,
          },
          include: {
            orderItems: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
            licenseKeys: {
              select: {
                id: true,
                keyValueEncrypted: true,
                status: true,
              },
            },
          },
        }),
        prisma.order.count({ where }),
      ]);

      return {
        success: true,
        data: {
          orders,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch orders',
      });
    }
  });

  /**
   * 获取单个订单详情
   * GET /api/admin/orders/:id
   */
  fastify.get('/:id', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          orderItems: {
            include: {
              product: true,
              price: true,
            },
          },
          licenseKeys: {
            select: {
              id: true,
              keyValueEncrypted: true,
              status: true,
              soldAt: true,
            },
          },
        },
      });

      if (!order) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      return {
        success: true,
        data: { order },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch order',
      });
    }
  });

  /**
   * 按订单号获取订单
   * GET /api/admin/orders/by-number/:orderNumber
   */
  fastify.get('/by-number/:orderNumber', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['orderNumber'],
        properties: {
          orderNumber: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { orderNumber } = request.params;

      const order = await prisma.order.findUnique({
        where: { orderNo: orderNumber },
        include: {
          orderItems: {
            include: {
              product: true,
              price: true,
            },
          },
          licenseKeys: {
            select: {
              id: true,
              keyValueEncrypted: true,
              status: true,
              soldAt: true,
            },
          },
        },
      });

      if (!order) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      return {
        success: true,
        data: { order },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch order',
      });
    }
  });

  /**
   * 更新订单状态
   * PATCH /api/admin/orders/:id/status
   */
  fastify.patch('/:id/status', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer' },
        },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'paid', 'completed', 'failed', 'refunded'],
          },
          notes: { type: 'string', maxLength: 1000 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { status, notes } = request.body;

      // 检查订单是否存在
      const order = await prisma.order.findUnique({
        where: { id },
      });

      if (!order) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // 更新订单状态
      const updateData = { status };

      // 根据状态设置时间戳
      if (status === 'paid' && !order.paidAt) {
        updateData.paidAt = new Date();
      }

      if (status === 'completed' && !order.completedAt) {
        updateData.completedAt = new Date();
      }

      const updated = await prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Order status updated successfully',
        data: { order: updated },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to update order status',
      });
    }
  });

  /**
   * 高级搜索订单
   * POST /api/admin/orders/search
   */
  fastify.post('/search', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          orderNumber: { type: 'string' },
          email: { type: 'string' },
          status: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['pending', 'paid', 'completed', 'failed', 'refunded'],
            },
          },
          paymentMethod: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['alipay', 'wechat'],
            },
          },
          productId: { type: 'integer' },
          minAmount: { type: 'number', minimum: 0 },
          maxAmount: { type: 'number', minimum: 0 },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          currency: { type: 'string', minLength: 3, maxLength: 3 },
          countryCode: { type: 'string', minLength: 2, maxLength: 2 },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const {
        orderNumber,
        email,
        status,
        paymentMethod,
        productId,
        minAmount,
        maxAmount,
        startDate,
        endDate,
        currency,
        countryCode,
        page = 1,
        limit = 20,
      } = request.body;

      const skip = (page - 1) * limit;

      // 构建复杂查询条件
      const where = {};

      if (orderNumber) {
        where.orderNo = { contains: orderNumber, mode: 'insensitive' };
      }

      if (email) {
        where.customerEmail = { contains: email, mode: 'insensitive' };
      }

      if (status && status.length > 0) {
        where.status = { in: status };
      }

      if (paymentMethod && paymentMethod.length > 0) {
        where.paymentMethod = { in: paymentMethod };
      }

      if (productId) {
        where.orderItems = {
          some: {
            productId,
          },
        };
      }

      if (minAmount !== undefined || maxAmount !== undefined) {
        where.totalAmount = {};
        if (minAmount !== undefined) {
          where.totalAmount.gte = minAmount;
        }
        if (maxAmount !== undefined) {
          where.totalAmount.lte = maxAmount;
        }
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      if (currency) {
        where.currency = currency;
      }

      if (countryCode) {
        where.countryCode = countryCode;
      }

      // 执行搜索
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            orderItems: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        }),
        prisma.order.count({ where }),
      ]);

      return {
        success: true,
        data: {
          orders,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to search orders',
      });
    }
  });

  /**
   * 获取订单统计摘要
   * GET /api/admin/orders/stats/summary
   */
  fastify.get('/stats/summary', {
    preHandler: [authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { startDate, endDate } = request.query;

      // 构建日期筛选
      const where = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      // 并行获取各项统计
      const [
        totalOrders,
        totalRevenue,
        statusStats,
        paymentMethodStats,
      ] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.aggregate({
          where: {
            ...where,
            status: { in: ['paid', 'completed'] },
          },
          _sum: {
            totalAmount: true,
          },
        }),
        prisma.order.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
        prisma.order.groupBy({
          by: ['paymentMethod'],
          where: {
            ...where,
            paymentMethod: { not: null },
          },
          _count: true,
        }),
      ]);

      // 重组状态统计
      const statusCounts = {
        pending: 0,
        paid: 0,
        completed: 0,
        failed: 0,
        refunded: 0,
      };

      statusStats.forEach((stat) => {
        statusCounts[stat.status] = stat._count;
      });

      // 重组支付方式统计
      const paymentCounts = {};
      paymentMethodStats.forEach((stat) => {
        paymentCounts[stat.paymentMethod] = stat._count;
      });

      return {
        success: true,
        data: {
          totalOrders,
          totalRevenue: totalRevenue._sum.totalAmount || 0,
          statusCounts,
          paymentCounts,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch order statistics',
      });
    }
  });
}
