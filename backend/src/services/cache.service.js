/**
 * 缓存服务
 * 为关键数据提供 Redis 缓存支持
 */

import redis from '../config/redis.js';

class CacheService {
  constructor() {
    this.prefix = 'cache:';
    this.defaultTTL = 300; // 5 分钟默认 TTL
  }

  /**
   * 生成缓存键
   * @param {string} key - 缓存键
   * @returns {string} 完整缓存键
   */
  buildKey(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {any} 缓存值
   */
  async get(key) {
    try {
      const data = await redis.get(this.buildKey(key));
      if (!data) return null;

      return JSON.parse(data);
    } catch (error) {
      console.error('缓存读取失败:', error.message);
      return null;
    }
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 过期时间(秒)
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      await redis.setex(
        this.buildKey(key),
        ttl,
        JSON.stringify(value)
      );
    } catch (error) {
      console.error('缓存写入失败:', error.message);
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  async delete(key) {
    try {
      await redis.del(this.buildKey(key));
    } catch (error) {
      console.error('缓存删除失败:', error.message);
    }
  }

  /**
   * 清空所有缓存
   * @param {string} pattern - 缓存键模式
   */
  async clear(pattern = '*') {
    try {
      const keys = await redis.keys(this.buildKey(pattern));
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('缓存清空失败:', error.message);
    }
  }

  /**
   * 获取或设置缓存 (缓存穿透防护)
   * @param {string} key - 缓存键
   * @param {Function} fn - 获取数据的函数
   * @param {number} ttl - 过期时间
   * @returns {any} 缓存值或函数返回值
   */
  async getOrSet(key, fn, ttl = this.defaultTTL) {
    try {
      // 先尝试从缓存获取
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // 缓存不存在,调用函数获取数据
      const data = await fn();

      // 将数据存入缓存
      if (data !== null && data !== undefined) {
        await this.set(key, data, ttl);
      }

      return data;
    } catch (error) {
      console.error('getOrSet 操作失败:', error.message);
      // 失败时直接调用原函数
      return fn();
    }
  }

  // ===== 特定缓存键前缀 =====

  /**
   * 获取产品列表缓存键
   */
  getProductsKey(page = 1, limit = 20) {
    return `products:page:${page}:limit:${limit}`;
  }

  /**
   * 获取产品详情缓存键
   */
  getProductKey(productId) {
    return `product:${productId}`;
  }

  /**
   * 获取仪表盘缓存键
   */
  getDashboardKey() {
    return 'dashboard:overview';
  }

  /**
   * 获取用户权限缓存键
   */
  getUserPermissionKey(userId) {
    return `user:permission:${userId}`;
  }

  /**
   * 获取订单统计缓存键
   */
  getOrderStatsKey() {
    return 'order:stats';
  }

  /**
   * 获取密钥统计缓存键
   */
  getLicenseStatsKey() {
    return 'license:stats';
  }
}

export default new CacheService();
