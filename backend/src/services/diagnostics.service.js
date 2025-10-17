/**
 * 诊断监控服务
 * 追踪数据库和Redis连接生命周期
 * 检测潜在的连接泄漏问题
 */

import prisma from '../config/database.js';
import redis from '../config/redis.js';
import os from 'os';

class DiagnosticsService {
  constructor() {
    this.metrics = {
      requestCount: 0,
      activeConnections: 0,
      failedRequests: 0,
      successfulRequests: 0,
      totalRequestTime: 0,
      prismaConnectionStats: {},
      redisConnectionStats: {},
      startTime: Date.now(),
      timeouts: 0,
      errors: [],
    };

    this.connectionTracker = new Map();
    this.requestTracker = new Map();
    this.errorLog = [];
  }

  /**
   * 记录请求开始
   */
  recordRequestStart(requestId) {
    const requestInfo = {
      id: requestId,
      startTime: Date.now(),
      startMemory: process.memoryUsage().heapUsed,
    };
    this.requestTracker.set(requestId, requestInfo);
    this.metrics.activeConnections++;
    this.metrics.requestCount++;
  }

  /**
   * 记录请求结束
   */
  recordRequestEnd(requestId, success = true, error = null) {
    const requestInfo = this.requestTracker.get(requestId);

    if (!requestInfo) return;

    const endTime = Date.now();
    const duration = endTime - requestInfo.startTime;
    const endMemory = process.memoryUsage().heapUsed;
    const memoryDelta = endMemory - requestInfo.startMemory;

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      if (error) {
        this.errorLog.push({
          requestId,
          error: error.message || String(error),
          timestamp: new Date().toISOString(),
          duration,
          memoryDelta,
        });
        // 只保留最近100个错误
        if (this.errorLog.length > 100) {
          this.errorLog.shift();
        }
      }
    }

