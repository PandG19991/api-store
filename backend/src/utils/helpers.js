/**
 * 通用辅助函数模块
 */

import { nanoid } from 'nanoid';

/**
 * 生成订单号
 * 格式: ORD + YYYYMMDD + 6位随机数字
 * @returns {string} 订单号
 * @example "ORD202510160123456"
 */
export function generateOrderNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(100000 + Math.random() * 900000);

  return `ORD${year}${month}${day}${random}`;
}

/**
 * 生成唯一 ID (使用 nanoid)
 * @param {number} length - ID 长度
 * @returns {string} 唯一 ID
 */
export function generateId(length = 21) {
  return nanoid(length);
}

/**
 * 格式化货币金额
 * @param {number} amount - 金额
 * @param {string} currency - 货币代码
 * @returns {string} 格式化后的金额
 */
export function formatCurrency(amount, currency = 'CNY') {
  const currencyMap = {
    CNY: { symbol: '¥', locale: 'zh-CN' },
    USD: { symbol: '$', locale: 'en-US' },
    EUR: { symbol: '€', locale: 'en-EU' },
    JPY: { symbol: '¥', locale: 'ja-JP' },
  };

  const config = currencyMap[currency] || currencyMap.CNY;

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否有效
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证产品 slug 格式
 * @param {string} slug - slug
 * @returns {boolean} 是否有效
 */
export function isValidSlug(slug) {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

/**
 * 从文本生成 slug
 * @param {string} text - 文本
 * @returns {string} slug
 */
export function generateSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 安全解析 JSON
 * @param {string} jsonString - JSON 字符串
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析结果
 */
export function safeJSONParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * 延迟函数
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取客户端真实 IP 地址
 * @param {Object} request - Fastify request 对象
 * @returns {string} IP 地址
 */
export function getClientIP(request) {
  // 尝试从不同的 header 中获取真实 IP
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }

  return request.ip || request.socket.remoteAddress;
}

/**
 * 从 User-Agent 获取设备信息
 * @param {string} userAgent - User-Agent 字符串
 * @returns {Object} 设备信息
 */
export function parseUserAgent(userAgent) {
  if (!userAgent) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
  }

  // 简单的 UA 解析 (生产环境建议使用 ua-parser-js)
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
  const isTablet = /iPad|Android.*Tablet/i.test(userAgent);

  let device = 'Desktop';
  if (isTablet) device = 'Tablet';
  else if (isMobile) device = 'Mobile';

  return {
    browser: getBrowser(userAgent),
    os: getOS(userAgent),
    device,
    raw: userAgent
  };
}

function getBrowser(ua) {
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return 'Unknown';
}

function getOS(ua) {
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Unknown';
}

/**
 * 计算分页参数
 * @param {number} page - 当前页码
 * @param {number} pageSize - 每页数量
 * @returns {Object} { skip, take, page, pageSize }
 */
export function calculatePagination(page = 1, pageSize = 20) {
  const normalizedPage = Math.max(1, parseInt(page) || 1);
  const normalizedPageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 20));

  return {
    skip: (normalizedPage - 1) * normalizedPageSize,
    take: normalizedPageSize,
    page: normalizedPage,
    pageSize: normalizedPageSize
  };
}

/**
 * 构造分页响应
 * @param {Array} data - 数据
 * @param {number} total - 总数
 * @param {number} page - 当前页
 * @param {number} pageSize - 每页数量
 * @returns {Object} 分页响应
 */
export function paginatedResponse(data, total, page, pageSize) {
  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * 统一成功响应
 * @param {*} data - 响应数据
 * @param {string} message - 提示信息
 * @returns {Object} 响应对象
 */
export function successResponse(data = null, message = 'Success') {
  return {
    success: true,
    message,
    data
  };
}

/**
 * 统一错误响应
 * @param {string} message - 错误信息
 * @param {number} code - 错误码
 * @returns {Object} 响应对象
 */
export function errorResponse(message, code = 400) {
  return {
    success: false,
    message,
    code
  };
}

/**
 * 移除对象中的空值
 * @param {Object} obj - 对象
 * @returns {Object} 清理后的对象
 */
export function removeEmpty(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null && v !== '')
  );
}

/**
 * 深度克隆对象
 * @param {*} obj - 对象
 * @returns {*} 克隆后的对象
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 格式化日期时间
 * @param {Date|string} date - 日期
 * @param {string} format - 格式 ('date' | 'datetime' | 'time')
 * @returns {string} 格式化后的日期
 */
export function formatDate(date, format = 'datetime') {
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return '';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  switch (format) {
    case 'date':
      return `${year}-${month}-${day}`;
    case 'time':
      return `${hours}:${minutes}:${seconds}`;
    case 'datetime':
    default:
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

/**
 * 计算两个日期之间的差异
 * @param {Date} date1 - 日期1
 * @param {Date} date2 - 日期2
 * @param {string} unit - 单位 ('seconds' | 'minutes' | 'hours' | 'days')
 * @returns {number} 差异
 */
export function dateDiff(date1, date2, unit = 'days') {
  const diff = Math.abs(new Date(date1) - new Date(date2));

  const units = {
    seconds: 1000,
    minutes: 1000 * 60,
    hours: 1000 * 60 * 60,
    days: 1000 * 60 * 60 * 24
  };

  return Math.floor(diff / (units[unit] || units.days));
}
