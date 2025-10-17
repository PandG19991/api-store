# 虚拟产品销售平台 - 全局测试计划

## 测试概览

**测试目标**: 验证系统所有功能正常运行，包括前端、后端、支付、邮件等模块

**测试环境**:
- 后端服务: http://localhost:3001
- 前端服务: http://localhost:3000
- 管理后台: http://localhost:3002 (如已部署)
- MailPit Web UI: http://localhost:8025
- 数据库: PostgreSQL (localhost:5432)
- Redis: localhost:6379

---

## 1. 后端API测试

### 1.1 产品相关API

#### GET /api/products - 获取产品列表
**测试用例**:
```bash
curl http://localhost:3001/api/products
```
**预期结果**:
- 状态码: 200
- 返回产品列表数组
- 每个产品包含: id, name, description, category, isActive等字段

#### GET /api/products/:id - 获取产品详情
**测试用例**:
```bash
curl http://localhost:3001/api/products/1
```
**预期结果**:
- 状态码: 200
- 返回产品详细信息
- 包含价格列表(prices)
- 包含库存信息(availableKeys)

#### POST /api/products/:id/price - 计算价格
**测试用例**:
```bash
curl -X POST http://localhost:3001/api/products/1/price \
  -H "Content-Type: application/json" \
  -d '{"quantity": 1}'
```
**预期结果**:
- 状态码: 200
- 返回计算后的价格信息
- 根据用户IP匹配区域定价

### 1.2 订单相关API

#### POST /api/orders - 创建订单
**测试用例**:
```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "items": [
      {
        "productId": 1,
        "priceId": 1,
        "quantity": 1
      }
    ],
    "paymentMethod": "alipay"
  }'
```
**预期结果**:
- 状态码: 201
- 返回订单ID
- 返回支付URL
- 订单状态为 PENDING

#### GET /api/orders/:id - 获取订单详情
**测试用例**:
```bash
curl http://localhost:3001/api/orders/{订单ID}
```
**预期结果**:
- 状态码: 200
- 返回订单详细信息
- 包含订单项(items)
- 包含支付状态

#### POST /api/orders/verification-code - 发送验证码
**测试用例**:
```bash
curl -X POST http://localhost:3001/api/orders/verification-code \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```
**预期结果**:
- 状态码: 200
- 返回成功消息
- 邮箱收到验证码邮件(MailPit查看)

#### POST /api/orders/verify - 验证码验证
**测试用例**:
```bash
curl -X POST http://localhost:3001/api/orders/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "code": "123456"}'
```
**预期结果**:
- 状态码: 200
- 返回验证token
- token可用于查询订单

#### GET /api/orders/by-email?token={token} - 查询邮箱订单
**测试用例**:
```bash
curl "http://localhost:3001/api/orders/by-email?token={验证token}"
```
**预期结果**:
- 状态码: 200
- 返回该邮箱的所有订单

### 1.3 管理后台API

#### POST /api/admin/auth/login - 管理员登录
**测试用例**:
```bash
curl -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```
**预期结果**:
- 状态码: 200
- 返回JWT token
- 返回管理员信息

#### GET /api/admin/dashboard/stats - 仪表盘统计
**测试用例**:
```bash
curl http://localhost:3001/api/admin/dashboard/stats \
  -H "Authorization: Bearer {token}"
```
**预期结果**:
- 状态码: 200
- 返回统计数据: 总订单、总收入、总产品、总密钥等

#### GET /api/admin/products - 获取产品列表(管理)
**测试用例**:
```bash
curl http://localhost:3001/api/admin/products \
  -H "Authorization: Bearer {token}"
```
**预期结果**:
- 状态码: 200
- 返回所有产品(包括未激活)

#### POST /api/admin/products - 创建产品
**测试用例**:
```bash
curl -X POST http://localhost:3001/api/admin/products \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试产品",
    "description": "测试描述",
    "category": "software",
    "isActive": true
  }'
```
**预期结果**:
- 状态码: 201
- 返回新创建的产品信息

#### POST /api/admin/license-keys/import - 批量导入密钥
**测试用例**:
```bash
curl -X POST http://localhost:3001/api/admin/license-keys/import \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "keys": ["KEY001", "KEY002", "KEY003"]
  }'
```
**预期结果**:
- 状态码: 201
- 返回导入成功的数量

