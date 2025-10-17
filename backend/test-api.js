/**
 * 后端API测试脚本
 * 系统测试所有API端点，发现并记录bug
 */

import http from 'http';

const BASE_URL = 'http://localhost:3000';
let adminToken = null;

// 测试结果记录
const testResults = {
  passed: [],
  failed: [],
  warnings: [],
};

// HTTP请求封装
function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// 日志函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}${message}${reset}`);
}

// 测试用例
async function testHealthCheck() {
  log('\n=== 测试: Health Check ===');
  try {
    const res = await request('GET', '/health');
    if (res.status === 200 && res.data.success) {
      log('✓ Health check passed', 'success');
      testResults.passed.push('Health Check');
    } else {
      log(`✗ Health check failed: ${JSON.stringify(res.data)}`, 'error');
      testResults.failed.push('Health Check: Unexpected response');
    }
  } catch (error) {
    log(`✗ Health check error: ${error.message}`, 'error');
    testResults.failed.push(`Health Check: ${error.message}`);
  }
}

async function testPublicProductsAPI() {
  log('\n=== 测试: 公开产品API ===');
  try {
    // 测试获取产品列表
    const res = await request('GET', '/api/products');
    if (res.status === 200) {
      log('✓ Get products list passed', 'success');
      testResults.passed.push('Public Products API - List');

      // 检查返回数据结构
      if (!res.data.data || !Array.isArray(res.data.data.products)) {
        log('! Warning: Products data structure unexpected', 'warning');
        testResults.warnings.push('Public Products API - Data structure');
      }
    } else {
      log(`✗ Get products failed: Status ${res.status}`, 'error');
      testResults.failed.push(`Public Products API - List: Status ${res.status}`);
    }
  } catch (error) {
    log(`✗ Public products error: ${error.message}`, 'error');
    testResults.failed.push(`Public Products API: ${error.message}`);
  }
}

async function testAdminAuth() {
  log('\n=== 测试: 管理员认证 ===');

  // 测试登录失败（错误凭证）
  try {
    const res = await request('POST', '/api/admin/auth/login', {
      username: 'wronguser',
      password: 'wrongpass',
    });

    if (res.status === 401) {
      log('✓ Login with wrong credentials correctly rejected', 'success');
      testResults.passed.push('Admin Auth - Invalid credentials handling');
    } else {
      log(`! Warning: Expected 401 but got ${res.status}`, 'warning');
      testResults.warnings.push(`Admin Auth - Expected 401, got ${res.status}`);
    }
  } catch (error) {
    log(`✗ Auth test error: ${error.message}`, 'error');
    testResults.failed.push(`Admin Auth: ${error.message}`);
  }
}

async function testAdminDashboardWithoutAuth() {
  log('\n=== 测试: 未认证访问仪表盘 ===');
  try {
    const res = await request('GET', '/api/admin/dashboard/overview');

    if (res.status === 401) {
      log('✓ Dashboard correctly requires authentication', 'success');
      testResults.passed.push('Admin Dashboard - Auth required');
    } else {
      log(`✗ Dashboard should require auth, got status ${res.status}`, 'error');
      testResults.failed.push(`Admin Dashboard - Auth not enforced: Status ${res.status}`);
    }
  } catch (error) {
    log(`✗ Dashboard test error: ${error.message}`, 'error');
    testResults.failed.push(`Admin Dashboard: ${error.message}`);
  }
}

async function testProductsWithoutAuth() {
  log('\n=== 测试: 未认证访问产品管理 ===');
  try {
    const res = await request('GET', '/api/admin/products');

    if (res.status === 401) {
      log('✓ Admin products correctly requires authentication', 'success');
      testResults.passed.push('Admin Products - Auth required');
    } else {
      log(`✗ Admin products should require auth, got status ${res.status}`, 'error');
      testResults.failed.push(`Admin Products - Auth not enforced: Status ${res.status}`);
    }
  } catch (error) {
    log(`✗ Admin products test error: ${error.message}`, 'error');
    testResults.failed.push(`Admin Products: ${error.message}`);
  }
}

