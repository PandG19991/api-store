/**
 * 环境变量配置模块
 * 加载并验证环境变量
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 .env 文件
dotenv.config({ path: join(__dirname, '../../.env') });

/**
 * 环境变量配置对象
 */
export const config = {
  // 应用配置
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',

  // 数据库配置
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis 配置
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // 加密配置
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },

  // 支付宝配置
  alipay: {
    appId: process.env.ALIPAY_APP_ID,
    privateKey: process.env.ALIPAY_PRIVATE_KEY,
    publicKey: process.env.ALIPAY_PUBLIC_KEY,
    gateway: process.env.ALIPAY_GATEWAY,
    notifyUrl: process.env.ALIPAY_NOTIFY_URL,
    returnUrl: process.env.ALIPAY_RETURN_URL,
  },

  // 微信支付配置
  wechat: {
    appId: process.env.WECHAT_APP_ID,
    mchId: process.env.WECHAT_MCH_ID,
    apiKey: process.env.WECHAT_API_KEY,
    notifyUrl: process.env.WECHAT_NOTIFY_URL,
    certPath: process.env.WECHAT_CERT_PATH,
    keyPath: process.env.WECHAT_KEY_PATH,
  },

  // 邮件服务配置
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromAddress: process.env.EMAIL_FROM || 'noreply@example.com',
    fromName: process.env.EMAIL_FROM_NAME || '虚拟产品商店',
  },

  // 支付回调地址
  payment: {
    alipay: {
      appId: process.env.ALIPAY_APP_ID,
      privateKey: process.env.ALIPAY_PRIVATE_KEY,
      publicKey: process.env.ALIPAY_PUBLIC_KEY,
    },
    wechat: {
      appId: process.env.WECHAT_APP_ID,
      mchId: process.env.WECHAT_MCH_ID,
      apiKey: process.env.WECHAT_API_KEY,
    },
    callbackUrl: process.env.PAYMENT_CALLBACK_URL || 'http://localhost:3000',
  },

  // IP 地理位置服务配置
  geo: {
    provider: process.env.GEO_PROVIDER || 'geoip-lite',
    ipapiKey: process.env.IPAPI_KEY,
    maxmindLicenseKey: process.env.MAXMIND_LICENSE_KEY,
  },

  // 通知配置
  notification: {
    // Server酱配置 (https://sct.ftqq.com/)
    serverChan: {
      sendKey: process.env.SERVERCHAN_SEND_KEY,
    },
    // 企业微信机器人配置
    weCom: {
      webhookUrl: process.env.WECOM_WEBHOOK_URL,
    },
  },

  // 库存预警配置
  inventory: {
    alertThreshold: parseInt(process.env.INVENTORY_ALERT_THRESHOLD || '10'),
    adminEmail: process.env.INVENTORY_ADMIN_EMAIL,
    checkInterval: parseInt(process.env.INVENTORY_CHECK_INTERVAL || '3600'), // 秒
  },

  // CORS 配置
  cors: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
    adminUrl: process.env.ADMIN_URL || 'http://localhost:3002',
  },

  // 文件上传配置 (可选)
  upload: {
    // AWS S3
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      bucket: process.env.AWS_S3_BUCKET,
    },
    // Cloudinary
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
  },

  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Rate Limiting 配置
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '1000'),  // 提升到 1000 req/min
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
  },
};

/**
 * 验证必需的环境变量
 */
export function validateConfig() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
  ];

  const missing = requiredEnvVars.filter(key => {
    const keys = key.split('.');
    let value = process.env;

    // 简单检查顶层环境变量
    if (!process.env[key]) {
      return true;
    }
    return false;
  });

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n💡 Please check your .env file');

    // 在生产环境下缺少必需变量应该退出
    if (config.env === 'production') {
      process.exit(1);
    } else {
      console.warn('\n⚠️  Development mode: continuing without required env vars (some features may not work)\n');
    }
  }

  // 验证 ENCRYPTION_KEY 长度
  if (process.env.ENCRYPTION_KEY) {
    const key = process.env.ENCRYPTION_KEY;
    if (key.length === 64) {
      // 验证是否为有效的十六进制字符串
      if (!/^[0-9a-fA-F]{64}$/.test(key)) {
        console.error('❌ ENCRYPTION_KEY must be a 64-character hexadecimal string');
        console.error('💡 Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
        if (config.env === 'production') {
          process.exit(1);
        }
      }
    } else if (key.length < 32) {
      console.warn('⚠️  ENCRYPTION_KEY is shorter than recommended (should be 64 hex chars or 32+ chars)');
    }
  }
}

/**
 * 是否为开发环境
 */
export const isDevelopment = config.env === 'development';

/**
 * 是否为生产环境
 */
export const isProduction = config.env === 'production';

/**
 * 是否为测试环境
 */
export const isTest = config.env === 'test';

// 启动时验证配置
validateConfig();

export default config;
