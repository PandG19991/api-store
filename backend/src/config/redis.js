/**
 * Redis 配置模块
 * 用于缓存和会话管理
 */

import Redis from 'ioredis';

// Redis 连接配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
};

// 如果提供了 REDIS_URL, 使用 URL 连接
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      retryStrategy: redisConfig.retryStrategy,
      maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
    })
  : new Redis(redisConfig);

// 连接事件监听
redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

redis.on('ready', () => {
  console.log('✅ Redis is ready');
});

/**
 * Redis 辅助方法
 */
export const RedisHelper = {
  /**
   * 设置验证码
   * @param {string} email - 邮箱
   * @param {string} code - 验证码
   * @param {number} expiresIn - 过期时间(秒), 默认5分钟
   */
  async setVerificationCode(email, code, expiresIn = 300) {
    const key = `verification:${email}`;
    await redis.setex(key, expiresIn, code);
  },

  /**
   * 获取验证码
   * @param {string} email - 邮箱
   * @returns {Promise<string|null>} 验证码
   */
  async getVerificationCode(email) {
    const key = `verification:${email}`;
    return await redis.get(key);
  },

  /**
   * 删除验证码
   * @param {string} email - 邮箱
   */
  async deleteVerificationCode(email) {
    const key = `verification:${email}`;
    await redis.del(key);
  },

  /**
   * 设置缓存
   * @param {string} key - 键
   * @param {*} value - 值
   * @param {number} expiresIn - 过期时间(秒)
   */
  async set(key, value, expiresIn) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (expiresIn) {
      await redis.setex(key, expiresIn, stringValue);
    } else {
      await redis.set(key, stringValue);
    }
  },

  /**
   * 获取缓存
   * @param {string} key - 键
   * @param {boolean} parse - 是否解析 JSON
   * @returns {Promise<*>} 值
   */
  async get(key, parse = true) {
    const value = await redis.get(key);
    if (!value) return null;

    if (parse) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  },

  /**
   * 删除缓存
   * @param {string} key - 键
   */
  async del(key) {
    await redis.del(key);
  },

  /**
   * 检查键是否存在
   * @param {string} key - 键
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    const result = await redis.exists(key);
    return result === 1;
  },

  /**
   * 设置过期时间
   * @param {string} key - 键
   * @param {number} seconds - 秒数
   */
  async expire(key, seconds) {
    await redis.expire(key, seconds);
  },

  /**
   * 获取剩余时间
   * @param {string} key - 键
   * @returns {Promise<number>} 剩余秒数, -1 表示无过期时间, -2 表示不存在
   */
  async ttl(key) {
    return await redis.ttl(key);
  },
};

export default redis;
