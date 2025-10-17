
/**
 * Node.js 原生性能测试工具
 * 用于测试密钥销售平台的性能
 *
 * 运行: node nodejs-load-test.js
 */

import http from "http";
import https from "https";

const BASE_URL = "http://localhost:3001";

// 测试配置
const config = {
  // 阶段配置
  stages: [
    { duration: 30, rps: 5, name: "预热 (5 req/s)" },
    { duration: 60, rps: 15, name: "逐步增压 (15 req/s)" },
    { duration: 120, rps: 30, name: "持续压力 (30 req/s)" },
    { duration: 30, rps: 10, name: "冷却 (10 req/s)" },
  ],
  // 测试场景
  endpoints: [
    { method: "GET", path: "/api/products", name: "获取产品列表" },
    { method: "GET", path: "/api/products?page=1&limit=50", name: "产品分页" },
    { method: "GET", path: "/api/admin/dashboard", name: "获取仪表盘" },
  ],
};

// 性能统计
const stats = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  totalDuration: 0,
  responseTimes: [],
  errors: {},
  startTime: null,
  endTime: null,
};

/**
 * 发送 HTTP 请求
 */
function makeRequest(endpoint) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const requestURL = `${BASE_URL}${endpoint.path}`;

    const options = {
      hostname: "localhost",
      port: 3001,
      path: endpoint.path,
      method: endpoint.method,
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "LoadTest/1.0",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        const duration = Date.now() - startTime;
        const success = res.statusCode >= 200 && res.statusCode < 400;

        stats.totalRequests++;
        stats.totalDuration += duration;
        stats.responseTimes.push(duration);

        if (success) {
          stats.successRequests++;
        } else {
          stats.failedRequests++;
          const errorKey = `${res.statusCode}`;
          stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
        }

        resolve({ success, duration, statusCode: res.statusCode });
      });
    });

    req.on("error", (error) => {
      const duration = Date.now() - startTime;
      stats.totalRequests++;
      stats.totalDuration += duration;
      stats.failedRequests++;
      stats.responseTimes.push(duration);

      const errorKey = error.code || "UNKNOWN";
      stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;

      resolve({ success: false, duration, error: error.message });
    });

    req.on("timeout", () => {
      req.destroy();
      stats.totalRequests++;
      stats.failedRequests++;
      stats.errors["TIMEOUT"] = (stats.errors["TIMEOUT"] || 0) + 1;
      resolve({ success: false, error: "TIMEOUT" });
    });

    req.end();
  });
}

/**
 * 计算统计数据
 */
function calculateStats() {
  const responseTimes = stats.responseTimes.sort((a, b) => a - b);
  const len = responseTimes.length;

  return {
    count: len,
    min: responseTimes[0] || 0,
    max: responseTimes[len - 1] || 0,
    avg: len > 0 ? stats.totalDuration / len : 0,
    p50: responseTimes[Math.floor(len * 0.5)] || 0,
    p95: responseTimes[Math.floor(len * 0.95)] || 0,
    p99: responseTimes[Math.floor(len * 0.99)] || 0,
  };
}

/**
 * 运行测试阶段
 */
