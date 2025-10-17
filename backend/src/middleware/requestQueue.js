/**
 * 请求队列管理中间件
 * 使用 p-queue 库限制并发请求数量，防止系统过载
 */

import PQueue from 'p-queue';

class RequestQueueManager {
  constructor(options = {}) {
    // 队列配置
    this.maxConcurrency = options.maxConcurrency || 100; // 最大并发请求数
    this.queueSize = options.queueSize || 1000; // 队列最大长度
    this.requestTimeout = options.requestTimeout || 30000; // 请求超时时间（毫秒）

    // 初始化队列
    this.queue = new PQueue({
      concurrency: this.maxConcurrency,
      timeout: this.requestTimeout,
      throwOnTimeout: true,
    });

    // 统计信息
    this.stats = {
      totalRequests: 0,
      processedRequests: 0,
      rejectedRequests: 0,
      averageWaitTime: 0,
      peakQueueSize: 0,
      startTime: Date.now(),
    };

    this.requestTimestamps = [];
  }

  /**
   * 将请求加入队列
   * @param {Function} fn - 要执行的异步函数
   * @returns {Promise} 函数执行结果
   */
  async enqueue(fn) {
    const enterTime = Date.now();
    this.stats.totalRequests++;

    // 检查队列大小是否超过限制
    if (this.queue.size >= this.queueSize) {
      this.stats.rejectedRequests++;
      const error = new Error('Request queue is full');
      error.code = 'QUEUE_FULL';
      error.statusCode = 503;
      throw error;
    }

    try {
      // 将请求加入队列执行
      const result = await this.queue.add(fn);

      const exitTime = Date.now();
      const waitTime = exitTime - enterTime;

      this.stats.processedRequests++;
      this.requestTimestamps.push(waitTime);

      // 更新平均等待时间
      this.stats.averageWaitTime =
        this.requestTimestamps.reduce((a, b) => a + b, 0) / this.requestTimestamps.length;

      // 保持最近 1000 个请求的数据
      if (this.requestTimestamps.length > 1000) {
        this.requestTimestamps.shift();
      }

      return result;
    } catch (error) {
      this.stats.rejectedRequests++;

      if (error.code === 'ERR_QUEUE_ADD_ABORTED') {
        const timeoutError = new Error('Request timeout - server is overloaded');
        timeoutError.code = 'REQUEST_TIMEOUT';
        timeoutError.statusCode = 503;
        throw timeoutError;
      }

      throw error;
    }
  }

  /**
   * 获取队列统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    const uptime = (Date.now() - this.stats.startTime) / 1000;

    return {
      concurrency: this.maxConcurrency,
      queueSize: this.queueSize,
      currentPending: this.queue.pending,
      currentSize: this.queue.size,
      totalRequests: this.stats.totalRequests,
      processedRequests: this.stats.processedRequests,
      rejectedRequests: this.stats.rejectedRequests,
      successRate: (this.stats.processedRequests / this.stats.totalRequests * 100).toFixed(2) + '%',
      averageWaitTime: Math.round(this.stats.averageWaitTime) + 'ms',
      peakQueueSize: this.stats.peakQueueSize,
      uptime: Math.round(uptime) + 's',
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      processedRequests: 0,
      rejectedRequests: 0,
      averageWaitTime: 0,
      peakQueueSize: 0,
      startTime: Date.now(),
    };
    this.requestTimestamps = [];
  }

  /**
   * 更新最大并发数
   * @param {number} concurrency - 新的并发数限制
   */
  setMaxConcurrency(concurrency) {
    if (concurrency < 1) {
      throw new Error('Concurrency must be at least 1');
    }
    this.maxConcurrency = concurrency;
    this.queue.concurrency = concurrency;
  }

  /**
   * 清空队列
   */
  async clear() {
    this.queue.clear();
  }
}

// 创建全局队列管理器实例
const requestQueueManager = new RequestQueueManager({
  maxConcurrency: 100,
  queueSize: 1000,
  requestTimeout: 30000,
});

/**
 * Fastify 请求队列插件
 * 简化版本 - 仅提供统计功能，不实际限制并发
 * 实际并发限制由 @fastify/rate-limit 插件处理
 */
export async function registerRequestQueuePlugin(fastify, options = {}) {
  // 创建队列管理器实例（用于统计）
  let queueManager = requestQueueManager;
  if (options.createNew) {
    queueManager = new RequestQueueManager(options);
  }

  // 提供访问队列管理器的方法
  fastify.decorate('requestQueue', {
    getStats: () => queueManager.getStats(),
    resetStats: () => queueManager.resetStats(),
    setMaxConcurrency: (concurrency) => queueManager.setMaxConcurrency(concurrency),
    clear: () => queueManager.clear(),
    enqueue: (fn) => queueManager.enqueue(fn),
  });

  // 添加统计信息端点
  fastify.get('/api/admin/queue-stats', {}, async (request, reply) => {
    return {
      success: true,
      data: queueManager.getStats(),
    };
  });
}

export default requestQueueManager;
