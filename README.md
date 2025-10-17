# AI虚拟产品全球销售平台

一个高度自动化、全球化的虚拟产品（软件激活密钥）在线销售平台。

---

## 📋 项目概述

本项目为虚拟产品销售提供了完整的解决方案，包括：

- **用户前端**: 简洁流畅的购买体验
- **管理后台**: 高效的产品、库存、订单管理
- **后端 API**: 安全稳定的业务逻辑处理
- **自动化系统**: 订单自动处理、邮件通知、库存预警

---

## 🎯 核心功能

### 用户功能
- ✅ 根据 IP 自动显示本地化价格和语言
- ✅ 一键式购买流程（仅需邮箱）
- ✅ 支持支付宝/微信支付
- ✅ 支付成功即时获取密钥
- ✅ 邮箱验证码查询历史订单

### 管理功能
- ✅ 产品管理（多语言描述、分区定价）
- ✅ 密钥批量导入与库存管理
- ✅ 订单查询与搜索
- ✅ 实时销售数据统计
- ✅ 库存预警（微信通知）
- ✅ 系统配置管理

### 自动化功能
- ✅ 支付成功自动分配密钥
- ✅ 自动发送订单确认邮件
- ✅ 库存低于阈值自动微信推送
- ✅ 完善的异常处理和重试机制

---

## 🛠️ 技术栈

### 前端
- **框架**: Next.js 14 (React)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **国际化**: next-i18next
- **部署**: Vercel (全球 CDN 加速)

### 后端
- **运行时**: Node.js 20+
- **框架**: Fastify 4.x
- **ORM**: Prisma
- **数据库**: PostgreSQL 15+
- **缓存**: Redis 7+
- **语言**: JavaScript (ES Modules)

### 第三方服务
- **支付**: 支付宝、微信支付
- **邮件**: SendGrid / Resend
- **IP 地理位置**: MaxMind GeoLite2
- **微信通知**: Server酱

---

## 📂 项目结构

```
project-root/
├── docs/                      # 📄 项目文档
│   ├── 00-技术架构文档.md
│   ├── 01-数据库设计文档.md
│   ├── 02-API接口文档.md
│   └── 03-前端组件设计文档.md
│
├── backend/                   # 🔧 后端 API 服务
│   ├── prisma/               # 数据库模型和迁移
│   ├── src/
│   │   ├── config/           # 配置文件
│   │   ├── routes/           # API 路由
│   │   ├── services/         # 业务逻辑
│   │   ├── middleware/       # 中间件
│   │   ├── utils/            # 工具函数
│   │   └── app.js            # 应用入口
│   └── package.json
│
├── frontend/                  # 🎨 用户前端
│   ├── components/
│   ├── pages/
│   ├── utils/
│   └── package.json
│
├── admin/                     # 🔐 管理后台
│   ├── components/
│   ├── pages/
│   └── package.json
│
├── prd.md                     # 产品需求文档
└── README.md                  # 本文件
```

---

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 20.0.0
- **PostgreSQL**: >= 15.0
- **Redis**: >= 7.0
- **npm/pnpm**: 最新版本

### 1. 克隆项目

```bash
cd D:\tools\密钥网站
```

### 2. 安装后端

```bash
cd backend
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写数据库等配置

# 初始化数据库
npm run db:migrate

# 启动开发服务器
npm run dev
```

后端服务将运行在 `http://localhost:3000`

### 3. 安装前端

```bash
cd ../frontend
npm install

# 配置环境变量
cp .env.example .env

# 启动开发服务器
npm run dev
```

前端将运行在 `http://localhost:3001`

### 4. 安装管理后台

```bash
cd ../admin
npm install

# 配置环境变量
cp .env.example .env

# 启动开发服务器
npm run dev
```

管理后台将运行在 `http://localhost:3002`

---

## 📖 文档

详细文档请查看 `docs/` 目录：

- [技术架构文档](./docs/00-技术架构文档.md) - 技术选型和架构设计
- [数据库设计文档](./docs/01-数据库设计文档.md) - 数据表结构和关系
- [API 接口文档](./docs/02-API接口文档.md) - 接口说明和示例
- [前端组件文档](./docs/03-前端组件设计文档.md) - 组件设计和使用

---

## 🔐 安全说明

### 密钥加密

所有激活密钥使用 **AES-256-GCM** 加密后存储在数据库中。

### 支付安全

- 所有支付回调必须验证签名
- 服务端验证订单金额
- 使用数据库事务确保一致性

### API 安全

- 管理后台使用 JWT 认证
- API 限流防止暴力攻击
- CORS 限制只允许前端域名

---

## 📦 部署

### 推荐部署方案

- **后端**: Railway / Heroku / AWS
- **前端**: Vercel (自动 CI/CD)
- **管理后台**: Vercel
- **数据库**: Supabase / Railway

详细部署说明请参考 `docs/04-部署运维文档.md`

---

## 🔄 开发进度

- [x] 技术选型与项目初始化
- [ ] 后端 API 开发
- [ ] 前端页面开发
- [ ] 管理后台开发
- [ ] 测试与优化
- [ ] 部署上线

---

## 📝 开发任务清单

详细任务清单见各子项目的 README：

- [后端任务清单](./backend/README.md)
- 前端任务清单 (待创建)
- 管理后台任务清单 (待创建)

---

## 🤝 贡献指南

本项目采用模块化开发，欢迎贡献！

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

## 📄 许可证

MIT License

---

## 📧 联系方式

如有问题，请查阅文档或提交 Issue。

---

**项目开始时间**: 2025-10-16
**当前版本**: v1.0.0-alpha
**状态**: 🚧 开发中