async function testLicenseKeysWithoutAuth() {
  log('\n=== 测试: 未认证访问密钥管理 ===');
  try {
    const res = await request('GET', '/api/admin/license-keys');

    if (res.status === 401) {
      log('✓ License keys correctly requires authentication', 'success');
      testResults.passed.push('Admin License Keys - Auth required');
    } else {
      log(`✗ License keys should require auth, got status ${res.status}`, 'error');
      testResults.failed.push(`Admin License Keys - Auth not enforced: Status ${res.status}`);
    }
  } catch (error) {
    log(`✗ License keys test error: ${error.message}`, 'error');
    testResults.failed.push(`Admin License Keys: ${error.message}`);
  }
}

async function testOrdersWithoutAuth() {
  log('\n=== 测试: 未认证访问订单管理 ===');
  try {
    const res = await request('GET', '/api/admin/orders');

    if (res.status === 401) {
      log('✓ Admin orders correctly requires authentication', 'success');
      testResults.passed.push('Admin Orders - Auth required');
    } else {
      log(`✗ Admin orders should require auth, got status ${res.status}`, 'error');
      testResults.failed.push(`Admin Orders - Auth not enforced: Status ${res.status}`);
    }
  } catch (error) {
    log(`✗ Admin orders test error: ${error.message}`, 'error');
    testResults.failed.push(`Admin Orders: ${error.message}`);
  }
}

async function testSettingsWithoutAuth() {
  log('\n=== 测试: 未认证访问系统设置 ===');
  try {
    const res = await request('GET', '/api/admin/settings');

    if (res.status === 401 || res.status === 403) {
      log('✓ Settings correctly requires authentication', 'success');
      testResults.passed.push('Admin Settings - Auth required');
    } else {
      log(`✗ Settings should require auth, got status ${res.status}`, 'error');
      testResults.failed.push(`Admin Settings - Auth not enforced: Status ${res.status}`);
    }
  } catch (error) {
    log(`✗ Settings test error: ${error.message}`, 'error');
    testResults.failed.push(`Admin Settings: ${error.message}`);
  }
}

// 主测试函数
async function runTests() {
  log('====================================', 'info');
  log('开始后端API测试', 'info');
  log('====================================', 'info');

  await testHealthCheck();
  await testPublicProductsAPI();
  await testAdminAuth();
  await testAdminDashboardWithoutAuth();
  await testProductsWithoutAuth();
  await testLicenseKeysWithoutAuth();
  await testOrdersWithoutAuth();
  await testSettingsWithoutAuth();

  // 打印测试结果
  log('\n====================================', 'info');
  log('测试结果汇总', 'info');
  log('====================================', 'info');

  log(`\n通过: ${testResults.passed.length}`, 'success');
  testResults.passed.forEach((test) => log(`  ✓ ${test}`, 'success'));

  if (testResults.warnings.length > 0) {
    log(`\n警告: ${testResults.warnings.length}`, 'warning');
    testResults.warnings.forEach((test) => log(`  ! ${test}`, 'warning'));
  }

  if (testResults.failed.length > 0) {
    log(`\n失败: ${testResults.failed.length}`, 'error');
    testResults.failed.forEach((test) => log(`  ✗ ${test}`, 'error'));
  }

  log('\n====================================', 'info');

  const totalTests = testResults.passed.length + testResults.failed.length;
  const passRate = ((testResults.passed.length / totalTests) * 100).toFixed(2);
  log(`总计: ${totalTests} 个测试, 通过率: ${passRate}%`, 'info');
  log('====================================\n', 'info');

  process.exit(testResults.failed.length > 0 ? 1 : 0);
}

// 运行测试
runTests().catch((error) => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});