    this.metrics.totalRequestTime += duration;
    this.metrics.activeConnections--;
    this.requestTracker.delete(requestId);
  }

  /**
   * 获取Prisma连接池状态
   */
  async getPrismaConnectionStats() {
    try {
      // 获取内部连接池信息
      const poolMetrics = prisma.$metrics?.connectionPoolMetrics || {};

      return {
        status: 'connected',
        poolSize: poolMetrics.size || 'N/A',
        activeConnections: poolMetrics.activeConnections || 'N/A',
        idleConnections: poolMetrics.idleConnections || 'N/A',
        waitingRequests: poolMetrics.waitingRequests || 0,
        totalCreated: poolMetrics.totalCreated || 'N/A',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  /**
   * 获取Redis连接状态
   */
  async getRedisConnectionStats() {
    try {
      const info = await redis.info('stats');
      const commandStats = await redis.info('commandstats');

      return {
        status: redis.status,
        connected: redis.status === 'ready',
        info: info,
        commandStats: commandStats,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        connected: false,
      };
    }
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    return {
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
      arrayBuffers: `${Math.round(usage.arrayBuffers / 1024 / 1024)}MB`,
      systemTotal: `${Math.round(totalMemory / 1024 / 1024)}MB`,
      systemFree: `${Math.round(freeMemory / 1024 / 1024)}MB`,
    };
  }

  /**
   * 获取完整诊断报告
   */
  async getDiagnosticReport() {
    const uptime = Date.now() - this.metrics.startTime;
    const successRate = this.metrics.requestCount > 0
      ? ((this.metrics.successfulRequests / this.metrics.requestCount) * 100).toFixed(2)
      : 0;
    const avgRequestTime = this.metrics.successfulRequests > 0
      ? (this.metrics.totalRequestTime / this.metrics.successfulRequests).toFixed(2)
      : 0;

    return {
      timestamp: new Date().toISOString(),
      uptime: `${(uptime / 1000).toFixed(2)}s`,
      requests: {
        total: this.metrics.requestCount,
        successful: this.metrics.successfulRequests,
        failed: this.metrics.failedRequests,
        successRate: `${successRate}%`,
        avgResponseTime: `${avgRequestTime}ms`,
        active: this.metrics.activeConnections,
      },
      connections: {
        prisma: await this.getPrismaConnectionStats(),
        redis: await this.getRedisConnectionStats(),
      },
      memory: this.getMemoryUsage(),
      recentErrors: this.errorLog.slice(-10), // 最近10个错误
      gcStats: this.getGCStats(),
    };
  }

  /**
   * 获取垃圾回收统计信息
   */
  getGCStats() {
    try {
      // Node.js提供的gc统计（需要运行时启用--expose-gc标志）
      if (global.gc) {
        const before = process.memoryUsage();
        global.gc();
        const after = process.memoryUsage();

        return {
          gcAvailable: true,
          freedMemory: `${Math.round((before.heapUsed - after.heapUsed) / 1024 / 1024)}MB`,
          note: '通过--expose-gc标志检测到GC功能',
        };
      } else {
        return {
          gcAvailable: false,
          note: '需要使用--expose-gc标志启动Node.js以获取GC统计信息',
        };
      }
    } catch (error) {
      return {
        error: error.message,
      };
    }
  }

  /**
   * 测试数据库连接稳定性
   */
  async testDatabaseConnectionStability() {
    const results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        passed: 0,
        failed: 0,
      },
    };

    // 测试1: 基本连接
    try {
      await prisma.$queryRaw`SELECT 1`;
      results.tests.push({
        name: '基本连接测试',
        status: 'PASS',
        duration: '0ms',
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: '基本连接测试',
        status: 'FAIL',
        error: error.message,
      });
      results.summary.failed++;
    }

    // 测试2: 产品查询
    try {
      const start = Date.now();
      const count = await prisma.product.count();
      const duration = Date.now() - start;

      results.tests.push({
        name: '产品查询测试',
        status: 'PASS',
        duration: `${duration}ms`,
        result: `找到 ${count} 个产品`,
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: '产品查询测试',
        status: 'FAIL',
        error: error.message,
      });
      results.summary.failed++;
    }

    // 测试3: 订单查询
    try {
      const start = Date.now();
      const count = await prisma.order.count();
      const duration = Date.now() - start;

      results.tests.push({
        name: '订单查询测试',
        status: 'PASS',
        duration: `${duration}ms`,
        result: `找到 ${count} 个订单`,
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: '订单查询测试',
        status: 'FAIL',
        error: error.message,
      });
      results.summary.failed++;
    }

    return results;
  }

  /**
   * 测试Redis连接稳定性
   */
  async testRedisConnectionStability() {
    const results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        passed: 0,
        failed: 0,
      },
    };

    // 测试1: PING
    try {
      const pong = await redis.ping();
      results.tests.push({
        name: 'PING测试',
        status: 'PASS',
        result: pong,
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: 'PING测试',
        status: 'FAIL',
        error: error.message,
      });
      results.summary.failed++;
    }

    // 测试2: SET/GET
    try {
      const testKey = `diag-test-${Date.now()}`;
      const testValue = 'test-value';

      await redis.set(testKey, testValue, 'EX', 10);
      const value = await redis.get(testKey);

      if (value === testValue) {
        results.tests.push({
          name: 'SET/GET测试',
          status: 'PASS',
          result: '成功',
        });
        results.summary.passed++;
      } else {
        throw new Error('值不匹配');
      }
    } catch (error) {
      results.tests.push({
        name: 'SET/GET测试',
        status: 'FAIL',
        error: error.message,
      });
      results.summary.failed++;
    }

    // 测试3: 多键操作
    try {
      const keys = Array.from({ length: 10 }, (_, i) => `key-${i}-${Date.now()}`);

      // MSET
      const msetArgs = [];
      keys.forEach((key, i) => {
        msetArgs.push(key);
        msetArgs.push(`value-${i}`);
      });
      await redis.mset(...msetArgs);

      // MGET
      const values = await redis.mget(...keys);

      if (values.length === keys.length) {
        results.tests.push({
          name: '多键操作测试',
          status: 'PASS',
          result: `成功操作 ${keys.length} 个键`,
        });
        results.summary.passed++;
      } else {
        throw new Error('键数不匹配');
      }
    } catch (error) {
      results.tests.push({
        name: '多键操作测试',
        status: 'FAIL',
        error: error.message,
      });
      results.summary.failed++;
    }

    return results;
  }

  /**
   * 重置指标
   */
  reset() {
    this.metrics = {
      requestCount: 0,
      activeConnections: 0,
      failedRequests: 0,
      successfulRequests: 0,
      totalRequestTime: 0,
      prismaConnectionStats: {},
      redisConnectionStats: {},
      startTime: Date.now(),
      timeouts: 0,
      errors: [],
    };
    this.errorLog = [];
    this.requestTracker.clear();
  }
}

export default new DiagnosticsService();
