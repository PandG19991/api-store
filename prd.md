# AI虚拟产品全球销售平台 - 定制开发项目说明与技术指导文档

**版本:** 1.0
**日期:** 2025年10月16日

---

## 1. 项目概述 (Project Overview)

### 1.1. 项目目标 (Project Goal)
构建一个高度自动化、可复用的全球化虚拟产品（软件激活密钥）在线销售平台。平台需提供极致简洁的用户购买体验，并为管理员提供高效的后台管理功能。

### 1.2. 核心用户画像 (User Persona)
- **终端用户:** 全球范围内的软件用户，希望通过简单、快速、安全的流程购买并立即获得激活密钥。
- **管理员 (您):** 平台所有者，希望轻松上架新产品、管理密钥库存、查看销售数据，并能高效处理客户支持请求。

### 1.3. 核心功能亮点 (Key Features)
- 一键式购买与支付流程
- 自动化密钥库存管理与分发
- 基于IP的地理化定价与多语言支持
- 安全的游客购买与自助式订单查询
- 自动化的微信库存预警系统

---

## 2. 功能需求规格 (Functional Requirements Specification - FRS)

这是您需要向AI详细描述“做什么”的部分。

### 2.1. 用户前端系统 (Frontend)

- **`F1` - 商品展示页 (Product Page):**
  - `F1.1`: 展示产品名称、主图/视频、价格。
  - `F1.2`: 根据用户IP，自动显示本地化货币及对应价格（例如，中国IP显示CNY，美国IP显示USD）。
  - `F1.3`: 显示多语言的产品详细描述（支持中/英文切换）。
  - `F1.4`: 包含一个醒目的“立即购买”按钮。

- **`F2` - 支付流程 (Checkout Process):**
  - `F2.1`: 点击“立即购买”后，弹出一个简洁的支付模态框或跳转到单页结算页面。
  - `F2.2`: 用户只需输入电子邮件地址。
  - `F2.3`: 加载并显示支付选项（支付宝/微信支付）。
  - `F2.4`: 支付成功后，在当前页面直接显示购买到的密钥，并附有“复制密钥”按钮。
  - `F2.5`: 明确提示用户，密钥和订单详情已发送至其邮箱。

- **`F3` - 订单查询页 (Order Lookup Page):**
  - `F3.1`: 提供一个输入框，让用户输入购买时使用的邮箱地址。
  - `F3.2`: 点击查询后，系统向该邮箱发送一个6位数字验证码。
  - `F3.3`: 页面出现验证码输入框。
  - `F3.4`: 用户输入正确的验证码后，页面展示该邮箱下的所有历史订单信息，包括产品名称和密钥。
  - `F3.5`: 提供“重新发送密钥到邮箱”的按钮。

### 2.2. 管理后台系统 (Admin Backend)

- **`A1` - 仪表盘 (Dashboard):**
  - `A1.1`: 显示关键指标：今日销售额、今日订单数、总销售额、待补充库存的产品列表。

- **`A2` - 产品管理 (Product Management):**
  - `A2.1`: 创建、编辑、删除产品。
  - `A2.2`: 为每个产品上传基本信息（名称、图片、多语言描述）。
  - `A2.3`: 为每个产品设置不同区域的价格（例如，`CN: 100 CNY`, `US: 20 USD`）。

- **`A3` - 密钥库存管理 (License Key Management):**
  - `A3.1`: 为指定产品批量上传密钥（支持TXT/CSV文件导入）。
  - `A3.2`: 查看每个产品的密钥总数、已售出数、剩余数。
  - `A3.3`: 查看每个密钥的状态（可用、已售出、所属订单号）。
  - `A3.4`: 可手动添加或作废单个密钥。

- **`A4` - 订单管理 (Order Management):**
  - `A4.1`: 查看所有订单列表。
  - `A4.2`: **通过用户邮箱、订单号进行精确搜索。**
  - `A4.3`: 查看订单详情：购买产品、支付金额、分配的密钥、用户邮箱、下单时间。

- **`A5` - 系统设置 (System Settings):**
  - `A5.1`: 配置支付接口信息（支付宝/微信支付的AppID, Secret Key等）。
  - `A5.2`: 设置库存预警阈值（例如：低于50个）。
  - `A5.3`: 配置微信通知的API接口信息（例如：ServerChan或PushPlus的Push Key）。

### 2.3. 自动化核心系统 (Core Automation System)

- **`C1` - 订单处理引擎:**
  - `C1.1`: 接收到支付成功的回调后，自动从库存中锁定一个“可用”密钥。
  - `C1.2`: 将密钥状态更新为“已售出”，并与该订单关联。
  - `C1.3`: 触发邮件发送服务。
  - `C1.4`: 检查当前产品剩余库存，若低于阈值，触发微信通知服务。

- **`C2` - 邮件服务 (Email Service):**
  - `C2.1`: 发送“订单成功与密钥分发”邮件（多语言模板）。
  - `C2.2`: 发送“订单查询验证码”邮件。

