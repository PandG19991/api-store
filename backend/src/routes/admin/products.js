/**
 * 管理后台产品管理路由
 * 提供产品的增删改查功能
 */

import prisma from '../../config/database.js';
import { authenticate, requireSuperAdmin } from '../../middleware/auth.js';

/**
 * 注册产品管理路由
 * @param {Object} fastify - Fastify 实例
 * @param {Object} options - 路由选项
 */
export default async function adminProductRoutes(fastify, options) {
  /**
   * 获取产品列表（分页、搜索、筛选）
   * GET /api/admin/products
   */
  fastify.get('/', {
    preHandler: [authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
          isActive: { type: 'boolean' },
          sortBy: { type: 'string', enum: ['name', 'createdAt', 'updatedAt'], default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { page = 1, limit = 20, search, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = request.query;
      const skip = (page - 1) * limit;

      // 构建查询条件
      const where = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // 并行查询产品列表和总数
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [sortBy]: sortOrder,
          },
          include: {
            prices: {
              orderBy: {
                createdAt: 'asc',
              },
            },
            _count: {
              select: {
                licenseKeys: {
                  where: {
                    status: 'available',
                  },
                },
              },
            },
          },
        }),
        prisma.product.count({ where }),
      ]);

      // 添加可用库存数量
      const productsWithStock = products.map((product) => ({
        ...product,
        availableStock: product._count.licenseKeys,
        _count: undefined, // 移除 _count 字段
      }));

      return {
        success: true,
        data: {
          products: productsWithStock,
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
        message: 'Failed to fetch products',
      });
    }
  });

  /**
   * 获取单个产品详情
   * GET /api/admin/products/:id
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

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          prices: {
            orderBy: {
              createdAt: 'asc',
            },
          },
          _count: {
            select: {
              licenseKeys: true,
            },
          },
        },
      });

      if (!product) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'Product not found',
        });
      }

      // 获取各状态库存统计
      const stockStats = await prisma.licenseKey.groupBy({
        by: ['status'],
        where: {
          productId: id,
        },
        _count: true,
      });

      const inventory = {
        total: product._count.licenseKeys,
        available: 0,
        sold: 0,
        revoked: 0,
      };

      stockStats.forEach((stat) => {
        inventory[stat.status] = stat._count;
      });

      return {
        success: true,
        data: {
          product: {
            ...product,
            _count: undefined,
          },
          inventory,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch product',
      });
    }
  });

  /**
   * 创建新产品
   * POST /api/admin/products
   */
  fastify.post('/', {
    preHandler: [requireSuperAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'slug', 'prices'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          slug: { type: 'string', pattern: '^[a-z0-9-]+$', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          isActive: { type: 'boolean', default: true },
          prices: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['region', 'currency', 'amount'],
              properties: {
                region: { type: 'string', minLength: 2, maxLength: 10 },
                currency: { type: 'string', minLength: 3, maxLength: 3 },
                amount: { type: 'number', minimum: 0 },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { name, slug, description, features, isActive = true, prices } = request.body;

      // 检查 slug 是否已存在
      const existing = await prisma.product.findUnique({
        where: { slug },
      });

      if (existing) {
        return reply.code(400).send({
          success: false,
          code: 'SLUG_EXISTS',
          message: 'Product with this slug already exists',
        });
      }

      // 创建产品和价格（使用事务）
      const product = await prisma.product.create({
        data: {
          name,
          slug,
          description,
          features: features || [],
          isActive,
          prices: {
            create: prices,
          },
        },
        include: {
          prices: true,
        },
      });

      return {
        success: true,
        message: 'Product created successfully',
        data: { product },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to create product',
      });
    }
  });

  /**
   * 更新产品信息
   * PUT /api/admin/products/:id
   */
  fastify.put('/:id', {
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
          name: { type: 'string', minLength: 1, maxLength: 255 },
          slug: { type: 'string', pattern: '^[a-z0-9-]+$', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          isActive: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const updates = request.body;

      // 检查产品是否存在
      const existing = await prisma.product.findUnique({
        where: { id },
      });

      if (!existing) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'Product not found',
        });
      }

      // 如果更新 slug，检查是否与其他产品冲突
      if (updates.slug && updates.slug !== existing.slug) {
        const slugExists = await prisma.product.findUnique({
          where: { slug: updates.slug },
        });

        if (slugExists) {
          return reply.code(400).send({
            success: false,
            code: 'SLUG_EXISTS',
            message: 'Product with this slug already exists',
          });
        }
      }

      // 更新产品
      const product = await prisma.product.update({
        where: { id },
        data: updates,
        include: {
          prices: true,
        },
      });

      return {
        success: true,
        message: 'Product updated successfully',
        data: { product },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to update product',
      });
    }
  });

  /**
   * 删除产品
   * DELETE /api/admin/products/:id
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

      // 检查产品是否存在
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              licenseKeys: true,
              orderItems: true,
            },
          },
        },
      });

      if (!product) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'Product not found',
        });
      }

      // 检查是否有关联数据
      if (product._count.licenseKeys > 0 || product._count.orderItems > 0) {
        return reply.code(400).send({
          success: false,
          code: 'CANNOT_DELETE',
          message: 'Cannot delete product with existing license keys or orders. Consider deactivating instead.',
        });
      }

      // 删除产品（级联删除价格）
      await prisma.product.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Product deleted successfully',
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete product',
      });
    }
  });

  /**
   * 更新产品价格
   * PUT /api/admin/products/:id/prices
   */
  fastify.put('/:id/prices', {
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
        required: ['prices'],
        properties: {
          prices: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['region', 'currency', 'amount'],
              properties: {
                region: { type: 'string', minLength: 2, maxLength: 10 },
                currency: { type: 'string', minLength: 3, maxLength: 3 },
                amount: { type: 'number', minimum: 0 },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { prices } = request.body;

      // 检查产品是否存在
      const product = await prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'Product not found',
        });
      }

      // 使用事务：先删除旧价格，再创建新价格
      await prisma.$transaction([
        prisma.price.deleteMany({
          where: { productId: id },
        }),
        prisma.price.createMany({
          data: prices.map((price) => ({
            ...price,
            productId: id,
          })),
        }),
      ]);

      // 获取更新后的产品
      const updatedProduct = await prisma.product.findUnique({
        where: { id },
        include: {
          prices: true,
        },
      });

      return {
        success: true,
        message: 'Prices updated successfully',
        data: { product: updatedProduct },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to update prices',
      });
    }
  });

  /**
   * 切换产品启用/禁用状态
   * PATCH /api/admin/products/:id/toggle-active
   */
  fastify.patch('/:id/toggle-active', {
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

      const product = await prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        return reply.code(404).send({
          success: false,
          code: 'NOT_FOUND',
          message: 'Product not found',
        });
      }

      const updated = await prisma.product.update({
        where: { id },
        data: {
          isActive: !product.isActive,
        },
      });

      return {
        success: true,
        message: `Product ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
        data: { product: updated },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to toggle product status',
      });
    }
  });
}
