/**
 * 产品公开 API 路由
 * 无需认证即可访问
 */

import productService from '../../services/product.service.js';
import { getClientIP } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

/**
 * 注册产品路由
 * @param {FastifyInstance} fastify - Fastify 实例
 */
export default async function productRoutes(fastify) {
  /**
   * GET /api/products
   * 获取所有上架产品列表
   */
  fastify.get('/', asyncHandler(async (request, reply) => {
    const { lang = 'zh' } = request.query;
    const clientIP = getClientIP(request);

    // 获取所有产品
    const products = await productService.getProducts();

    // 为每个产品附加本地化信息
    const localizedProducts = await Promise.all(
      products.map(async (product) => {
        try {
          const price = await productService.getProductPriceByIP(product.id, clientIP);
          const localized = productService.getLocalizedProduct(product, lang);

          return {
            ...localized,
            price: {
              amount: parseFloat(price.amount),
              originalAmount: price.originalAmount ? parseFloat(price.originalAmount) : null,
              currency: price.currency,
              countryCode: price.countryCode,
            }
          };
        } catch (error) {
          // 如果获取价格失败，返回不含价格的产品
          return productService.getLocalizedProduct(product, lang);
        }
      })
    );

    return {
      success: true,
      data: {
        products: localizedProducts,
        total: localizedProducts.length
      }
    };
  }));

  /**
   * GET /api/products/:identifier
   * 根据 ID 或 slug 获取产品详情
   */
  fastify.get('/:identifier', asyncHandler(async (request, reply) => {
    const { identifier } = request.params;
    const { lang = 'zh' } = request.query;
    const clientIP = getClientIP(request);

    // 判断是 ID 还是 slug
    const isNumeric = /^\d+$/.test(identifier);
    let product;

    if (isNumeric) {
      product = await productService.getProductById(parseInt(identifier));
    } else {
      product = await productService.getProductBySlug(identifier);
    }

    // 获取价格
    const price = await productService.getProductPriceByIP(product.id, clientIP);

    // 本地化
    const localizedProduct = productService.getLocalizedProduct(product, lang);

    return {
      success: true,
      data: {
        ...localizedProduct,
        price: {
          amount: parseFloat(price.amount),
          originalAmount: price.originalAmount ? parseFloat(price.originalAmount) : null,
          currency: price.currency,
          countryCode: price.countryCode,
        },
        prices: product.prices.map(p => ({
          countryCode: p.countryCode,
          currency: p.currency,
          amount: parseFloat(p.amount),
          originalAmount: p.originalAmount ? parseFloat(p.originalAmount) : null,
        }))
      }
    };
  }));

  /**
   * GET /api/products/:id/price
   * 获取指定产品的价格（根据客户端 IP）
   */
  fastify.get('/:id/price', asyncHandler(async (request, reply) => {
    const { id } = request.params;
    const { countryCode } = request.query;
    const clientIP = getClientIP(request);

    let price;

    if (countryCode) {
      // 如果指定了国家代码，使用指定的国家
      price = await productService.getProductPrice(parseInt(id), countryCode);
    } else {
      // 否则根据 IP 自动识别
      price = await productService.getProductPriceByIP(parseInt(id), clientIP);
    }

    return {
      success: true,
      data: {
        productId: parseInt(id),
        amount: parseFloat(price.amount),
        originalAmount: price.originalAmount ? parseFloat(price.originalAmount) : null,
        currency: price.currency,
        countryCode: price.countryCode,
        hasDiscount: price.originalAmount && parseFloat(price.originalAmount) > parseFloat(price.amount)
      }
    };
  }));

  /**
   * GET /api/products/:id/stock
   * 检查产品库存
   */
  fastify.get('/:id/stock', asyncHandler(async (request, reply) => {
    const { id } = request.params;

    const hasStock = await productService.hasStock(parseInt(id));
    const stockCount = await productService.getStockCount(parseInt(id));

    return {
      success: true,
      data: {
        productId: parseInt(id),
        hasStock,
        // 出于安全考虑，不显示准确库存，只显示是否有货
        // 如果需要显示准确数量，取消下面的注释
        // stockCount,
        status: hasStock ? 'in_stock' : 'out_of_stock'
      }
    };
  }));
}