- **`C3` - 微信通知服务 (WeChat Notification Service):**
  - `C3.1`: 调用第三方推送服务的API，将预警信息（如“产品 [产品名] 库存仅剩 [数量]”）推送到您的微信。

---

## 3. 非功能性需求 (Non-Functional Requirements - NFR)

这部分定义了系统的质量标准，对AI提要求时非常重要。

- **`NFR1` - 安全性 (Security):**
  - 所有用户数据传输必须使用HTTPS。
  - 支付过程必须在服务端进行验证，防止客户端篡改价格。
  - 防止数据库注入、跨站脚本（XSS）等常见Web攻击。
  - 密钥在数据库中应加密存储。

- **`NFR2` - 性能 (Performance):**
  - 商品页全球平均加载时间应低于2秒。
  - API接口响应时间应低于200毫秒。

- **`NFR3` - 可靠性 (Reliability):**
  - 支付和密钥分发流程必须保证事务性，即付款成功必须保证分发密钥，若分发失败则需要有记录和重试机制。
  - 系统应能7x24小时不间断运行。

- **`NFR4` - 全球化 (Globalization):**
  - 系统应采用UTF-8编码。
  - 所有面向用户的文本都应支持i18n（国际化）方案，而不是硬编码在代码中。

---

## 4. 技术架构与选型指导 (Technical Architecture & Stack Selection Guidance)

您将让AI选择技术栈，以下是给AI的指导原则和建议选项。

- **架构模式: 推荐采用“前后端分离”的“无头（Headless）”架构。**
  - **前端 (Frontend):** 独立的单页应用 (SPA)，负责所有用户交互和视图渲染。
  - **后端 (Backend):** 以API形式提供所有业务逻辑和数据服务。
  - **优点:** 职责清晰，便于独立开发和部署，前端可以利用Vercel/Netlify等平台实现全球CDN加速，性能极佳。

- **技术栈建议选项 (让AI从中选择并组合):**
  - **前端框架:**
    - `Next.js` (React): 功能强大，支持SSR/SSG，SEO友好，生态成熟。
    - `Nuxt.js` (Vue): 类似于Next.js，但基于Vue生态。
    - `SvelteKit` (Svelte): 轻量、快速，编译时无虚拟DOM，性能优异。
  - **后端框架:**
    - `Node.js` + `Express/Fastify`: JavaScript全栈，开发效率高。
    - `Python` + `Django/FastAPI`: Python生态强大，FastAPI性能出色且自带API文档。
    - `Go` + `Gin`: 性能极高，并发能力强，适合构建高性能API。
  - **数据库:**
    - **强烈推荐 SQL 数据库**，因为业务涉及订单、产品、库存等强关联数据，需要事务保证数据一致性。
    - **PostgreSQL:** 功能最强大、最专业的开源SQL数据库。
    - **MySQL:** 使用广泛，生态成熟。
  - **部署方案 (Deployment):**
    - **前端:** `Vercel` (与Next.js完美集成), `Netlify`。
    - **后端+数据库:**
      - **一体化平台 (PaaS):** `Supabase`, `Railway`, `Heroku` (提供后端运行环境和数据库服务，简化运维)。
      - **云服务商 (IaaS):** `AWS`, `Google Cloud`, `Microsoft Azure` (更灵活，但配置更复杂)。
- **必要的第三方服务:**
  - **支付:** 支付宝开放平台、微信支付商户平台。
  - **邮件发送:** `Amazon SES`, `SendGrid`, `Mailgun`。
  - **IP地理位置:** `MaxMind GeoIP2`, `ip-api.com`。
  - **微信推送:** Server酱 (`ServerChan`), PushPlus推送加。

---

## 5. 数据库设计纲要 (Database Schema Outline)

这是核心数据结构，您可以让AI基于此进行细化。

```sql
-- 产品表
CREATE TABLE Products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description_zh TEXT,
    description_en TEXT,
    image_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 价格表
CREATE TABLE Prices (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES Products(id),
    country_code VARCHAR(2) NOT NULL, -- 如 'CN', 'US'
    currency VARCHAR(3) NOT NULL, -- 如 'CNY', 'USD'
    amount NUMERIC(10, 2) NOT NULL,
    UNIQUE(product_id, country_code)
);

-- 密钥表
CREATE TABLE LicenseKeys (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES Products(id),
    key_value_encrypted TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available', -- 'available', 'sold'
    order_id INTEGER, -- 售出后关联订单ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sold_at TIMESTAMP WITH TIME ZONE
);

-- 订单表
CREATE TABLE Orders (
    id SERIAL PRIMARY KEY,
    customer_email VARCHAR(255) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    payment_gateway_txn_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 订单项表 (为未来一单多品做准备)
CREATE TABLE OrderItems (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES Orders(id),
    product_id INTEGER REFERENCES Products(id),
    price_id INTEGER REFERENCES Prices(id)
);

-- 为LicenseKeys表的order_id添加外键约束
ALTER TABLE LicenseKeys ADD CONSTRAINT fk_order_id FOREIGN KEY (order_id) REFERENCES Orders(id);

