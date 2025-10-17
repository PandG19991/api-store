# 邮件服务配置指南

本文档说明如何为虚拟产品销售平台配置邮件服务。

## 方案对比

| 方案 | 难度 | 成本 | 可靠性 | 适用场景 |
|------|------|------|--------|----------|
| MailPit | ⭐ | 免费 | 测试用 | 本地开发测试 |
| SMTP中继 + Gmail | ⭐⭐ | 免费/低 | ⭐⭐⭐ | 小规模生产 |
| SendGrid/Mailgun | ⭐⭐ | 按量付费 | ⭐⭐⭐⭐⭐ | 中大规模生产 |
| Postal自建 | ⭐⭐⭐⭐⭐ | 服务器成本 | ⭐⭐⭐⭐ | 大规模/完全掌控 |

---

## 方案1: MailPit (开发测试 - 推荐)

**优点**:
- 无需配置
- Web界面查看邮件
- 完全本地运行

**启动服务**:
```bash
cd "d:\tools\密钥网站"
docker-compose -p mailpit -f docker-compose.mailpit.yml up -d
```

**后端配置** (`.env`):
```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@license-store.com
EMAIL_FROM_NAME=虚拟产品商店
```

**查看邮件**: http://localhost:8025

---

## 方案2: SMTP中继 + Gmail (生产环境 - 简单)

### 步骤1: 获取Gmail应用专用密码

1. 登录 https://myaccount.google.com/
2. 启用两步验证
3. 访问 https://myaccount.google.com/apppasswords
4. 生成"应用专用密码"并保存

### 步骤2: 启动SMTP中继服务

编辑 `.env` 文件添加:
```env
SMTP_RELAY_USER=your-email@gmail.com
SMTP_RELAY_PASS=your-app-password
```

启动服务:
```bash
cd "d:\tools\密钥网站"
docker-compose -p smtp -f docker-compose.smtp.yml up -d
```

### 步骤3: 配置后端

修改 `backend/.env`:
```env
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=虚拟产品商店
```

**发送限制**: Gmail每天最多500封邮件

---

## 方案3: SendGrid (生产环境 - 推荐)

### 步骤1: 注册SendGrid

1. 访问 https://sendgrid.com
2. 注册账号 (免费版每天100封邮件)
3. 创建API Key

### 步骤2: 配置后端

修改 `backend/.env`:
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-api-key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=虚拟产品商店
```

**优点**:
- 专业可靠
- 详细统计
- 高送达率
- API支持

---

## 方案4: Postal自建服务器 (完全掌控)

### 注意事项

Postal是完整的邮件服务器,需要:
- 独立服务器/VPS
- 域名和DNS配置
- SPF/DKIM/DMARC设置
- 复杂的初始化过程

### 快速部署

```bash
cd "d:\tools\密钥网站"
docker-compose -p postal -f docker-compose.postal.yml up -d
```

### 初始化步骤

1. **数据库初始化**:
```bash
docker exec -it postal postal initialize
```

2. **创建管理员**:
```bash
docker exec -it postal postal make-user
```

3. **配置Web界面**: 访问 http://localhost:5000

4. **DNS记录设置**:
   - MX记录: mail.yourdomain.com
   - SPF记录: v=spf1 mx ~all
   - DKIM记录: 从Postal面板获取

### 后端配置

```env
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=smtp-username
SMTP_PASS=smtp-password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=虚拟产品商店
```

---

## 切换邮件服务

### 停止当前服务

```bash
# 停止MailPit
docker-compose -p mailpit -f docker-compose.mailpit.yml down

# 停止SMTP中继
docker-compose -p smtp -f docker-compose.smtp.yml down

# 停止Postal
docker-compose -p postal -f docker-compose.postal.yml down
```

### 重启后端服务

修改 `.env` 后需要重启后端:
```bash
# 停止当前后端进程 (Ctrl+C)

# 重新启动
cd backend
node src/app.js
```

---

## 测试邮件发送

### 方法1: 通过API测试

```bash
curl -X POST http://localhost:3001/api/orders/verification-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 方法2: 通过前端测试

1. 访问前端: http://localhost:3000
2. 进入"订单查询"页面
3. 输入邮箱并请求验证码
4. 检查邮件接收情况

---

## 常见问题

### Q: 邮件发送失败
**A**: 检查:
1. SMTP服务器是否运行: `docker ps`
2. 后端日志是否有错误
3. SMTP配置是否正确
4. 防火墙是否阻止SMTP端口

### Q: Gmail提示"不够安全的应用"
**A**: 使用"应用专用密码"而不是账号密码

### Q: 邮件进入垃圾箱
**A**:
1. 配置SPF/DKIM/DMARC
2. 使用真实域名
3. 使用专业邮件服务(SendGrid等)

### Q: 开发环境推荐哪个方案?
**A**: MailPit - 无需配置,可查看所有邮件

### Q: 生产环境推荐哪个方案?
**A**:
- 小规模: Gmail + SMTP中继
- 中大规模: SendGrid/Mailgun
- 完全掌控: Postal自建

---

## 配置文件位置

- **后端配置**: `backend/.env`
- **MailPit配置**: `docker-compose.mailpit.yml`
- **SMTP中继配置**: `docker-compose.smtp.yml`
- **Postal配置**: `docker-compose.postal.yml`
- **邮件模板**: `backend/src/services/email.service.js`

---

## 支持的邮件功能

✅ 验证码邮件 (订单查询)
✅ 订单确认邮件 (支付成功)
✅ 密钥发送
✅ 库存预警邮件 (管理员)
✅ 多语言支持 (中文/英文)
✅ HTML邮件模板
✅ 自动重试机制
