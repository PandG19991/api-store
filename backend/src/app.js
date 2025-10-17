/**
 * Fastify 应用入口文件
 * 虚拟产品销售平台后端 API 服务
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import compress from '@fastify/compress';

import config, { isDevelopment } from './config/env.js';
import prisma from './config/database.js';
import redis from './config/redis.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { registerRequestQueuePlugin } from './middleware/requestQueue.js';
import inventoryService from './services/inventory.service.js';
import diagnosticsService from './services/diagnostics.service.js';

// 导入路由
import productRoutes from './routes/public/products.js';
import paymentRoutes from './routes/public/payments.js';
import orderRoutes from './routes/public/orders.js';
import adminAuthRoutes from './routes/admin/auth.js';
import adminDashboardRoutes from './routes/admin/dashboard.js';
import adminProductRoutes from './routes/admin/products.js';
import adminLicenseKeyRoutes from './routes/admin/license-keys.js';
import adminOrderRoutes from './routes/admin/orders.js';
import adminSettingsRoutes from './routes/admin/settings.js';

// 创建 Fastify 实例
const fastify = Fastify({
  logger: {
    level: config.log.level,
  },
  trustProxy: true, // 信任代理,获取真实 IP
});

/**
 * 注册插件和中间件
 */
async function registerPlugins() {
  // CORS 配置
  await fastify.register(cors, {
    origin: [config.cors.frontendUrl, config.cors.adminUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  // 安全头
  await fastify.register(helmet, {
    contentSecurityPolicy: isDevelopment ? false : undefined,
  });

  // JWT 认证
  await fastify.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
  });

  // Rate Limiting (API 限流)
  await fastify.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
    redis,
    skipOnError: true, // Redis 错误时跳过限流
    errorResponseBuilder: () => ({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, please try again later',
    }),
  });

  // 文件上传支持
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 10,
    },
  });

  // 请求队列管理 (防止并发过载)
  await fastify.register(registerRequestQueuePlugin, {
    maxConcurrency: config.requestQueue?.maxConcurrency || 100,
    queueSize: config.requestQueue?.queueSize || 1000,
  });

  // 添加请求钩子用于诊断追踪
  fastify.addHook('onRequest', async (request, reply) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    request.id = requestId;
    diagnosticsService.recordRequestStart(requestId);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const success = reply.statusCode < 400;
    diagnosticsService.recordRequestEnd(request.id, success);
  });
}

/**
 * 注册路由
 */
async function registerRoutes() {
  // 健康检查接口
  fastify.get('/health', async (request, reply) => {
    return {
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // API 根路径
  fastify.get('/api', async (request, reply) => {
    return {
      success: true,
      message: 'License Store API v1.0',
      docs: '/api/docs',
    };
  });

  // 诊断路由
  fastify.get('/api/diagnostics/report', async (request, reply) => {
    const report = await diagnosticsService.getDiagnosticReport();
    return {
      success: true,
      data: report,
    };
  });

  fastify.get('/api/diagnostics/database-test', async (request, reply) => {
    const result = await diagnosticsService.testDatabaseConnectionStability();
    return {
      success: true,
      data: result,
    };
  });

  fastify.get('/api/diagnostics/redis-test', async (request, reply) => {
    const result = await diagnosticsService.testRedisConnectionStability();
    return {
      success: true,
      data: result,
    };
  });

  fastify.post('/api/diagnostics/reset', async (request, reply) => {
    diagnosticsService.reset();
    return {
      success: true,
      message: '诊断数据已重置',
    };
  });

  // 公开路由 (无需认证)
  await fastify.register(productRoutes, { prefix: '/api/products' });
  await fastify.register(paymentRoutes, { prefix: '/api/payments' });
  await fastify.register(orderRoutes, { prefix: '/api/orders' });

  // 管理后台路由
  await fastify.register(adminAuthRoutes, { prefix: '/api/admin/auth' });
  await fastify.register(adminDashboardRoutes, { prefix: '/api/admin/dashboard' });
  await fastify.register(adminProductRoutes, { prefix: '/api/admin/products' });
  await fastify.register(adminLicenseKeyRoutes, { prefix: '/api/admin/license-keys' });
  await fastify.register(adminOrderRoutes, { prefix: '/api/admin/orders' });
  await fastify.register(adminSettingsRoutes, { prefix: '/api/admin/settings' });
}

/**
 * 注册错误处理
 */
function registerErrorHandlers() {
  // 全局错误处理器
  fastify.setErrorHandler(errorHandler);

  // 404 处理器
  fastify.setNotFoundHandler(notFoundHandler);
}

/**
 * 启动服务器
 */
async function start() {
  try {
    // 注册插件
    await registerPlugins();

    // 注册路由
    await registerRoutes();

    // 注册错误处理
    registerErrorHandlers();

    // 测试数据库连接
    await prisma.$connect();
    fastify.log.info('✅ Database connected successfully');

    // 测试 Redis 连接
    await redis.ping();
    fastify.log.info('✅ Redis connected successfully');

    // 启动库存监控（可选，默认关闭，可通过管理后台或环境变量启用）
    if (config.inventory?.checkInterval && config.inventory.checkInterval > 0) {
      inventoryService.startMonitoring(config.inventory.checkInterval);
      fastify.log.info('✅ Inventory monitoring started');
    } else {
      fastify.log.info('ℹ️  Inventory monitoring disabled (can be enabled via admin panel)');
    }

    // 启动服务器
    await fastify.listen({
      port: config.port,
      host: config.host,
    });

    console.log('');
    console.log('🚀 Server is running!');
    console.log(`📍 Local:   http://localhost:${config.port}`);
    console.log(`🌍 Network: http://${config.host}:${config.port}`);
    console.log(`📝 Environment: ${config.env}`);
    console.log('');
    // 显示库存监控状态
    const inventoryStatus = inventoryService.getMonitoringStatus();
    if (inventoryStatus.isMonitoring) {
      console.log(`📦 Inventory Monitoring: ENABLED`);
      console.log(`   - Threshold: ${inventoryStatus.alertThreshold}`);
      console.log(`   - Check Interval: ${inventoryStatus.checkInterval}s`);
      console.log(`   - Alert Channels: ${inventoryStatus.enabledChannels.join(', ') || 'None'}`);
    }
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
  } catch (error) {
    fastify.log.error(error);
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

/**
 * 优雅关闭
 */
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received, shutting down gracefully...`);

  try {
    // 停止库存监控
    if (inventoryService.isMonitoring) {
      inventoryService.stopMonitoring();
      console.log('✅ Inventory monitoring stopped');
    }

    // 关闭 Fastify 服务器
    await fastify.close();
    console.log('✅ Fastify server closed');

    // 断开数据库连接
    await prisma.$disconnect();
    console.log('✅ Database disconnected');

    // 关闭 Redis 连接
    await redis.quit();
    console.log('✅ Redis disconnected');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// 监听关闭信号
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// 启动应用
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const mainFilePath = process.argv[1];

if (__filename === mainFilePath) {
  start();
}

export default fastify;

