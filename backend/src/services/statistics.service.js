/**
 * 统计服务
 * 提供各类数据统计和分析功能
 * 已优化: 关键数据使用 Redis 缓存
 */

import prisma from '../config/database.js';
import cacheService from './cache.service.js';

class StatisticsService {
  /**
   * 获取仪表盘概览数据
   * @returns {Object} 包含总销售额、订单数、产品数等核心指标
   * 优化: 使用 Redis 缓存,TTL 1分钟
   */
  async getDashboardOverview() {
    // 尝试从缓存获取
    const cacheKey = cacheService.getDashboardKey();
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 缓存不存在,并行查询多个统计数据以提高性能
    const [
      totalRevenue,
      orderStats,
      productStats,
      todayRevenue,
      licenseStats,
      recentOrdersList,
      lowStockProducts,
    ] = await Promise.all([
      // 总销售额
      this.getTotalRevenue(),
      // 订单统计
      this.getOrderStatistics(),
      // 产品统计
      this.getProductStatistics(),
      // 今日销售额
      this.getTodayRevenue(),
      // 密钥统计
      this.getLicenseStatistics(),
      // 最近订单列表
      this.getRecentOrders(5),
      // 库存预警
      this.getLowStockProducts(10),
    ]);

    const result = {
      revenue: {
        total: totalRevenue.amount,
        today: todayRevenue.amount,
      },
      orders: {
        total: orderStats.total,
        pending: orderStats.pending,
        paid: orderStats.paid,
        completed: orderStats.completed,
      },
      products: {
        total: productStats.total,
        active: productStats.active,
      },
      licenses: {
        available: licenseStats.available,
        sold: licenseStats.sold,
        used: licenseStats.sold,
      },
      recentOrders: recentOrdersList,
      lowStockProducts,
    };

    // 缓存结果 (TTL: 1分钟)
    await cacheService.set(cacheKey, result, 60);

    return result;
  }

  /**
   * 获取密钥统计
   * @returns {Object} 密钥统计信息
   */
  async getLicenseStatistics() {
    const stats = await prisma.licenseKey.groupBy({
      by: ['status'],
      _count: true,
    });

    const result = {
      available: 0,
      sold: 0,
      revoked: 0,
      total: 0,
    };

    stats.forEach((item) => {
      result[item.status] = item._count;
      result.total += item._count;
    });

    return result;
  }

  /**
   * 获取总销售额
   * @returns {Object} 总销售额和订单数
   */
  async getTotalRevenue() {
    const result = await prisma.order.aggregate({
      where: {
        status: 'completed',
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    });

    return {
      amount: result._sum.totalAmount || 0,
      count: result._count,
    };
  }

  /**
   * 获取今日销售额
   * @returns {Object} 今日销售额和订单数
   */
  async getTodayRevenue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await prisma.order.aggregate({
      where: {
        status: 'completed',
        createdAt: {
          gte: today,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    });

    return {
      amount: result._sum.totalAmount || 0,
      count: result._count,
    };
  }

  /**
   * 获取订单统计
   * @returns {Object} 各状态订单数量
   */
  async getOrderStatistics() {
    const statusCounts = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
    });

    // 转换为更友好的格式
    const stats = {
      total: 0,
      pending: 0,
      paid: 0,
      completed: 0,
      cancelled: 0,
      expired: 0,
    };

    statusCounts.forEach((item) => {
      stats[item.status] = item._count;
      stats.total += item._count;
    });

    return stats;
  }