#### GET /api/admin/orders - 获取订单列表(管理)
**测试用例**:
```bash
curl "http://localhost:3001/api/admin/orders?page=1&limit=20" \
  -H "Authorization: Bearer {token}"
```
**预期结果**:
- 状态码: 200
- 返回订单列表
- 支持分页

---

## 2. 邮件服务测试

### 2.1 验证码邮件

**测试步骤**:
1. 调用 POST /api/orders/verification-code
2. 访问 MailPit Web UI: http://localhost:8025
3. 检查是否收到验证码邮件

**预期结果**:
- 邮件主题: "订单查询验证码"
- 邮件内容包含6位数字验证码
- 邮件格式为HTML
- 发件人: noreply@license-store.com

### 2.2 订单确认邮件

**测试步骤**:
1. 创建订单
2. 模拟支付回调(标记订单为已支付)
3. 检查MailPit是否收到订单确认邮件

**预期结果**:
- 邮件主题: "订单支付成功"
- 邮件包含订单号
- 邮件包含购买的产品
- 邮件包含密钥信息
- 邮件格式为HTML

### 2.3 低库存预警邮件

**测试步骤**:
1. 将某产品密钥库存降至阈值以下
2. 触发库存检查
3. 检查管理员是否收到预警邮件

**预期结果**:
- 邮件主题: "库存预警"
- 邮件列出低库存产品
- 邮件包含当前库存数量

---

## 3. 前端功能测试

### 3.1 产品展示页测试

**访问地址**: http://localhost:3000

**测试步骤**:
1. 打开首页
2. 检查产品列表是否正常显示
3. 检查价格是否根据地区正确显示
4. 点击产品查看详情

**预期结果**:
- 产品卡片正常渲染
- 图片、名称、描述显示正确
- 价格显示正确(根据IP地区)
- 点击产品可查看详情

### 3.2 购买流程测试

**测试步骤**:
1. 选择产品
2. 选择数量
3. 输入邮箱
4. 选择支付方式
5. 提交订单

**预期结果**:
- 可以正常选择产品和数量
- 价格计算正确
- 邮箱验证正常
- 支付方式可选择
- 提交后跳转到支付页面

### 3.3 订单查询测试

**测试步骤**:
1. 访问订单查询页面
2. 输入邮箱
3. 点击"发送验证码"
4. 在MailPit查看验证码
5. 输入验证码
6. 查看订单列表

**预期结果**:
- 可以发送验证码
- 验证码邮件正常接收
- 输入正确验证码后可查看订单
- 订单信息显示完整
- 已支付订单可查看密钥

### 3.4 响应式设计测试

**测试步骤**:
1. 在不同设备尺寸下测试
   - 桌面端 (1920x1080)
   - 平板端 (768x1024)
   - 移动端 (375x667)

**预期结果**:
- 所有页面在不同尺寸下正常显示
- 布局自适应
- 按钮和链接可点击
- 文字可读

---

## 4. 管理后台测试

### 4.1 登录功能

**访问地址**: http://localhost:3002 (如已部署)

**测试步骤**:
1. 访问管理后台
2. 输入用户名和密码
3. 点击登录

**预期结果**:
- 登录成功后跳转到仪表盘
- 错误密码提示错误信息
- 登录状态保持

### 4.2 仪表盘

**测试步骤**:
1. 登录后查看仪表盘
2. 检查统计数据

**预期结果**:
- 显示总订单数
- 显示总收入
- 显示总产品数
- 显示总密钥数
- 数据与实际一致

### 4.3 产品管理

**测试步骤**:
1. 进入产品管理页面
2. 测试创建产品
3. 测试编辑产品
4. 测试删除产品
5. 测试产品上下架

**预期结果**:
- 可以创建新产品
- 可以编辑产品信息
- 可以删除产品
- 可以切换产品状态

### 4.4 密钥管理

**测试步骤**:
1. 进入密钥管理页面
2. 测试批量导入密钥
3. 查看密钥列表
4. 测试作废密钥

**预期结果**:
- 可以批量导入密钥(支持换行分隔)
- 密钥列表显示正确
- 可以查看密钥状态(可用/已使用/已作废)
- 可以作废密钥

