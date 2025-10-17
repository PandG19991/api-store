# 虚拟产品销售平台 - 后端 API 服务

基于 **Fastify + Prisma + PostgreSQL** 构建的高性能虚拟产品销售后端服务。

---

## 📋 功能特性

- ✅ RESTful API 设计
- ✅ JWT 身份认证
- ✅ 支付宝/微信支付集成
- ✅ 自动化订单处理和密钥分发
- ✅ 邮件通知服务
- ✅ 库存预警 (微信推送)
- ✅ IP 地理位置识别
- ✅ 完善的错误处理和日志记录
- ✅ API 限流保护
- ✅ 数据加密存储

---

## 🛠️ 技术栈

- **Runtime:** Node.js 20+
- **Framework:** Fastify 4.x
- **ORM:** Prisma
- **Database:** PostgreSQL 15+
- **Cache:** Redis 7+
- **Language:** JavaScript (ES Modules)

---

## 📦 安装依赖

### 1. 克隆项目并安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

**必须配置的环境变量:**
- `DATABASE_URL`: PostgreSQL 数据库连接字符串
- `REDIS_URL`: Redis 连接字符串
- `JWT_SECRET`: JWT 密钥
- `ENCRYPTION_KEY`: 密钥加密密钥

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npm run db:generate

# 运行数据库迁移
npm run db:migrate

# (可选) 填充测试数据
npm run db:seed
```

---

## 🚀 运行项目

### 开发环境

```bash
npm run dev
```

服务将运行在 `http://localhost:3000`

### 生产环境

```bash
npm start
```

---

## 📁 项目结构

```
backend/
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   ├── migrations/            # 数据库迁移文件
│   └── seed.js                # 测试数据填充脚本
├── src/
│   ├── config/                # 配置文件
│   │   ├── database.js        # 数据库连接配置
│   │   ├── redis.js           # Redis 配置
│   │   └── env.js             # 环境变量加载
│   ├── routes/                # 路由
│   │   ├── public/            # 公开路由
│   │   │   ├── products.js    # 产品接口
│   │   │   ├── orders.js      # 订单接口
│   │   │   └── payments.js    # 支付回调
│   │   └── admin/             # 管理后台路由
│   │       ├── dashboard.js
│   │       ├── products.js
│   │       ├── licenses.js
│   │       ├── orders.js
│   │       └── settings.js
│   ├── services/              # 业务逻辑服务
│   │   ├── product.service.js
│   │   ├── order.service.js
│   │   ├── payment.service.js
│   │   ├── license.service.js
│   │   ├── email.service.js
│   │   ├── notification.service.js
│   │   ├── geo.service.js
│   │   └── auth.service.js
│   ├── middleware/            # 中间件
│   │   ├── auth.js            # JWT 认证
│   │   ├── errorHandler.js   # 统一错误处理
│   │   └── rateLimit.js       # 限流
│   ├── utils/                 # 工具函数
│   │   ├── encryption.js      # 加密/解密
│   │   ├── validation.js      # 数据验证
│   │   ├── logger.js          # 日志工具
│   │   └── helpers.js         # 其他辅助函数
│   └── app.js                 # 应用入口
├── .env.example               # 环境变量示例
├── .gitignore
├── package.json
└── README.md
```

---

## 🔌 API 接口文档

### 公开接口 (无需认证)

#### 产品相关

- `GET /api/products` - 获取产品列表
- `GET /api/products/:slug` - 获取产品详情
- `GET /api/products/:id/price` - 获取产品价格 (根据 IP)

#### 订单相关

- `POST /api/orders` - 创建订单
- `POST /api/orders/lookup/send-code` - 发送订单查询验证码
- `POST /api/orders/lookup` - 查询订单 (需要验证码)

#### 支付回调

- `POST /api/payments/alipay/notify` - 支付宝支付回调
- `POST /api/payments/wechat/notify` - 微信支付回调

---

### 管理后台接口 (需要 JWT 认证)

**认证方式:** 在请求头添加 `Authorization: Bearer <token>`

#### 认证

- `POST /api/admin/login` - 管理员登录

#### 仪表盘

- `GET /api/admin/dashboard/stats` - 获取统计数据

#### 产品管理

- `GET /api/admin/products` - 获取产品列表
- `POST /api/admin/products` - 创建产品
- `PUT /api/admin/products/:id` - 更新产品
- `DELETE /api/admin/products/:id` - 删除产品

#### 密钥管理

- `GET /api/admin/licenses` - 获取密钥列表
- `POST /api/admin/licenses/import` - 批量导入密钥
- `PUT /api/admin/licenses/:id/revoke` - 作废密钥
- `GET /api/admin/licenses/stats/:productId` - 获取库存统计

#### 订单管理

- `GET /api/admin/orders` - 获取订单列表 (支持搜索)
- `GET /api/admin/orders/:id` - 获取订单详情

#### 系统设置

- `GET /api/admin/settings` - 获取系统配置
- `PUT /api/admin/settings` - 更新系统配置

---

## 🔐 安全措施

### 1. 密钥加密存储

所有激活密钥使用 AES-256-GCM 加密后存储在数据库中：

```javascript
// 加密
const encrypted = encrypt(plainKey, process.env.ENCRYPTION_KEY);
// 解密
const decrypted = decrypt(encrypted, process.env.ENCRYPTION_KEY);
```

### 2. 支付安全

- 所有支付回调必须验证签名
- 服务端验证订单金额，防止篡改
- 使用数据库事务确保订单和库存一致性

### 3. 数据安全

- 管理员密码使用 bcrypt 哈希存储
- 敏感配置存储在环境变量中
- SQL 注入防护 (Prisma 参数化查询)
- XSS 防护 (Helmet 中间件)

### 4. API 安全

- JWT 认证保护管理后台
- Rate Limiting 防止暴力攻击
- CORS 限制只允许前端域名访问

---

## 🗄️ 数据库管理

### 查看数据库

```bash
npm run db:studio
```

这将打开 Prisma Studio，可视化管理数据库。

### 创建迁移

```bash
npx prisma migrate dev --name your_migration_name
```

### 重置数据库 (危险操作)

```bash
npx prisma migrate reset
```

---

## 📧 邮件模板

邮件模板位于 `src/templates/emails/`，支持中英文双语：

- `order-confirmation-zh.html` - 订单确认邮件 (中文)
- `order-confirmation-en.html` - 订单确认邮件 (英文)
- `verification-code.html` - 验证码邮件

---

## 🐛 调试

### 查看日志

应用使用 Pino 记录日志，开发环境会输出到控制台。

### 调试 SQL 查询

在 `.env` 中设置：

```bash
DEBUG=prisma:query
```

---

## 📝 开发规范

### 代码风格

- 使用 ES6+ 语法
- 使用 async/await 处理异步操作
- 统一错误处理 (使用 errorHandler 中间件)

### 提交规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
refactor: 重构
test: 测试
chore: 构建/工具变动
```

---

## 🚀 部署

### 使用 Railway / Heroku

1. 创建 PostgreSQL 和 Redis 实例
2. 配置环境变量
3. 运行数据库迁移: `npm run db:migrate`
4. 启动应用: `npm start`

### 使用 Docker

```bash
# 构建镜像
docker build -t license-store-backend .

# 运行容器
docker run -p 3000:3000 --env-file .env license-store-backend
```

---

## 📄 许可证

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**更多文档请查看:** `../docs/`
