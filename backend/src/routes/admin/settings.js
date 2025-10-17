/**
 * 管理后台系统设置路由
 * 提供系统配置的读取和更新功能
 */

import prisma from '../../config/database.js';
import { requireSuperAdmin } from '../../middleware/auth.js';

/**
 * 注册系统设置路由
 * @param {Object} fastify - Fastify 实例
 * @param {Object} options - 路由选项
 */
export default async function adminSettingsRoutes(fastify, options) {
  /**
   * 获取所有系统设置
   * GET /api/admin/settings
   */
  fastify.get('/', {
    preHandler: [requireSuperAdmin],
  }, async (request, reply) => {
    try {
      const settings = await prisma.systemSetting.findMany({
        orderBy: {
          key: 'asc',
        },
      });

      // 将设置转换为键值对对象
      const settingsMap = {};
      settings.forEach((setting) => {
        try {
          // 尝试解析JSON值
          settingsMap[setting.key] = setting.value ? JSON.parse(setting.value) : null;
        } catch (error) {
          // 如果不是JSON,直接使用字符串值
          settingsMap[setting.key] = setting.value;
        }
      });

      return {
        success: true,
        data: {
          settings: settingsMap,
          rawSettings: settings, // 包含描述等元数据
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch settings',
      });
    }
  });

  /**
   * 获取单个设置
   * GET /api/admin/settings/:key
   */
  fastify.get('/:key', {
    preHandler: [requireSuperAdmin],
    schema: {
      params: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { key } = request.params;

      const setting = await prisma.systemSetting.findUnique({
        where: { key },
      });

      if (!setting) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'Setting not found',
        });
      }

      // 尝试解析JSON值
      let value;
      try {
        value = setting.value ? JSON.parse(setting.value) : null;
      } catch (error) {
        value = setting.value;
      }

      return {
        success: true,
        data: {
          key: setting.key,
          value,
          description: setting.description,
          updatedAt: setting.updatedAt,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch setting',
      });
    }
  });

  /**
   * 更新或创建设置
   * PUT /api/admin/settings/:key
   */
  fastify.put('/:key', {
    preHandler: [requireSuperAdmin],
    schema: {
      params: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
      body: {
        type: 'object',
        required: ['value'],
        properties: {
          value: {}, // 可以是任何类型（字符串、对象、数组等）
          description: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { key } = request.params;
      const { value, description } = request.body;

      // 将值转换为JSON字符串
      const valueString = typeof value === 'string' ? value : JSON.stringify(value);

      // 使用 upsert 更新或创建设置
      const setting = await prisma.systemSetting.upsert({
        where: { key },
        update: {
          value: valueString,
          description: description || undefined,
        },
        create: {
          key,
          value: valueString,
          description: description || null,
        },
      });

      return {
        success: true,
        message: 'Setting updated successfully',
        data: {
          key: setting.key,
          value,
          description: setting.description,
          updatedAt: setting.updatedAt,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to update setting',
      });
    }
  });

  /**
   * 批量更新设置
   * POST /api/admin/settings/bulk-update
   */
  fastify.post('/bulk-update', {
    preHandler: [requireSuperAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['settings'],
        properties: {
          settings: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { settings } = request.body;

      // 批量更新设置
      const operations = Object.entries(settings).map(([key, value]) => {
        const valueString = typeof value === 'string' ? value : JSON.stringify(value);

        return prisma.systemSetting.upsert({
          where: { key },
          update: { value: valueString },
          create: {
            key,
            value: valueString,
            description: null,
          },
        });
      });

      await prisma.$transaction(operations);

      return {
        success: true,
        message: 'Settings updated successfully',
        data: {
          updatedCount: operations.length,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to bulk update settings',
      });
    }
  });

  /**
   * 删除设置
   * DELETE /api/admin/settings/:key
   */
  fastify.delete('/:key', {
    preHandler: [requireSuperAdmin],
    schema: {
      params: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { key } = request.params;

      // 检查设置是否存在
      const setting = await prisma.systemSetting.findUnique({
        where: { key },
      });

      if (!setting) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'Setting not found',
        });
      }

      // 删除设置
      await prisma.systemSetting.delete({
        where: { key },
      });

      return {
        success: true,
        message: 'Setting deleted successfully',
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete setting',
      });
    }
  });

  /**
   * 获取预定义的设置模板
   * GET /api/admin/settings/templates/default
   */
  fastify.get('/templates/default', {
    preHandler: [requireSuperAdmin],
  }, async (request, reply) => {
    // 返回系统预定义的设置模板
    const defaultSettings = {
      // 网站基本信息
      site_name: '虚拟产品销售平台',
      site_description: '提供各类软件许可证销售服务',
      site_keywords: '软件,许可证,密钥,正版',
      site_url: 'https://example.com',
      site_logo: '/logo.png',
      site_favicon: '/favicon.ico',

      // 联系信息
      contact_email: 'support@example.com',
      contact_phone: '',
      contact_address: '',

      // 支付配置
      payment_alipay_enabled: true,
      payment_wechat_enabled: true,

      // 邮件配置
      email_from_name: '虚拟产品销售平台',
      email_from_address: 'noreply@example.com',

      // 库存预警
      inventory_alert_enabled: true,
      inventory_alert_threshold: 10,
      inventory_check_interval: 3600, // 秒

      // 订单设置
      order_timeout_minutes: 30, // 订单超时时间
      order_auto_complete: true, // 支付后自动完成订单

      // 其他功能开关
      feature_order_lookup_enabled: true,
      feature_email_verification_enabled: true,

      // SEO设置
      seo_meta_title: '',
      seo_meta_description: '',
      seo_meta_keywords: '',

      // 社交媒体
      social_wechat: '',
      social_qq: '',
      social_telegram: '',
      social_email: 'support@example.com',
    };

    return {
      success: true,
      data: {
        defaultSettings,
        description: 'These are the default system settings template',
      },
    };
  });
}