  /**
   * 获取产品统计
   * @returns {Object} 产品总数、启用数、禁用数
   */
  async getProductStatistics() {
    const [total, active, inactive] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: 'active' } }),
      prisma.product.count({ where: { status: { not: 'active' } } }),
    ]);

    return {
      total,
      active,
      inactive,
    };
  }

  /**
   * 获取最近N天的订单数量
   * @param {number} days - 天数
   * @returns {number} 订单数量
   */
  async getRecentOrdersCount(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const count = await prisma.order.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });

    return count;
  }

  /**
   * 获取最近订单列表
   * @param {number} limit - 返回数量限制
   * @returns {Array} 订单列表
   */
  async getRecentOrders(limit = 10) {
    // 查询最近的订单及其订单项和相关产品信息
    const orders = await prisma.order.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      customerEmail: order.customerEmail,
      totalAmount: order.totalAmount,
      currency: order.currency,
      status: order.status,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      items: order.orderItems.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        price: item.unitPrice,
      })),
    }));
  }

  /**
   * 获取热销产品排行
   * @param {number} limit - 返回数量限制
   * @returns {Array} 产品列表
   */
  async getTopSellingProducts(limit = 10) {
    // 使用原始 SQL 查询以获得更好的性能
    const products = await prisma.$queryRaw`
      SELECT
        p.id,
        p.name,
        p.slug,
        COUNT(oi.id) as order_count,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.price) as total_revenue
      FROM products p
      INNER JOIN order_items oi ON p.id = oi.product_id
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'completed'
      GROUP BY p.id, p.name, p.slug
      ORDER BY total_sold DESC
      LIMIT ${limit}
    `;

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      orderCount: Number(p.order_count),
      totalSold: Number(p.total_sold),
      totalRevenue: parseFloat(p.total_revenue),
    }));
  }

  /**
   * 获取销售趋势数据（按天）
   * @param {number} days - 天数
   * @returns {Array} 每日销售数据
   */
  async getSalesTrend(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 使用原始 SQL 查询以获得按日期分组的数据
    const trends = await prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as order_count,
        SUM(total_amount) as revenue
      FROM orders
      WHERE status = 'completed'
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return trends.map((t) => ({
      date: t.date.toISOString().split('T')[0],
      orderCount: Number(t.order_count),
      revenue: parseFloat(t.revenue),
    }));
  }

  /**
   * 获取库存预警列表
   * @param {number} threshold - 预警阈值
   * @returns {Array} 低库存产品列表
   */
  async getLowStockProducts(threshold = 10) {
    const products = await prisma.product.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            licenseKeys: {
              where: {
                status: 'available',
              },
            },
          },
        },
      },
    });

    // 筛选出库存低于阈值的产品
    const lowStock = products
      .filter((p) => p._count.licenseKeys < threshold)
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        availableStock: p._count.licenseKeys,
      }))
      .sort((a, b) => a.availableStock - b.availableStock);

    return lowStock;
  }

  /**
   * 获取产品库存统计
   * @returns {Array} 所有产品的库存信息
   */
  async getProductInventory() {
    const products = await prisma.product.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            licenseKeys: true,
          },
        },
      },
    });

    // 获取每个产品各状态的密钥数量
    const inventory = await Promise.all(
      products.map(async (product) => {
        const counts = await prisma.licenseKey.groupBy({
          by: ['status'],
          where: {
            productId: product.id,
          },
          _count: true,
        });

        const statusCounts = {
          available: 0,
          sold: 0,
          revoked: 0,
        };

        counts.forEach((item) => {
          statusCounts[item.status] = item._count;
        });

        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          total: product._count.licenseKeys,
          available: statusCounts.available,
          sold: statusCounts.sold,
          revoked: statusCounts.revoked,
        };
      })
    );

    return inventory;
  }

  /**
   * 获取收入统计（按货币）
   * @returns {Array} 各货币的收入统计
   */
  async getRevenueByCurrency() {
    const revenues = await prisma.order.groupBy({
      by: ['currency'],
      where: {
        status: 'completed',
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    });

    return revenues.map((item) => ({
      currency: item.currency,
      amount: item._sum.totalAmount || 0,
      orderCount: item._count,
    }));
  }

  /**
   * 获取支付方式统计
   * @returns {Array} 各支付方式的使用统计
   */
  async getPaymentMethodStats() {
    const stats = await prisma.order.groupBy({
      by: ['paymentMethod'],
      where: {
        status: {
          in: ['paid', 'completed'],
        },
      },
      _count: true,
      _sum: {
        totalAmount: true,
      },
    });

    return stats.map((item) => ({
      method: item.paymentMethod,
      count: item._count,
      totalAmount: item._sum.totalAmount || 0,
    }));
  }
}

export default new StatisticsService();

