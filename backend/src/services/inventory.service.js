/**
 * 库存管理服务
 * 监控产品库存并在低于阈值时发送预警
 */

import prisma from '../config/database.js';
import redis from '../config/redis.js';
import emailService from './email.service.js';
import notificationService from './notification.service.js';
import config from '../config/env.js';

/**
 * 库存预警配置
 */
const ALERT_CONFIG = {
  // 默认预警阈值
  DEFAULT_THRESHOLD: 10,

  // 预警冷却时间（秒）- 防止重复发送
  ALERT_COOLDOWN: 3600 * 24, // 24小时

  // 检查间隔（秒）
  CHECK_INTERVAL: 3600, // 1小时
};

/**
 * 库存服务类
 */
class InventoryService {
  constructor() {
    this.alertThreshold = config.inventory?.alertThreshold || ALERT_CONFIG.DEFAULT_THRESHOLD;
    this.adminEmail = config.inventory?.adminEmail;
    this.isMonitoring = false;
    this.monitorInterval = null;
  }

  /**
   * 检查单个产品库存
   * @param {number} productId - 产品 ID
   * @returns {Promise<Object>} 库存信息
   */
  async checkProductStock(productId) {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: {
        _count: {
          select: {
            licenseKeys: {
              where: { status: 'available' },
            },
          },
        },
      },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const stockCount = product._count.licenseKeys;
    const isLowStock = stockCount <= this.alertThreshold;

    return {
      productId: product.id,
      productName: product.name,
      stockCount,
      threshold: this.alertThreshold,
      isLowStock,
      status: product.status,
    };
  }

  /**
   * 检查所有产品库存
   * @returns {Promise<Array>} 所有产品的库存信息
   */
  async checkAllStock() {
    const products = await prisma.product.findMany({
      where: {
        status: 'active', // 只检查上架产品
      },
      include: {
        _count: {
          select: {
            licenseKeys: {
              where: { status: 'available' },
            },
          },
        },
      },
    });

    return products.map(product => ({
      productId: product.id,
      productName: product.name,
      stockCount: product._count.licenseKeys,
      threshold: this.alertThreshold,
      isLowStock: product._count.licenseKeys <= this.alertThreshold,
      status: product.status,
    }));
  }

  /**
   * 获取低库存产品列表
   * @returns {Promise<Array>} 低库存产品列表
   */
  async getLowStockProducts() {
    const allStock = await this.checkAllStock();
    return allStock.filter(item => item.isLowStock);
  }

