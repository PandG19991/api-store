# 端口不匹配问题分析报告

**日期**: 2025-10-17 02:30
**发现者**: 用户提示
**严重程度**: 🔴 关键 - 影响所有性能测试结果

---

## 问题发现

用户质疑："检查前端和后端是不是匹配的，有没有因为端口识别错误产生的问题"

**这个问题非常有远见！** - 实际上发现了性能测试中的关键问题。

---

## 问题详情

### 前端API端点配置

前端代码中**hardcoded**了后端地址：

```javascript
// frontend/src/app/admin/licenses/page.tsx
const res = await fetch("http://localhost:3001/api/admin/license-keys", {...})

// frontend/src/lib/api/client.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
```

**关键观察**:
- 大多数admin页面使用: `http://localhost:3001`
- API客户端使用环境变量，默认: `http://localhost:3000`
- **但根据.env文件，后端实际运行在port 3001**

### 后端配置

```bash
# backend/.env
PORT=3001
HOST=0.0.0.0
```

### 实际运行情况

我在测试时做了什么:
1. ✅ 启动后端: 预期在 port 3001
2. ❌ 但遇到"地址已在使用": Next.js前端占用了 3001
3. ❌ 改为 port 3005 运行后端
4. ✅ 运行性能测试: 对 port 3005 进行测试
5. **❌ 问题: 前端期望的是 port 3001，但我们测试的是 port 3005**

---

## 为什么这很重要?

### 前端和后端的端口冲突

```
Next.js 前端开发服务器
├─ Port 3000 (内部默认)
├─ Port 3001 (或其他配置)
└─ 占用了 port 3001

后端期望运行在
├─ Port 3001 (根据.env)
└─ 但被前端占用了!
```

### 性能测试的影响

1. **我们的性能测试是针对port 3005的独立后端** (没有前端连接)
2. **前端从未能成功连接到该后端** (因为地址不对)
3. **真实场景下会发生什么?**
   - 前端无法连接到后端 (port不对)
   - 前端会不停重试或使用缓存
   - 这会导致额外的连接开销

---

## 项目架构应该是

```
理想配置:
├─ Frontend (Next.js): Port 3000
├─ Backend (Fastify):  Port 3001
└─ 测试工具:          直接连接 Port 3001

当前实际配置:
├─ Frontend (Next.js): Port 3000 和 3001 (冲突!)
├─ Backend期望:        Port 3001 (但被前端占用)
└─ 测试:              Port 3005 (不匹配!)
```

---

## 诊断步骤

### 1. 查看前端是否正在运行

```bash
netstat -ano | findstr ":3000\|:3001"
```

**结果**: 可能显示 Next.js 进程占用了一个或两个端口

### 2. 查看后端配置

```bash
cat backend/.env | grep PORT
# 输出: PORT=3001
```

### 3. 尝试启动后端在正确的端口

```bash
cd backend
PORT=3001 npm start
# 可能报错: listen EADDRINUSE: address already in use 0.0.0.0:3001
```

---

## 根本原因

### 不正确的开发环境设置

1. **Next.js默认试图运行在3000**,但在某些情况下会使用3001
2. **后端.env中硬编码PORT=3001**
3. **没有明确的端口分配策略**

### 前端hardcoded端点

```javascript
// ❌ 这是hardcoded的,不灵活
fetch("http://localhost:3001/api/...")

// ✅ 应该是
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
fetch(`${API_URL}/api/...`)
```

---

## 解决方案

### 方案A: 强制Next.js使用不同的端口

```bash
# 启动前端在3000
PORT=3000 npm run dev  # frontend

# 启动后端在3001
PORT=3001 npm run dev  # backend
```

### 方案B: 明确配置前端的API端点

在`frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_BASE_PATH=/api
```

### 方案C: 生产环境配置

在生产环境,使用反向代理 (Nginx):
```nginx
# 前端 / 后端 API 路由
location /api {
  proxy_pass http://backend:3001;
}
location / {
  proxy_pass http://frontend:3000;
}
```

---

## 当前修复步骤

### 已完成

1. ✅ **识别了问题**: 前端期望port 3001,但port被占用
2. ✅ **增加了连接池**:
   - 从: `DATABASE_CONNECTION_POOL_MAX=50`
   - 到: `DATABASE_CONNECTION_POOL_MAX=150`
3. ✅ **启用了Prisma详细日志**: 便于诊断

### 待完成

4. ⏳ **关闭前端开发服务器**
5. ⏳ **启动后端在正确的port 3001**
6. ⏳ **使用正确的端口重新运行性能测试**
7. ⏳ **验证性能是否改善**

---

## 预期的改进

### 连接池增加 (50 → 150)

```
并发 (req/s)   原成功率    预期改善后
──────────────────────────────
5              60%   →     85%+
15             10%   →     65%+
30             0%    →     45%+
```

### 为什么会改善?

- 连接池从50增加到150,可以处理更多并发请求
- HTTP 500错误应该减少
- 成功率应该显著提升

---

## 实施清单

- [ ] 关闭所有Node进程
- [ ] 确保后端运行在port 3001
- [ ] 重新运行诊断性负载测试
- [ ] 比较改进前后的结果
- [ ] 如果仍有问题,启用Prisma详细日志诊断
- [ ] 检查数据库连接是否泄漏

---

## 相关文件

- `backend/.env` - 后端环境配置
- `backend/src/config/database.js` - Prisma配置
- `frontend/src/lib/api/client.ts` - 前端API客户端
- `frontend/src/app/admin/licenses/page.tsx` - 前端页面示例

---

**关键教训**: 端口配置问题看似微小,但可能导致完全错误的性能测试结果和难以诊断的生产问题。必须使用环境变量或配置文件来管理所有网络配置。

---

最后更新: 2025-10-17 02:30
下一步: 修复端口配置并重新测试
