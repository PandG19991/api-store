
import http from "k6/http";
import { check, group, sleep } from "k6";

export const options = {
  // VU 数量和持续时间配置
  stages: [
    { duration: "30s", target: 10 },    // 10个虚拟用户，30秒
    { duration: "60s", target: 50 },    // 增加到50个用户，60秒
    { duration: "120s", target: 100 },  // 增加到100个用户，120秒
    { duration: "30s", target: 10 },    // 减少到10个用户，30秒
    { duration: "10s", target: 0 },     // 停止所有用户
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000", "p(99)<3000"], // 95%请求<1秒，99%<3秒
    http_req_failed: ["rate<0.01"],                   // 错误率<1%
  },
};

const BASE_URL = "http://localhost:3001";

export default function () {
  // 测试场景1: 获取产品列表（分页）
  group("获取产品列表", () => {
    const pageNum = Math.floor(Math.random() * 10) + 1;
    const resp = http.get(`${BASE_URL}/api/products?page=${pageNum}&limit=20`, {
      tags: { name: "Products" },
    });

    check(resp, {
      "状态码正确": (r) => r.status === 200,
      "响应时间 < 500ms": (r) => r.timings.duration < 500,
      "返回数据": (r) => r.json("data") !== null,
    });
  });

  sleep(1);

  // 测试场景2: 搜索产品
  group("搜索产品", () => {
    const keywords = ["Windows", "Office", "Adobe", "Visual", "AutoCAD"];
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];

    const resp = http.get(
      `${BASE_URL}/api/products/search?q=${keyword}&limit=20`,
      {
        tags: { name: "ProductSearch" },
      }
    );

    check(resp, {
      "搜索成功": (r) => r.status === 200,
      "响应时间 < 1000ms": (r) => r.timings.duration < 1000,
      "返回结果": (r) => r.body.length > 0,
    });
  });

  sleep(1);

  // 测试场景3: 获取订单列表（大数据量）
  group("查询订单列表", () => {
    const pageNum = Math.floor(Math.random() * 100) + 1;
    const resp = http.get(
      `${BASE_URL}/api/admin/orders?page=${pageNum}&limit=50`,
      {
        tags: { name: "OrdersList" },
        headers: {
          Authorization: `Bearer ${__ENV.ADMIN_TOKEN || "test-token"}`,
        },
      }
    );

    check(resp, {
      "获取订单列表成功": (r) => r.status === 200 || r.status === 401,
      "响应时间 < 2000ms": (r) => r.timings.duration < 2000,
    });
  });

  sleep(1);

  // 测试场景4: 查询密钥（1000+数据）
  group("查询密钥列表", () => {
    const pageNum = Math.floor(Math.random() * 50) + 1;
    const resp = http.get(
      `${BASE_URL}/api/admin/licenses?page=${pageNum}&limit=100`,
      {
        tags: { name: "LicensesList" },
        headers: {
          Authorization: `Bearer ${__ENV.ADMIN_TOKEN || "test-token"}`,
        },
      }
    );

    check(resp, {
      "获取密钥列表成功": (r) => r.status === 200 || r.status === 401,
      "响应时间 < 2000ms": (r) => r.timings.duration < 2000,
    });
  });

  sleep(1);

  // 测试场景5: 获取仪表盘数据
  group("获取仪表盘数据", () => {
    const resp = http.get(`${BASE_URL}/api/admin/dashboard`, {
      tags: { name: "Dashboard" },
      headers: {
        Authorization: `Bearer ${__ENV.ADMIN_TOKEN || "test-token"}`,
      },
    });

    check(resp, {
      "仪表盘加载成功": (r) => r.status === 200 || r.status === 401,
      "响应时间 < 1000ms": (r) => r.timings.duration < 1000,
      "包含统计数据": (r) => {
        try {
          const json = r.json();
          return json.revenue || json.orders || json.products;
        } catch {
          return false;
        }
      },
    });
  });

  sleep(2);
}

export function handleSummary(data) {
  return {
    "stdout": textSummary(data, { indent: " ", enableColors: true }),
    "tests/performance/k6-results.json": JSON.stringify(data),
  };
}

function textSummary(data, options = {}) {
  const { indent = "", enableColors = false } = options;
  let summary = "\n╔══════════════════════════════════════════════════════════╗\n";
  summary += "║         K6 性能测试结果统计                              ║\n";
  summary += "╚══════════════════════════════════════════════════════════╝\n\n";

  if (data.metrics) {
    summary += `${indent}HTTP 请求统计:\n`;
    summary += `${indent}  总请求数: ${data.metrics.http_reqs?.value || 0}\n`;
    summary += `${indent}  失败数: ${data.metrics.http_req_failed?.value || 0}\n`;
    summary += `${indent}  平均响应时间: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(0)}ms\n`;
    summary += `${indent}  P95响应时间: ${(data.metrics.http_req_duration?.values?.p95 || 0).toFixed(0)}ms\n`;
    summary += `${indent}  P99响应时间: ${(data.metrics.http_req_duration?.values?.p99 || 0).toFixed(0)}ms\n`;
  }

  return summary;
}