  /**
   * 检查是否已发送过预警（使用 Redis 缓存）
   * @private
   * @param {number} productId - 产品 ID
   * @returns {Promise<boolean>} 是否已发送
   */
  async _hasRecentAlert(productId) {
    const key = `inventory:alert:${productId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  }

  /**
   * 标记已发送预警（设置冷却时间）
   * @private
   * @param {number} productId - 产品 ID
   */
  async _markAlertSent(productId) {
    const key = `inventory:alert:${productId}`;
    await redis.setex(key, ALERT_CONFIG.ALERT_COOLDOWN, '1');
  }

  /**
   * 发送库存预警
   * @param {Object} product - 产品信息
   * @param {number} stockCount - 当前库存
   * @returns {Promise<Object>} 发送结果
   */
  async sendStockAlert(product, stockCount) {
    const results = {
      email: null,
      wechat: null,
    };

    // 1. 发送邮件通知
    if (this.adminEmail && emailService.initialized) {
      try {
        results.email = await emailService.sendLowStockAlert(
          this.adminEmail,
          product,
          stockCount,
          'zh'
        );
        console.log(`[Inventory] Email alert sent for product ${product.id}`);
      } catch (error) {
        console.error('[Inventory] Failed to send email alert:', error);
        results.email = { success: false, error: error.message };
      }
    }

    // 2. 发送微信通知
    if (notificationService.isConfigured()) {
      try {
        results.wechat = await notificationService.sendLowStockAlert(
          product,
          stockCount,
          this.alertThreshold
        );
        console.log(`[Inventory] WeChat alert sent for product ${product.id}`);
      } catch (error) {
        console.error('[Inventory] Failed to send WeChat alert:', error);
        results.wechat = { success: false, error: error.message };
      }
    }

    // 判断是否至少有一个渠道成功
    const success =
      (results.email && results.email.success) ||
      (results.wechat && results.wechat.success);

    return {
      success,
      results,
    };
  }

  /**
   * 检查并发送库存预警（带冷却控制）
   * @returns {Promise<Object>} 检查结果
   */
  async checkAndAlert() {
    console.log('[Inventory] Starting stock check...');

    const lowStockProducts = await this.getLowStockProducts();

    if (lowStockProducts.length === 0) {
      console.log('[Inventory] All products have sufficient stock');
      return {
        checkedAt: new Date(),
        totalProducts: await prisma.product.count({ where: { status: 'active' } }),
        lowStockCount: 0,
        alertsSent: 0,
      };
    }

    console.log(`[Inventory] Found ${lowStockProducts.length} low stock products`);

    let alertsSent = 0;

    for (const item of lowStockProducts) {
      // 检查冷却时间
      const hasRecentAlert = await this._hasRecentAlert(item.productId);

      if (hasRecentAlert) {
        console.log(
          `[Inventory] Skipping alert for product ${item.productId} (cooldown period)`
        );
        continue;
      }

      // 获取完整产品信息
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      // 发送预警
      const result = await this.sendStockAlert(product, item.stockCount);

      if (result.success) {
        // 标记已发送（设置冷却）
        await this._markAlertSent(item.productId);
        alertsSent++;

        console.log(`[Inventory] Alert sent for product ${item.productId}: ${item.productName}`);
      } else {
        console.error(
          `[Inventory] Failed to send alert for product ${item.productId}`,
          result
        );
      }
    }

    return {
      checkedAt: new Date(),
      totalProducts: await prisma.product.count({ where: { status: 'active' } }),
      lowStockCount: lowStockProducts.length,
      alertsSent,
      lowStockProducts: lowStockProducts.map(item => ({
        id: item.productId,
        name: item.productName,
        stock: item.stockCount,
      })),
    };
  }

  /**
   * 启动库存监控（定时任务）
   * @param {number} interval - 检查间隔（秒），默认 1 小时
   */
  startMonitoring(interval = ALERT_CONFIG.CHECK_INTERVAL) {
    if (this.isMonitoring) {
      console.warn('[Inventory] Monitoring already started');
      return;
    }

    console.log(`[Inventory] Starting monitoring (interval: ${interval}s)`);

    // 立即执行一次检查
    this.checkAndAlert().catch(error => {
      console.error('[Inventory] Initial check failed:', error);
    });

    // 设置定时任务
    this.monitorInterval = setInterval(() => {
      this.checkAndAlert().catch(error => {
        console.error('[Inventory] Scheduled check failed:', error);
      });
    }, interval * 1000);

    this.isMonitoring = true;

    console.log('[Inventory] Monitoring started successfully');
  }

  /**
   * 停止库存监控
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.warn('[Inventory] Monitoring not started');
      return;
    }

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    this.isMonitoring = false;

    console.log('[Inventory] Monitoring stopped');
  }

  /**
   * 获取库存监控状态
   * @returns {Object} 监控状态
   */
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      alertThreshold: this.alertThreshold,
      checkInterval: ALERT_CONFIG.CHECK_INTERVAL,
      cooldownPeriod: ALERT_CONFIG.ALERT_COOLDOWN,
      adminEmail: this.adminEmail || 'Not configured',
      wechatConfigured: notificationService.isConfigured(),
      enabledChannels: [
        ...(this.adminEmail ? ['Email'] : []),
        ...notificationService.getEnabledChannels(),
      ],
    };
  }

  /**
   * 手动触发库存检查（管理后台使用）
   * @returns {Promise<Object>} 检查结果
   */
  async manualCheck() {
    console.log('[Inventory] Manual check triggered');
    return await this.checkAndAlert();
  }

  /**
   * 重置产品的预警冷却（管理后台使用）
   * @param {number} productId - 产品 ID
   */
  async resetAlertCooldown(productId) {
    const key = `inventory:alert:${productId}`;
    await redis.del(key);
    console.log(`[Inventory] Alert cooldown reset for product ${productId}`);
  }

  /**
   * 获取库存报告
   * @returns {Promise<Object>} 库存报告
   */
  async getStockReport() {
    const allStock = await this.checkAllStock();

    const report = {
      generatedAt: new Date(),
      totalProducts: allStock.length,
      lowStockProducts: allStock.filter(item => item.isLowStock).length,
      outOfStockProducts: allStock.filter(item => item.stockCount === 0).length,
      healthyStockProducts: allStock.filter(item => !item.isLowStock).length,
      products: allStock.map(item => ({
        id: item.productId,
        name: item.productName,
        stock: item.stockCount,
        threshold: item.threshold,
        status: item.isLowStock
          ? item.stockCount === 0
            ? 'OUT_OF_STOCK'
            : 'LOW_STOCK'
          : 'HEALTHY',
      })),
      alertThreshold: this.alertThreshold,
    };

    return report;
  }
}

export default new InventoryService();