### 4.5 订单管理

**测试步骤**:
1. 进入订单管理页面
2. 查看订单列表
3. 测试订单搜索
4. 查看订单详情

**预期结果**:
- 订单列表显示完整
- 可以按邮箱、订单号搜索
- 可以查看订单详细信息
- 可以查看订单状态

### 4.6 系统设置

**测试步骤**:
1. 进入系统设置页面
2. 修改系统配置
3. 保存设置

**预期结果**:
- 可以修改网站标题
- 可以修改邮件配置
- 可以修改库存预警阈值
- 设置保存成功

---

## 5. 支付流程测试

### 5.1 支付宝支付测试

**注意**: 需要配置真实的支付宝参数

**测试步骤**:
1. 创建订单并选择支付宝支付
2. 跳转到支付宝沙箱环境
3. 完成支付
4. 验证回调处理

**预期结果**:
- 订单状态更新为已支付
- 密钥自动分配
- 发送订单确认邮件

### 5.2 微信支付测试

**注意**: 需要配置真实的微信支付参数

**测试步骤**:
1. 创建订单并选择微信支付
2. 扫描二维码支付
3. 完成支付
4. 验证回调处理

**预期结果**:
- 订单状态更新为已支付
- 密钥自动分配
- 发送订单确认邮件

---

## 6. 安全性测试

### 6.1 SQL注入测试

**测试用例**:
```bash
# 在订单查询中尝试SQL注入
curl -X POST http://localhost:3001/api/orders/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com OR 1=1", "code": "123456"}'
```

**预期结果**:
- 输入被正确转义
- 不会导致SQL错误或数据泄露

### 6.2 XSS攻击测试

**测试用例**:
```bash
# 尝试在产品名称中注入脚本
curl -X POST http://localhost:3001/api/admin/products \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<script>alert('xss')</script>",
    "description": "测试",
    "category": "software"
  }'
```

**预期结果**:
- 脚本被转义或过滤
- 前端显示时不会执行脚本

### 6.3 CSRF防护测试

**测试步骤**:
1. 尝试在未携带CSRF token的情况下提交表单
2. 验证是否被阻止

**预期结果**:
- 非法请求被拒绝
- 返回403或类似错误

### 6.4 密钥加密测试

**测试步骤**:
1. 在数据库中查看密钥存储
2. 验证密钥是否加密

**预期结果**:
- 数据库中的密钥是加密存储
- 只有在订单完成后才解密返回给用户

### 6.5 认证与授权测试

**测试用例**:
```bash
# 未登录访问管理后台API
curl http://localhost:3001/api/admin/products

# 使用过期token访问
curl http://localhost:3001/api/admin/products \
  -H "Authorization: Bearer {过期token}"
```

**预期结果**:
- 未认证请求返回401
- 过期token返回401
- 提示需要登录

---

## 7. 性能测试

### 7.1 API响应时间测试

**工具**: Apache Bench 或 wrk

**测试用例**:
```bash
# 测试产品列表API
ab -n 1000 -c 10 http://localhost:3001/api/products

# 测试订单创建API
ab -n 100 -c 5 -p order.json -T application/json http://localhost:3001/api/orders
```

**预期结果**:
- GET请求平均响应时间 < 100ms
- POST请求平均响应时间 < 200ms
- 无错误响应

### 7.2 数据库查询性能

**测试步骤**:
1. 在数据库中插入大量测试数据
2. 测试复杂查询的响应时间

**预期结果**:
- 带索引的查询快速响应
- 分页查询不会超时
- 统计查询在合理时间内完成

### 7.3 并发测试

**测试步骤**:
1. 使用压力测试工具模拟并发请求
2. 测试系统在高并发下的表现

**预期结果**:
- 系统不会崩溃
- 错误率在可接受范围内
- 响应时间在可接受范围内

---

## 8. 错误处理测试

### 8.1 网络错误

**测试步骤**:
1. 断开数据库连接
2. 访问需要数据库的API
3. 检查错误处理

**预期结果**:
- 返回友好的错误信息
- 不暴露敏感信息
- 日志记录错误

### 8.2 业务逻辑错误

