/**
 * 数据库种子数据
 * 用于初始化测试数据
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * 生成随机密钥
 */
function generateKey(prefix = 'KEY') {
  return `${prefix}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

/**
 * 主函数
 */
async function main() {
  console.log('🌱 开始填充种子数据...\n');

  // 1. 创建管理员用户
  console.log('👤 创建管理员用户...');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: hashedPassword, // 密码: admin123
      email: 'admin@license-store.com',
      role: 'super_admin',
      isActive: true
    }
  });
  console.log(`   ✓ 管理员创建成功: ${admin.username} (密码: admin123)\n`);

  // 2. 创建产品
  console.log('📦 创建产品...');

  const products = [
    {
      name: 'Windows 11 Pro',
      slug: 'windows-11-pro',
      descriptionZh: 'Windows 11 专业版激活密钥，支持永久激活',
      descriptionEn: 'Windows 11 Professional activation key, supports permanent activation',
      imageUrl: 'https://images.unsplash.com/photo-1633419461186-7d40a38105ec?w=800',
      videoUrl: null,
      status: 'active',
      sortOrder: 1,
      prices: [
        {
          countryCode: 'CN',
          currency: 'CNY',
          amount: 299,
          originalAmount: 399,
          isDefault: true
        },
        {
          countryCode: 'US',
          currency: 'USD',
          amount: 39,
          originalAmount: 59,
          isDefault: false
        },
        {
          countryCode: 'EU',
          currency: 'EUR',
          amount: 35,
          originalAmount: 55,
          isDefault: false
        }
      ]
    },
    {
      name: 'Microsoft Office 2021',
      slug: 'office-2021',
      descriptionZh: 'Office 2021 专业增强版，包含 Word、Excel、PowerPoint 等全套办公软件',
      descriptionEn: 'Office 2021 Professional Plus, includes Word, Excel, PowerPoint and all office applications',
      imageUrl: 'https://images.unsplash.com/photo-1633419461186-7d40a38105ec?w=800',
      videoUrl: null,
      status: 'active',
      sortOrder: 2,
      prices: [
        {
          countryCode: 'CN',
          currency: 'CNY',
          amount: 199,
          originalAmount: 299,
          isDefault: true
        },
        {
          countryCode: 'US',
          currency: 'USD',
          amount: 29,
          originalAmount: 49,
          isDefault: false
        },
        {
          countryCode: 'EU',
          currency: 'EUR',
          amount: 25,
          originalAmount: 45,
          isDefault: false
        }
      ]
    },
    {
      name: 'Adobe Creative Cloud',
      slug: 'adobe-cc',
      descriptionZh: 'Adobe Creative Cloud 全家桶订阅，包含 Photoshop、Illustrator、Premiere Pro 等',
      descriptionEn: 'Adobe Creative Cloud subscription, includes Photoshop, Illustrator, Premiere Pro and more',
      imageUrl: 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=800',
      videoUrl: null,
      status: 'active',
      sortOrder: 3,
      prices: [
        {
          countryCode: 'CN',
          currency: 'CNY',
          amount: 399,
          originalAmount: 599,
          isDefault: true
        },
        {
          countryCode: 'US',
          currency: 'USD',
          amount: 59,
          originalAmount: 89,
          isDefault: false
        },
        {
          countryCode: 'EU',
          currency: 'EUR',
          amount: 55,
          originalAmount: 85,
          isDefault: false
        }
      ]
    },
    {
      name: 'Visual Studio Professional',
      slug: 'visual-studio-pro',
      descriptionZh: 'Visual Studio Professional 专业版开发工具',
      descriptionEn: 'Visual Studio Professional development tool',
      imageUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800',
      videoUrl: null,
      status: 'active',
      sortOrder: 4,
      prices: [
        {
          countryCode: 'CN',
          currency: 'CNY',
          amount: 599,
          originalAmount: 899,
          isDefault: true
        },
        {
          countryCode: 'US',
          currency: 'USD',
          amount: 89,
          originalAmount: 129,
          isDefault: false
        },
        {
          countryCode: 'EU',
          currency: 'EUR',
          amount: 85,
          originalAmount: 125,
          isDefault: false
        }
      ]
    },
    {
      name: 'AutoCAD 2024',
      slug: 'autocad-2024',
      descriptionZh: 'AutoCAD 2024 专业版 CAD 设计软件',
      descriptionEn: 'AutoCAD 2024 Professional CAD design software',
      imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800',
      videoUrl: null,
      status: 'active',
      sortOrder: 5,
      prices: [
        {
          countryCode: 'CN',
          currency: 'CNY',
          amount: 799,
          originalAmount: 1199,
          isDefault: true
        },
        {
          countryCode: 'US',
          currency: 'USD',
          amount: 119,
          originalAmount: 179,
          isDefault: false
        },
        {
          countryCode: 'EU',
          currency: 'EUR',
          amount: 115,
          originalAmount: 175,
          isDefault: false
        }
      ]
    }
  ];

  const createdProducts = [];

  for (const productData of products) {
    const { prices, ...product } = productData;
    const created = await prisma.product.upsert({
      where: { slug: product.slug },
      update: product,
      create: {
        ...product,
        prices: {
          create: prices
        }
      },
      include: {
        prices: true
      }
    });
    createdProducts.push(created);
    console.log(`   ✓ ${created.name}`);
  }
  console.log(`\n   共创建 ${createdProducts.length} 个产品\n`);

  // 3. 为每个产品创建密钥
  console.log('🔑 创建密钥...');
  let totalKeys = 0;

  for (const product of createdProducts) {
    const keyCount = 100; // 每个产品100个密钥
    const keys = [];

    for (let i = 0; i < keyCount; i++) {
      keys.push({
        productId: product.id,
        keyValueEncrypted: generateKey(product.slug.toUpperCase().slice(0, 6)),
        status: 'available'
      });
    }

    await prisma.licenseKey.createMany({
      data: keys,
      skipDuplicates: true
    });

    totalKeys += keyCount;
    console.log(`   ✓ ${product.name}: ${keyCount} 个密钥`);
  }
  console.log(`\n   共创建 ${totalKeys} 个密钥\n`);

  // 4. 创建测试订单
  console.log('📋 创建测试订单...');

  // 获取第一个可用密钥
  const firstAvailableKey = await prisma.licenseKey.findFirst({
    where: { productId: createdProducts[0].id, status: 'available' }
  });

  // 已完成订单
  const order1 = await prisma.order.create({
    data: {
      orderNo: `ORD${Date.now()}1`,
      customerEmail: 'customer1@example.com',
      totalAmount: 299,
      currency: 'CNY',
      status: 'completed',
      paymentMethod: 'alipay',
      paidAt: new Date(),
      completedAt: new Date(),
      orderItems: {
        create: [
          {
            productId: createdProducts[0].id,
            productName: createdProducts[0].name,
            priceId: createdProducts[0].prices[0].id,
            quantity: 1,
            unitPrice: 299,
            subtotal: 299,
            licenseKeyId: firstAvailableKey?.id
          }
        ]
      }
    }
  });

  // 更新已使用的密钥状态
  if (firstAvailableKey) {
    await prisma.licenseKey.update({
      where: { id: firstAvailableKey.id },
      data: {
        status: 'sold',
        orderId: order1.id,
        soldAt: new Date()
      }
    });
  }

  console.log(`   ✓ 订单 ${order1.orderNo} (已完成)`);

  // 待支付订单
  const order2 = await prisma.order.create({
    data: {
      orderNo: `ORD${Date.now()}2`,
      customerEmail: 'customer2@example.com',
      totalAmount: 199,
      currency: 'CNY',
      status: 'pending',
      paymentMethod: 'wechat',
      orderItems: {
        create: [
          {
            productId: createdProducts[1].id,
            productName: createdProducts[1].name,
            priceId: createdProducts[1].prices[0].id,
            quantity: 1,
            unitPrice: 199,
            subtotal: 199
          }
        ]
      }
    }
  });

  console.log(`   ✓ 订单 ${order2.orderNo} (待支付)`);
  console.log('\n   共创建 2 个测试订单\n');

  // 5. 创建系统设置
  console.log('⚙️  创建系统设置...');
  const settings = [
    {
      key: 'site_name',
      value: '虚拟产品商店',
      description: '网站名称'
    },
    {
      key: 'site_description',
      value: '专业的虚拟产品销售平台',
      description: '网站描述'
    },
    {
      key: 'stock_alert_threshold',
      value: '50',
      description: '库存预警阈值'
    },
    {
      key: 'stock_alert_enabled',
      value: 'true',
      description: '是否启用库存预警'
    },
    {
      key: 'email_notifications_enabled',
      value: 'true',
      description: '是否启用邮件通知'
    }
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: setting,
      create: setting
    });
    console.log(`   ✓ ${setting.key}`);
  }
  console.log(`\n   共创建 ${settings.length} 个系统设置\n`);

  console.log('✅ 种子数据填充完成!\n');
  console.log('📊 数据统计:');
  console.log(`   - 管理员: 1`);
  console.log(`   - 产品: ${createdProducts.length}`);
  console.log(`   - 密钥: ${totalKeys}`);
  console.log(`   - 订单: 2`);
  console.log(`   - 系统设置: ${settings.length}`);
  console.log('');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ 种子数据填充失败:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
