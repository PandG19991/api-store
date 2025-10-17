/**
 * 产品服务
 * 处理产品相关的业务逻辑
 */

import prisma from '../config/database.js';
import geoService from './geo.service.js';
import { NotFoundError } from '../middleware/errorHandler.js';

class ProductService {
  /**
   * 获取所有上架产品
   * @param {Object} options - 查询选项
   * @param {boolean} options.includeInactive - 是否包含下架产品
   * @returns {Promise<Array>} 产品列表
   */
  async getProducts({ includeInactive = false } = {}) {
    const where = includeInactive ? {} : { status: 'active' };

    const products = await prisma.product.findMany({
      where,
      include: {
        prices: true,
        _count: {
          select: {
            licenseKeys: {
              where: { status: 'available' }
            }
          }
        }
      },
      orderBy: {
        sortOrder: 'asc'
      }
    });

    return products.map(product => ({
      ...product,
      availableStock: product._count.licenseKeys
    }));
  }

  /**
   * 根据 ID 获取产品详情
   * @param {number} productId - 产品 ID
   * @returns {Promise<Object>} 产品详情
   */
  async getProductById(productId) {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: {
        prices: true,
        _count: {
          select: {
            licenseKeys: {
              where: { status: 'available' }
            }
          }
        }
      }
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return {
      ...product,
      availableStock: product._count.licenseKeys
    };
  }

  /**
   * 根据 slug 获取产品详情
   * @param {string} slug - 产品 slug
   * @returns {Promise<Object>} 产品详情
   */
  async getProductBySlug(slug) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        prices: true,
        _count: {
          select: {
            licenseKeys: {
              where: { status: 'available' }
            }
          }
        }
      }
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return {
      ...product,
      availableStock: product._count.licenseKeys
    };
  }

  /**
   * 获取产品的本地化价格
   * @param {number} productId - 产品 ID
   * @param {string} countryCode - 国家代码
   * @returns {Promise<Object>} 价格信息
   */
  async getProductPrice(productId, countryCode) {
    // 先尝试查找指定国家的价格
    let price = await prisma.price.findFirst({
      where: {
        productId: parseInt(productId),
        countryCode: countryCode
      }
    });

    // 如果没有找到，使用默认价格
    if (!price) {
      price = await prisma.price.findFirst({
        where: {
          productId: parseInt(productId),
          isDefault: true
        }
      });
    }

    // 如果还是没有，返回第一个价格
    if (!price) {
      price = await prisma.price.findFirst({
        where: {
          productId: parseInt(productId)
        }
      });
    }

    if (!price) {
      throw new NotFoundError('No price found for this product');
    }

    return price;
  }

  /**
   * 根据 IP 地址获取产品价格
   * @param {number} productId - 产品 ID
   * @param {string} ip - 用户 IP 地址
   * @returns {Promise<Object>} 价格信息
   */
  async getProductPriceByIP(productId, ip) {
    const countryCode = geoService.getCountryCode(ip);
    return this.getProductPrice(productId, countryCode);
  }

  /**
   * 获取产品的本地化信息
   * @param {Object} product - 产品对象
   * @param {string} lang - 语言代码 ('zh' | 'en')
   * @returns {Object} 本地化产品信息
   */
  getLocalizedProduct(product, lang = 'zh') {
    const description = lang === 'zh'
      ? product.descriptionZh
      : product.descriptionEn;

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: description || product.descriptionEn || product.descriptionZh,
      imageUrl: product.imageUrl,
      videoUrl: product.videoUrl,
      status: product.status,
      availableStock: product.availableStock,
    };
  }

  /**
   * 获取产品及其本地化价格
   * @param {number} productId - 产品 ID
   * @param {string} ip - 用户 IP
   * @param {string} lang - 语言代码
   * @returns {Promise<Object>} 完整的产品信息（含价格）
   */
  async getProductWithPrice(productId, ip, lang = 'zh') {
    const product = await this.getProductById(productId);
    const price = await this.getProductPriceByIP(productId, ip);
    const localizedProduct = this.getLocalizedProduct(product, lang);

    return {
      ...localizedProduct,
      price: {
        amount: parseFloat(price.amount),
        originalAmount: price.originalAmount ? parseFloat(price.originalAmount) : null,
        currency: price.currency,
        countryCode: price.countryCode,
      }
    };
  }

  /**
   * 检查产品是否有库存
   * @param {number} productId - 产品 ID
   * @returns {Promise<boolean>} 是否有库存
   */
  async hasStock(productId) {
    const count = await prisma.licenseKey.count({
      where: {
        productId: parseInt(productId),
        status: 'available'
      }
    });

    return count > 0;
  }

  /**
   * 获取产品库存数量
   * @param {number} productId - 产品 ID
   * @returns {Promise<number>} 库存数量
   */
  async getStockCount(productId) {
    return await prisma.licenseKey.count({
      where: {
        productId: parseInt(productId),
        status: 'available'
      }
    });
  }

  /**
   * 创建新产品
   * @param {Object} data - 产品数据
   * @returns {Promise<Object>} 创建的产品
   */
  async createProduct(data) {
    const { name, slug, descriptionZh, descriptionEn, imageUrl, videoUrl, prices = [] } = data;

    return await prisma.product.create({
      data: {
        name,
        slug,
        descriptionZh,
        descriptionEn,
        imageUrl,
        videoUrl,
        status: 'active',
        sortOrder: data.sortOrder || 0,
        prices: {
          create: prices
        }
      },
      include: {
        prices: true
      }
    });
  }

  /**
   * 更新产品信息
   * @param {number} productId - 产品 ID
   * @param {Object} data - 更新数据
   * @returns {Promise<Object>} 更新后的产品
   */
  async updateProduct(productId, data) {
    const { prices, ...productData } = data;

    return await prisma.product.update({
      where: { id: parseInt(productId) },
      data: productData,
      include: {
        prices: true
      }
    });
  }

  /**
   * 删除产品
   * @param {number} productId - 产品 ID
   * @returns {Promise<void>}
   */
  async deleteProduct(productId) {
    // 检查是否有已售出的订单
    const orderCount = await prisma.orderItem.count({
      where: { productId: parseInt(productId) }
    });

    if (orderCount > 0) {
      throw new Error('Cannot delete product with existing orders');
    }

    await prisma.product.delete({
      where: { id: parseInt(productId) }
    });
  }

  /**
   * 更新产品状态
   * @param {number} productId - 产品 ID
   * @param {string} status - 新状态
   * @returns {Promise<Object>} 更新后的产品
   */
  async updateProductStatus(productId, status) {
    return await prisma.product.update({
      where: { id: parseInt(productId) },
      data: { status }
    });
  }
}

export default new ProductService();