**测试用例**:
```bash
# 订单数量超出库存
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "items": [{"productId": 1, "priceId": 1, "quantity": 99999}]
  }'

# 无效的产品ID
curl http://localhost:3001/api/products/99999

# 无效的验证码
curl -X POST http://localhost:3001/api/orders/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "code": "000000"}'
```

**预期结果**:
- 返回明确的错误信息
- 状态码正确(400, 404等)
- 不会导致系统异常

### 8.3 邮件发送失败

**测试步骤**:
1. 停止MailPit服务
2. 尝试发送验证码
3. 检查错误处理

**预期结果**:
- 记录错误日志
- 返回友好提示
- 不影响其他功能

---

## 9. 兼容性测试

### 9.1 浏览器兼容性

**测试浏览器**:
- Chrome (最新版本)
- Firefox (最新版本)
- Safari (最新版本)
- Edge (最新版本)

**预期结果**:
- 所有浏览器都能正常显示
- 功能正常运行
- 样式一致

### 9.2 移动端兼容性

**测试设备**:
- iOS Safari
- Android Chrome
- 微信内置浏览器

**预期结果**:
- 移动端正常显示
- 触摸操作流畅
- 支付流程正常

---

## 10. 数据一致性测试

### 10.1 订单状态一致性

**测试步骤**:
1. 创建订单
2. 模拟支付回调
3. 验证订单状态、密钥分配、邮件发送是否一致

**预期结果**:
- 订单状态正确更新
- 密钥正确分配且标记为已使用
- 邮件发送成功
- 库存正确扣减

### 10.2 并发订单测试

**测试步骤**:
1. 同时创建多个订单购买同一产品
2. 验证密钥分配不会重复
3. 验证库存扣减正确

**预期结果**:
- 不会分配重复密钥
- 库存正确扣减
- 所有订单正常完成

---

## 测试检查清单

### 后端API
- [ ] 产品列表API
- [ ] 产品详情API
- [ ] 价格计算API
- [ ] 创建订单API
- [ ] 订单详情API
- [ ] 发送验证码API
- [ ] 验证码验证API
- [ ] 邮箱订单查询API
- [ ] 管理员登录API
- [ ] 仪表盘统计API
- [ ] 产品管理API (CRUD)
- [ ] 密钥管理API
- [ ] 订单管理API

### 邮件服务
- [ ] 验证码邮件发送
- [ ] 订单确认邮件发送
- [ ] 低库存预警邮件
- [ ] 邮件模板显示正确
- [ ] 多语言支持

### 前端功能
- [ ] 产品展示页
- [ ] 购买流程
- [ ] 订单查询
- [ ] 响应式设计
- [ ] 加载状态显示
- [ ] 错误提示

### 管理后台
- [ ] 登录功能
- [ ] 仪表盘
- [ ] 产品管理
- [ ] 密钥管理
- [ ] 订单管理
- [ ] 系统设置

### 支付功能
- [ ] 支付宝支付
- [ ] 微信支付
- [ ] 支付回调处理
- [ ] 订单状态更新

### 安全性
- [ ] SQL注入防护
- [ ] XSS攻击防护
- [ ] CSRF防护
- [ ] 密钥加密
- [ ] 认证与授权

### 性能
- [ ] API响应时间
- [ ] 数据库查询性能
- [ ] 并发处理能力

### 错误处理
- [ ] 网络错误处理
- [ ] 业务逻辑错误处理
- [ ] 邮件发送失败处理

---

## 测试报告模板

### 测试环境
- 测试时间:
- 测试人员:
- 后端版本:
- 前端版本:

### 测试结果
| 模块 | 测试用例数 | 通过 | 失败 | 通过率 |
|------|-----------|------|------|--------|
| 后端API | | | | |
| 邮件服务 | | | | |
| 前端功能 | | | | |
| 管理后台 | | | | |
| 支付功能 | | | | |
| 安全性 | | | | |
| 性能 | | | | |
| **总计** | | | | |

### 发现的问题
| 问题ID | 模块 | 描述 | 严重程度 | 状态 |
|--------|------|------|----------|------|
| BUG-001 | | | 严重/一般/轻微 | 待修复/已修复 |

### 建议和改进
1.
2.
3.

---

## 下一步计划

1. 执行基础功能测试
2. 修复发现的bug
3. 执行完整的集成测试
4. 性能优化
5. 安全加固
6. 准备上线部署
