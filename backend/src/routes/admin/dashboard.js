/**
 * 管理后台仪表盘路由
 * 提供统计数据和分析接口
 */

import statisticsService from '../../services/statistics.service.js';
import { authenticate } from '../../middleware/auth.js';

/**
 * 注册仪表盘路由
 * @param {Object} fastify - Fastify 实例
 * @param {Object} options - 路由选项
 */
export default async function dashboardRoutes(fastify, options) {
  /**
   * 获取仪表盘概览数据
   * GET /api/admin/dashboard/overview
   */
  fastify.get('/overview', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const data = await statisticsService.getDashboardOverview();

      return {
        success: true,
        data,
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch dashboard overview',
      });
    }
  });

  /**
   * 获取最近订单列表
   * GET /api/admin/dashboard/recent-orders
   */
  fastify.get('/recent-orders', {
    preHandler: [authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { limit = 10 } = request.query;
      const orders = await statisticsService.getRecentOrders(limit);

      return {
        success: true,
        data: {
          orders,
          total: orders.length,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch recent orders',
      });
    }
  });

  /**
   * 获取热销产品排行
   * GET /api/admin/dashboard/top-products
   */
  fastify.get('/top-products', {
    preHandler: [authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { limit = 10 } = request.query;
      const products = await statisticsService.getTopSellingProducts(limit);

      return {
        success: true,
        data: {
          products,
          total: products.length,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch top selling products',
      });
    }
  });

  /**
   * 获取销售趋势数据
   * GET /api/admin/dashboard/sales-trend
   */
  fastify.get('/sales-trend', {
    preHandler: [authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { days = 30 } = request.query;
      const trend = await statisticsService.getSalesTrend(days);

      return {
        success: true,
        data: {
          trend,
          days,
          total: trend.length,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch sales trend',
      });
    }
  });

  /**
   * 获取库存预警列表
   * GET /api/admin/dashboard/low-stock
   */
  fastify.get('/low-stock', {
    preHandler: [authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          threshold: { type: 'integer', minimum: 0, maximum: 1000, default: 10 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { threshold = 10 } = request.query;
      const products = await statisticsService.getLowStockProducts(threshold);

      return {
        success: true,
        data: {
          products,
          threshold,
          total: products.length,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch low stock products',
      });
    }
  });

  /**
   * 获取产品库存统计
   * GET /api/admin/dashboard/inventory
   */
  fastify.get('/inventory', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const inventory = await statisticsService.getProductInventory();

      return {
        success: true,
        data: {
          inventory,
          total: inventory.length,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch inventory',
      });
    }
  });

  /**
   * 获取收入统计（按货币）
   * GET /api/admin/dashboard/revenue-by-currency
   */
  fastify.get('/revenue-by-currency', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const revenues = await statisticsService.getRevenueByCurrency();

      return {
        success: true,
        data: {
          revenues,
          total: revenues.length,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch revenue by currency',
      });
    }
  });

  /**
   * 获取支付方式统计
   * GET /api/admin/dashboard/payment-methods
   */
  fastify.get('/payment-methods', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const stats = await statisticsService.getPaymentMethodStats();

      return {
        success: true,
        data: {
          stats,
          total: stats.length,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch payment method stats',
      });
    }
  });

  /**
   * 获取订单统计
   * GET /api/admin/dashboard/order-stats
   */
  fastify.get('/order-stats', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const stats = await statisticsService.getOrderStatistics();

      return {
        success: true,
        data: stats,
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

  /**
   * 获取产品统计
   * GET /api/admin/dashboard/product-stats
   */
  fastify.get('/product-stats', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const stats = await statisticsService.getProductStatistics();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch product statistics',
      });
    }
  });
}
