/**
 * 数据库配置模块
 * 初始化并导出 Prisma Client 实例
 */

import { PrismaClient } from '@prisma/client';

// 创建 Prisma Client 实例
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'],
  errorFormat: 'pretty',
});

export default prisma;
