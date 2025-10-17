/**
 * JWT 认证中间件
 * 验证管理员身份并检查权限
 */

import adminService from '../services/admin.service.js';

/**
 * 验证 JWT Token 并获取管理员信息
 * @param {Object} request - Fastify request
 * @param {Object} reply - Fastify reply
 */
export async function authenticate(request, reply) {
  try {
    // 验证 JWT token (Fastify JWT 插件自动解析)
    await request.jwtVerify();

    // Token 中应包含 adminId
    const { adminId } = request.user;

    if (!adminId) {
      return reply.code(401).send({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }

    // 从数据库获取完整的管理员信息
    const admin = await adminService.getAdminById(adminId);

    if (!admin) {
      return reply.code(401).send({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Admin not found',
      });
    }

    // 检查账号是否被禁用
    if (!admin.isActive) {
      return reply.code(403).send({
        success: false,
        code: 'FORBIDDEN',
        message: 'Account is disabled',
      });
    }

    // 将管理员信息附加到 request 对象
    request.admin = admin;
  } catch (error) {
    return reply.code(401).send({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * 管理员权限检查（admin 或 super_admin）
 * @param {Object} request - Fastify request
 * @param {Object} reply - Fastify reply
 */
export async function requireAdmin(request, reply) {
  // 先进行身份验证
  await authenticate(request, reply);

  // authenticate 中间件会将管理员信息附加到 request.admin
  // 所有通过 authenticate 的用户都已经是管理员
}

/**
 * 超级管理员权限检查
 * @param {Object} request - Fastify request
 * @param {Object} reply - Fastify reply
 */
export async function requireSuperAdmin(request, reply) {
  // 先执行普通认证
  await authenticate(request, reply);

  // 检查是否为超级管理员
  if (request.admin.role !== 'super_admin') {
    return reply.code(403).send({
      success: false,
      code: 'FORBIDDEN',
      message: 'Super admin access required',
    });
  }
}

/**
 * 可选的 JWT 认证（不强制要求登录）
 * @param {Object} request - Fastify request
 * @param {Object} reply - Fastify reply
 */
export async function optionalAuth(request, reply) {
  try {
    await request.jwtVerify();

    const { adminId } = request.user;

    if (adminId) {
      const admin = await adminService.getAdminById(adminId);

      if (admin && admin.isActive) {
        request.admin = admin;
      }
    }
  } catch (error) {
    // 不抛出错误，设置为 null 并继续执行
    request.admin = null;
  }
}