async function runStage(stage) {
  console.log(`\n启动阶段: ${stage.name}`);
  console.log(`目标 RPS: ${stage.rps}, 持续时间: ${stage.duration}秒`);

  const stageStartTime = Date.now();
  const totalRequests = Math.floor((stage.duration * stage.rps) / stage.duration);
  let requestCount = 0;

  while (Date.now() - stageStartTime < stage.duration * 1000) {
    const batchStartTime = Date.now();

    // 发送本秒的请求
    const promises = [];
    for (let i = 0; i < stage.rps; i++) {
      const endpoint =
        config.endpoints[Math.floor(Math.random() * config.endpoints.length)];
      promises.push(makeRequest(endpoint));
      requestCount++;
    }

    const results = await Promise.all(promises);

    // 计算本秒的性能数据
    const successCount = results.filter((r) => r.success).length;
    const avgDuration =
      results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length;

    const percentComplete = Math.floor(
      ((Date.now() - stageStartTime) / (stage.duration * 1000)) * 100
    );
    process.stdout.write(
      `\r进度: ${percentComplete}% | 请求: ${requestCount} | 成功: ${successCount}/${stage.rps} | 平均响应: ${avgDuration.toFixed(0)}ms`
    );

    // 等待到下一秒
    const elapsed = Date.now() - batchStartTime;
    const waitTime = Math.max(0, 1000 - elapsed);
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  console.log("");
}

/**
 * 打印性能报告
 */
function printReport() {
  const finalStats = calculateStats();
  const duration = (stats.endTime - stats.startTime) / 1000;
  const errorRate = (stats.failedRequests / stats.totalRequests) * 100;
  const throughput = stats.totalRequests / duration;

  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║          性能压力测试结果报告                              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  console.log("📊 请求统计:");
  console.log(`  总请求数:        ${stats.totalRequests}`);
  console.log(`  成功请求:        ${stats.successRequests}`);
  console.log(`  失败请求:        ${stats.failedRequests}`);
  console.log(`  成功率:          ${((stats.successRequests / stats.totalRequests) * 100).toFixed(2)}%`);
  console.log(`  错误率:          ${errorRate.toFixed(2)}%`);
  console.log("");

  console.log("⏱️  响应时间分析:");
  console.log(`  平均响应时间:    ${finalStats.avg.toFixed(2)}ms`);
  console.log(`  最小响应时间:    ${finalStats.min}ms`);
  console.log(`  最大响应时间:    ${finalStats.max}ms`);
  console.log(`  P50 响应时间:    ${finalStats.p50}ms (50%请求)`);
  console.log(`  P95 响应时间:    ${finalStats.p95}ms (95%请求)`);
  console.log(`  P99 响应时间:    ${finalStats.p99}ms (99%请求)`);
  console.log("");

  console.log("📈 吞吐量分析:");
  console.log(`  总测试时长:      ${duration.toFixed(2)}秒`);
  console.log(`  平均吞吐量:      ${throughput.toFixed(2)} req/s`);
  console.log("");

  if (Object.keys(stats.errors).length > 0) {
    console.log("❌ 错误分布:");
    Object.entries(stats.errors).forEach(([error, count]) => {
      const percentage = ((count / stats.failedRequests) * 100).toFixed(1);
      console.log(`  ${error}:        ${count} (${percentage}%)`);
    });
    console.log("");
  }

  console.log("✅ 性能指标评估:");
  const checks = [
    {
      name: "平均响应时间 < 500ms",
      pass: finalStats.avg < 500,
    },
    {
      name: "P95 响应时间 < 1000ms",
      pass: finalStats.p95 < 1000,
    },
    {
      name: "P99 响应时间 < 3000ms",
      pass: finalStats.p99 < 3000,
    },
    {
      name: "错误率 < 1%",
      pass: errorRate < 1,
    },
    {
      name: "吞吐量 > 20 req/s",
      pass: throughput > 20,
    },
  ];

  checks.forEach((check) => {
    const icon = check.pass ? "✅" : "❌";
    console.log(`  ${icon} ${check.name}`);
  });
  console.log("");

  // 生成报告文件
  const reportFileName = `performance-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const report = {
    timestamp: new Date().toISOString(),
    duration: duration,
    stats: {
      totalRequests: stats.totalRequests,
      successRequests: stats.successRequests,
      failedRequests: stats.failedRequests,
      errorRate: errorRate,
      throughput: throughput,
    },
    responseTimes: {
      avg: finalStats.avg,
      min: finalStats.min,
      max: finalStats.max,
      p50: finalStats.p50,
      p95: finalStats.p95,
      p99: finalStats.p99,
    },
    errors: stats.errors,
  };

  console.log(`📁 报告已保存至: ${reportFileName}`);
  console.log("");
}

/**
 * 主函数
 */
async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     密钥销售平台 - 性能压力测试                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  // 检查后端服务
  console.log("✓ 检查后端服务...");
  try {
    await new Promise((resolve, reject) => {
      const req = http.get(`${BASE_URL}/api/products`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Status: ${res.statusCode}`));
        }
      });
      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Timeout"));
      });
    });
    console.log("✓ 后端服务正常运行");
  } catch (error) {
    console.error("✗ 后端服务未响应:", error.message);
    console.error("请先运行: cd backend && npm run dev");
    process.exit(1);
  }

  console.log("");
  console.log("开始性能测试...");
  console.log("");

  stats.startTime = Date.now();

  for (const stage of config.stages) {
    await runStage(stage);
  }

  stats.endTime = Date.now();

  printReport();
}

// 运行测试
main().catch((error) => {
  console.error("测试出错:", error);
  process.exit(1);
});
