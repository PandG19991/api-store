/**
 * 管理员认证路由
 * 处理登录、注册、密码管理等
 */

import adminService from '../../services/admin.service.js';
import { authenticate } from '../../middleware/auth.js';

/**
 * 注册管理员认证路由
 * @param {Object} fastify - Fastify 实例
 * @param {Object} options - 路由选项
 */
export default async function adminAuthRoutes(fastify, options) {
  /**
   * 管理员登录
   * POST /api/admin/auth/login
   */
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          password: { type: 'string', minLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const { username, password } = request.body;

    try {
      // 验证登录
      const admin = await adminService.validateLogin(username, password);

      // 生成 JWT token
      const token = fastify.jwt.sign({
        adminId: admin.id,
        username: admin.username,
        role: admin.role,
      });

      return {
        success: true,
        message: 'Login successful',
        data: {
          token,
          admin,
        },
      };
    } catch (error) {
      return reply.code(401).send({
        success: false,
        code: 'UNAUTHORIZED',
        message: error.message || 'Login failed',
      });
    }
  });

  /**
   * 注册管理员（仅超级管理员可用）
   * POST /api/admin/auth/register
   *
   * 注意：首次注册可通过数据库直接创建，或在 .env 中设置初始管理员
   */
  fastify.post('/register', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          password: { type: 'string', minLength: 6 },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['admin', 'super_admin'], default: 'admin' },
        },
      },
    },
  }, async (request, reply) => {
    // 检查当前管理员是否为超级管理员
    if (request.admin.role !== 'super_admin') {
      return reply.code(403).send({
        success: false,
        code: 'FORBIDDEN',
        message: 'Only super admin can create new admins',
      });
    }

    const { username, password, email, role } = request.body;

    try {
      const admin = await adminService.createAdmin({
        username,
        password,
        email,
        role,
      });

      return {
        success: true,
        message: 'Admin created successfully',
        data: { admin },
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        code: 'BAD_REQUEST',
        message: error.message || 'Failed to create admin',
      });
    }
  });

  /**
   * 获取当前登录的管理员信息
   * GET /api/admin/auth/me
   */
  fastify.get('/me', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return {
      success: true,
      data: {
        admin: request.admin,
      },
    };
  });

  /**
   * 更改密码
   * POST /api/admin/auth/change-password
   */
  fastify.post('/change-password', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['oldPassword', 'newPassword'],
        properties: {
          oldPassword: { type: 'string', minLength: 6 },
          newPassword: { type: 'string', minLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const { oldPassword, newPassword } = request.body;

    try {
      await adminService.changePassword(
        request.admin.id,
        oldPassword,
        newPassword
      );

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        code: 'BAD_REQUEST',
        message: error.message || 'Failed to change password',
      });
    }
  });

  /**
   * 刷新 Token
   * POST /api/admin/auth/refresh
   */
  fastify.post('/refresh', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    // 生成新的 token
    const token = fastify.jwt.sign({
      adminId: request.admin.id,
      username: request.admin.username,
      role: request.admin.role,
    });

    return {
      success: true,
      message: 'Token refreshed',
      data: { token },
    };
  });

  /**
   * 登出（客户端删除 token）
   * POST /api/admin/auth/logout
   */
  fastify.post('/logout', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    // JWT 是无状态的，登出逻辑主要由客户端处理
    // 这里可以添加黑名单机制（可选）

    return {
      success: true,
      message: 'Logged out successfully',
    };
  });
}
