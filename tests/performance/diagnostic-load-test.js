#!/usr/bin/env node

/**
 * 诊断性负载测试
 * 逐步增加并发，详细记录每个阶段的失败原因
 */

import http from 'http';
import { performance } from 'perf_hooks';

const TARGET_HOST = 'localhost';
const TARGET_PORT = 3005;

// 测试配置
const TEST_PHASES = [
  { name: '预热', rps: 2, duration: 10 },      // 2 req/s × 10s = 20 requests
  { name: '低负载', rps: 5, duration: 30 },     // 5 req/s × 30s = 150 requests
  { name: '中等负载', rps: 15, duration: 30 },  // 15 req/s × 30s = 450 requests
  { name: '高负载', rps: 30, duration: 30 },    // 30 req/s × 30s = 900 requests
];

class DiagnosticLoadTester {
  constructor() {
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errorDetails: {},
      responseTimings: [],
      phaseResults: [],
    };
    this.currentPhase = null;
    this.phaseStartTime = null;
    this.requestsInPhase = 0;
    this.failuresInPhase = 0;
  }

  /**
   * 创建单个测试请求
   */
  makeRequest(path = '/api/products') {
    return new Promise((resolve) => {
      const startTime = performance.now();

      const req = http.get(`http://${TARGET_HOST}:${TARGET_PORT}${path}`, {
        timeout: 5000,
      }, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          const duration = performance.now() - startTime;

          if (res.statusCode >= 200 && res.statusCode < 300) {
            this.results.successfulRequests++;
            this.results.responseTimings.push({
              statusCode: res.statusCode,
              duration,
              timestamp: new Date().toISOString(),
            });
            resolve({
              success: true,
              statusCode: res.statusCode,
              duration,
            });
          } else {
            this.results.failedRequests++;
            const errorKey = `HTTP ${res.statusCode}`;
            this.results.errorDetails[errorKey] = (this.results.errorDetails[errorKey] || 0) + 1;
            resolve({
              success: false,
              statusCode: res.statusCode,
              duration,
              error: errorKey,
            });
          }
        });
      });

      req.on('error', (err) => {
        const duration = performance.now() - startTime;
        this.results.failedRequests++;

        let errorKey = err.code || 'UNKNOWN_ERROR';
        if (err.message) {
          errorKey = `${errorKey}: ${err.message.substring(0, 50)}`;
        }

        this.results.errorDetails[errorKey] = (this.results.errorDetails[errorKey] || 0) + 1;

        resolve({
          success: false,
          duration,
          error: errorKey,
        });
      });

      req.on('timeout', () => {
        this.results.failedRequests++;
        this.results.errorDetails['TIMEOUT'] = (this.results.errorDetails['TIMEOUT'] || 0) + 1;
        req.destroy();
        resolve({
          success: false,
          error: 'TIMEOUT',
        });
      });
    });
  }

  /**
   * 执行一个阶段的负载测试
   */
  async executePhase(phaseName, rps, durationSeconds) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`阶段: ${phaseName} (RPS: ${rps}, 持续时间: ${durationSeconds}s)`);
    console.log('='.repeat(60));

    this.currentPhase = phaseName;
    this.phaseStartTime = Date.now();
    this.requestsInPhase = 0;
    this.failuresInPhase = 0;

    const phaseResults = {
      name: phaseName,
      rps,
      durationSeconds,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      avgResponseTime: 0,
      errorBreakdown: {},
    };

    const targetRequests = rps * durationSeconds;
    const requestInterval = 1000 / rps; // 毫秒
    let requestsStarted = 0;
    let lastTime = Date.now();

    const promises = [];

    while (requestsStarted < targetRequests) {
      const now = Date.now();
      const timePassed = now - lastTime;

      if (timePassed >= requestInterval) {
        const requestsThisBatch = Math.floor(timePassed / requestInterval);

        for (let i = 0; i < requestsThisBatch && requestsStarted < targetRequests; i++) {
          promises.push(this.makeRequest());
          requestsStarted++;
          this.requestsInPhase++;
        }

        lastTime = now;
      }

      // 定期显示进度
      if (this.requestsInPhase % 50 === 0) {
        const elapsed = (Date.now() - this.phaseStartTime) / 1000;
        console.log(`  进度: ${this.requestsInPhase}/${targetRequests} 请求 (${elapsed.toFixed(1)}s 已过)`);
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // 等待所有请求完成
    await Promise.all(promises);

    const phaseDuration = (Date.now() - this.phaseStartTime) / 1000;
    const phaseSuccessfulRequests = promises.filter((_, i) => {
      // 计算该阶段的成功请求
      return i < this.requestsInPhase;
    }).length;

    phaseResults.totalRequests = this.requestsInPhase;
    phaseResults.successfulRequests = this.results.successfulRequests - (this.results.successfulRequests - phaseSuccessfulRequests);
    phaseResults.failedRequests = this.requestsInPhase - phaseResults.successfulRequests;
    phaseResults.successRate = ((phaseResults.successfulRequests / this.requestsInPhase) * 100).toFixed(2);

    // 计算该阶段的平均响应时间
    const phaseTimings = this.results.responseTimings.slice(-this.requestsInPhase);
    if (phaseTimings.length > 0) {
      const avgTime = phaseTimings.reduce((sum, t) => sum + t.duration, 0) / phaseTimings.length;
      phaseResults.avgResponseTime = avgTime.toFixed(2);
    }

    // 复制错误详情
    phaseResults.errorBreakdown = { ...this.results.errorDetails };

    this.results.phaseResults.push(phaseResults);

    this.printPhaseResults(phaseResults, phaseDuration);
  }

  /**
   * 打印阶段结果
   */
  printPhaseResults(phaseResults, duration) {
    console.log(`\n阶段完成: ${phaseResults.name}`);
    console.log(`  总请求数: ${phaseResults.totalRequests}`);
    console.log(`  成功: ${phaseResults.successfulRequests} (${phaseResults.successRate}%)`);
    console.log(`  失败: ${phaseResults.failedRequests}`);
    console.log(`  平均响应时间: ${phaseResults.avgResponseTime}ms`);
    console.log(`  实际持续时间: ${duration.toFixed(2)}s`);

    if (Object.keys(phaseResults.errorBreakdown).length > 0) {
      console.log(`  错误详情:`);
      for (const [error, count] of Object.entries(phaseResults.errorBreakdown)) {
        const percentage = ((count / phaseResults.totalRequests) * 100).toFixed(1);
        console.log(`    - ${error}: ${count} (${percentage}%)`);
      }
    }
  }

  /**
   * 执行完整测试
   */
  async runFullTest() {
    console.log('\n' + '='.repeat(60));
    console.log('诊断性负载测试开始');
    console.log('='.repeat(60));
    console.log(`目标: http://${TARGET_HOST}:${TARGET_PORT}`);

    try {
      // 执行所有阶段
      for (const phase of TEST_PHASES) {
        await this.executePhase(phase.name, phase.rps, phase.duration);

        // 阶段之间的冷却时间
        if (phase !== TEST_PHASES[TEST_PHASES.length - 1]) {
          console.log('\n等待10秒冷却...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }

      this.printSummary();
    } catch (error) {
      console.error('测试执行失败:', error);
      process.exit(1);
    }
  }

  /**
   * 打印总结报告
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('测试总结报告');
    console.log('='.repeat(60));

    const overallSuccessRate = ((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2);

    console.log(`\n总体统计:`);
    console.log(`  总请求数: ${this.results.totalRequests}`);
    console.log(`  成功: ${this.results.successfulRequests} (${overallSuccessRate}%)`);
    console.log(`  失败: ${this.results.failedRequests}`);

    console.log(`\n各阶段对比:`);
    for (const phase of this.results.phaseResults) {
      console.log(`  ${phase.name.padEnd(10)} - RPS: ${phase.rps.toString().padStart(2)} | 成功率: ${phase.successRate.padStart(5)}% | 平均响应: ${phase.avgResponseTime.padStart(7)}ms`);
    }

    console.log(`\n错误统计 (全局):`);
    for (const [error, count] of Object.entries(this.results.errorDetails)) {
      const percentage = ((count / this.results.failedRequests) * 100).toFixed(1);
      console.log(`  ${error}: ${count} (${percentage}%)`);
    }

    console.log(`\n响应时间统计 (成功请求):`);
    if (this.results.responseTimings.length > 0) {
      const durations = this.results.responseTimings.map(t => t.duration).sort((a, b) => a - b);
      const min = durations[0];
      const max = durations[durations.length - 1];
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const p95 = durations[Math.floor(durations.length * 0.95)];
      const p99 = durations[Math.floor(durations.length * 0.99)];

      console.log(`  最小: ${min.toFixed(2)}ms`);
      console.log(`  最大: ${max.toFixed(2)}ms`);
      console.log(`  平均: ${avg.toFixed(2)}ms`);
      console.log(`  P95: ${p95.toFixed(2)}ms`);
      console.log(`  P99: ${p99.toFixed(2)}ms`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试完成!');
    console.log('='.repeat(60) + '\n');
  }
}

// 主程序
const tester = new DiagnosticLoadTester();
tester.runFullTest().catch(err => {
  console.error('失败:', err);
  process.exit(1);
});
