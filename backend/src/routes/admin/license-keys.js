/**
 * 管理后台密钥管理路由
 * 提供密钥的查看、批量导入、作废等功能
 */

import prisma from '../../config/database.js';
import { authenticate, requireSuperAdmin } from '../../middleware/auth.js';

/**
 * 注册密钥管理路由
 * @param {Object} fastify - Fastify 实例
 * @param {Object} options - 路由选项
 */
export default async function adminLicenseKeyRoutes(fastify, options) {
  /**
   * 获取密钥列表（分页、搜索、筛选）
   * GET /api/admin/license-keys
   */
  fastify.get('/', {
    preHandler: [authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          productId: { type: 'integer' },
          status: { type: 'string', enum: ['available', 'sold', 'revoked'] },
          search: { type: 'string' },
          sortBy: { type: 'string', enum: ['createdAt', 'soldAt'], default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const {
        page = 1,
        limit = 20,
        productId,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = request.query;
      const skip = (page - 1) * limit;

      // 构建查询条件
      const where = {};

      if (productId) {
        where.productId = productId;
      }

      if (status) {
        where.status = status;
      }

      if (search) {
        where.keyValueEncrypted = {
          contains: search,
          mode: 'insensitive',
        };
      }

      // 并行查询密钥列表和总数
      const [keys, total] = await Promise.all([
        prisma.licenseKey.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [sortBy]: sortOrder,
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            order: {
              select: {
                id: true,
                orderNo: true,
                customerEmail: true,
              },
            },
          },
        }),
        prisma.licenseKey.count({ where }),
      ]);

      return {
        success: true,
        data: {
          keys,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch license keys',
      });
    }
  });

  /**
   * 获取单个密钥详情
   * GET /api/admin/license-keys/:id
   */
  fastify.get('/:id', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      const key = await prisma.licenseKey.findUnique({
        where: { id },
        include: {
          product: true,
          order: {
            include: {
              items: true,
            },
          },
        },
      });

      if (!key) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'License key not found',
        });
      }

      return {
        success: true,
        data: { key },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch license key',
      });
    }
  });

  /**
   * 批量导入密钥
   * POST /api/admin/license-keys/bulk-import
   */
  fastify.post('/bulk-import', {
    preHandler: [requireSuperAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['productId', 'keys'],
        properties: {
          productId: { type: 'integer' },
          keys: {
            type: 'array',
            minItems: 1,
            maxItems: 1000, // 限制单次最多导入1000个密钥
            items: { type: 'string', minLength: 1 },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { productId, keys } = request.body;

      // 检查产品是否存在
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return reply.code(404).send({
          success: false,
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found',
        });
      }

      // 去重并过滤空字符串
      const uniqueKeys = [...new Set(keys.map((k) => k.trim()))].filter((k) => k.length > 0);

      if (uniqueKeys.length === 0) {
        return reply.code(400).send({
          success: false,
          code: 'NO_VALID_KEYS',
          message: 'No valid keys provided',
        });
      }

      // 检查是否有重复的密钥（与数据库中的密钥对比）
      const existingKeys = await prisma.licenseKey.findMany({
        where: {
          productId,
          keyValueEncrypted: {
            in: uniqueKeys,
          },
        },
        select: {
          keyValueEncrypted: true,
        },
      });

      const existingKeyValues = existingKeys.map((k) => k.keyValueEncrypted);
      const newKeys = uniqueKeys.filter((k) => !existingKeyValues.includes(k));

      if (newKeys.length === 0) {
        return reply.code(400).send({
          success: false,
          code: 'ALL_KEYS_EXIST',
          message: 'All keys already exist in the database',
          data: {
            duplicateCount: existingKeyValues.length,
          },
        });
      }

      // 批量创建密钥
      const result = await prisma.licenseKey.createMany({
        data: newKeys.map((keyValue) => ({
          keyValueEncrypted: keyValue,
          productId,
          status: 'available',
        })),
      });

      return {
        success: true,
        message: 'License keys imported successfully',
        data: {
          imported: result.count,
          duplicates: existingKeyValues.length,
          total: uniqueKeys.length,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to import license keys',
      });
    }
  });

  /**
   * 作废密钥
   * PATCH /api/admin/license-keys/:id/revoke
   */
  fastify.patch('/:id/revoke', {
    preHandler: [requireSuperAdmin],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer' },
        },
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { reason } = request.body;

      // 检查密钥是否存在
      const key = await prisma.licenseKey.findUnique({
        where: { id },
      });

      if (!key) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'License key not found',
        });
      }

      // 检查密钥是否已经被作废
      if (key.status === 'revoked') {
        return reply.code(400).send({
          success: false,
          code: 'ALREADY_REVOKED',
          message: 'License key is already revoked',
        });
      }

      // 更新密钥状态为 revoked
      const updated = await prisma.licenseKey.update({
        where: { id },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          revokeReason: reason || null,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'License key revoked successfully',
        data: { key: updated },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to revoke license key',
      });
    }
  });

  /**
   * 批量作废密钥
   * POST /api/admin/license-keys/bulk-revoke
   */
  fastify.post('/bulk-revoke', {
    preHandler: [requireSuperAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: {
            type: 'array',
            minItems: 1,
            maxItems: 100, // 限制单次最多作废100个密钥
            items: { type: 'integer' },
          },
          reason: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { ids, reason } = request.body;

      // 批量更新密钥状态
      const result = await prisma.licenseKey.updateMany({
        where: {
          id: {
            in: ids,
          },
          status: {
            not: 'revoked', // 只作废未被作废的密钥
          },
        },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          revokeReason: reason || null,
        },
      });

      return {
        success: true,
        message: 'License keys revoked successfully',
        data: {
          revokedCount: result.count,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to revoke license keys',
      });
    }
  });

  /**
   * 删除密钥（仅限未售出和未作废的密钥）
   * DELETE /api/admin/license-keys/:id
   */
  fastify.delete('/:id', {
    preHandler: [requireSuperAdmin],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      // 检查密钥是否存在
      const key = await prisma.licenseKey.findUnique({
        where: { id },
      });

      if (!key) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'License key not found',
        });
      }

      // 只能删除可用状态的密钥
      if (key.status !== 'available') {
        return reply.code(400).send({
          success: false,
          code: 'CANNOT_DELETE',
          message: `Cannot delete ${key.status} license key. Only available keys can be deleted.`,
        });
      }

      // 删除密钥
      await prisma.licenseKey.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'License key deleted successfully',
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete license key',
      });
    }
  });

  /**
   * 批量删除密钥
   * POST /api/admin/license-keys/bulk-delete
   */
  fastify.post('/bulk-delete', {
    preHandler: [requireSuperAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: { type: 'integer' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { ids } = request.body;

      // 只删除可用状态的密钥
      const result = await prisma.licenseKey.deleteMany({
        where: {
          id: {
            in: ids,
          },
          status: 'available',
        },
      });

      return {
        success: true,
        message: 'License keys deleted successfully',
        data: {
          deletedCount: result.count,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete license keys',
      });
    }
  });

  /**
   * 获取密钥统计信息（按产品）
   * GET /api/admin/license-keys/stats/by-product
   */
  fastify.get('/stats/by-product', {
    preHandler: [authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          productId: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { productId } = request.query;

      const where = productId ? { productId } : {};

      // 获取各状态的密钥统计
      const stats = await prisma.licenseKey.groupBy({
        by: ['productId', 'status'],
        where,
        _count: true,
        orderBy: {
          productId: 'asc',
        },
      });

      // 获取产品信息
      const productIds = [...new Set(stats.map((s) => s.productId))];
      const products = await prisma.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });

      const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

      // 重组数据
      const grouped = {};

      stats.forEach((stat) => {
        if (!grouped[stat.productId]) {
          grouped[stat.productId] = {
            product: productMap[stat.productId],
            total: 0,
            available: 0,
            sold: 0,
            revoked: 0,
          };
        }

        grouped[stat.productId][stat.status] = stat._count;
        grouped[stat.productId].total += stat._count;
      });

      const result = Object.values(grouped);

      return {
        success: true,
        data: {
          stats: result,
          total: result.length,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch license key statistics',
      });
    }
  });
}
