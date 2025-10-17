# 端口被占用问题解决方案

**日期**: 2025-10-17 02:35
**问题**: Port 3001 被占用，前端和后端无法共存
**目标**: 正确配置前后端端口，避免冲突

---

## 快速解决方案

### 方案选择决策树

```
是否想同时运行前端和后端?
├─ 是 (推荐用于开发)
│  └─ 使用不同的端口
│     ├─ 前端: Port 3000
│     ├─ 后端: Port 3001
│     └─ 修改前端API地址指向3001
│
└─ 否 (生产环境或单独测试)
   └─ 后端使用默认Port 3001
      └─ 运行诊断测试
```

---

## 解决方案 1: 后端在Port 3001，前端在其他端口 ⭐ 推荐

### 步骤1: 关闭所有进程

```bash
# Windows
taskkill /F /IM node.exe

# 等待2秒
sleep 2

# 验证
netstat -ano | findstr ":3000\|:3001\|:3005"
# 应该没有Node进程的输出
```

### 步骤2: 启动后端在Port 3001

```bash
cd D:\tools\密钥网站\backend

# 确保.env中有
# PORT=3001

# 启动后端
npm run dev
# 或
npm start
```

**验证输出**:
```
🚀 Server is running!
📍 Local:   http://localhost:3001
```

### 步骤3: 前端使用正确的API地址

#### 方法A: 启动前端在Port 3000 (让Next.js自动选择)

```bash
cd D:\tools\密钥网站\frontend

npm run dev
```

**结果**:
- 前端通常会在Port 3000或随机端口运行
- 但所有admin页面已hardcoded指向 `localhost:3001` ✅

#### 方法B: 明确指定前端端口

```bash
cd D:\tools\密钥网站\frontend

PORT=3000 npm run dev
```

### 步骤4: 验证连接

在浏览器中打开:
```
http://localhost:3000 (前端)
http://localhost:3001/api (后端)
```

两个都应该工作正常。

---

## 解决方案 2: 只运行后端用于性能测试

### 方法1: 关闭前端，只运行后端

```bash
# 步骤1: 关闭所有进程
taskkill /F /IM node.exe
sleep 2

# 步骤2: 启动后端
cd D:\tools\密钥网站\backend
PORT=3001 npm start

# 步骤3: 在另一个终端运行性能测试
cd D:\tools\密钥网站
node tests/performance/diagnostic-load-test.js
```

**优点**:
- 干净的环境，专注测试后端
- 没有前端的干扰

### 方法2: 使用不同的机器

```bash
# 机器 A: 后端
cd D:\tools\密钥网站\backend
npm start

# 机器 B: 性能测试
# 修改diagnostic-load-test.js中的TARGET_HOST为机器A的IP
```

---

## 解决方案 3: 使用环境变量明确管理

### 创建 `.env.development.local`

```bash
# backend/.env.development.local
PORT=3001
NODE_ENV=development

# frontend/.env.development.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_BASE_PATH=/api
```

### 创建启动脚本

#### Windows Batch (`start-dev.bat`)

```batch
@echo off
REM 启动后端和前端的开发环境

echo 关闭现有进程...
taskkill /F /IM node.exe 2>nul
timeout /t 2

echo 启动后端 (Port 3001)...
start "Backend" cmd /k "cd backend && npm run dev"

timeout /t 3

echo 启动前端 (Port 3000)...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo 后端: http://localhost:3001
echo 前端: http://localhost:3000
```

使用:
```bash
start-dev.bat
```

#### Shell Script (`start-dev.sh`)

```bash
#!/bin/bash

# 关闭现有进程
echo "关闭现有进程..."
pkill -f "node" 2>/dev/null || true
sleep 2

# 启动后端
echo "启动后端 (Port 3001)..."
cd backend
npm run dev &
BACKEND_PID=$!

sleep 3

# 启动前端
echo "启动前端 (Port 3000)..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "后端 PID: $BACKEND_PID"
echo "前端 PID: $FRONTEND_PID"
echo ""
echo "后端: http://localhost:3001"
echo "前端: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止两个服务"

wait
```

使用:
```bash
chmod +x start-dev.sh
./start-dev.sh
```

---

## 诊断命令

### 查看所有占用的端口

```bash
# 查看port 3000, 3001, 3005的占用情况
netstat -ano | findstr ":3000\|:3001\|:3005"

# 输出示例:
# TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       12345
# TCP    0.0.0.0:3001           0.0.0.0:0              LISTENING       12346
# TCP    0.0.0.0:3005           0.0.0.0:0              LISTENING       12347
```

### 查看进程详情

```bash
# 查看PID对应的进程
tasklist | findstr "12345"

# 杀死特定进程
taskkill /F /PID 12345
```

### 强制释放端口

```bash
# Windows 10+
netsh int ipv4 show excludedportrange protocol=tcp

# 临时释放端口
netsh int ipv4 set excludedportrange protocol=tcp startport=3001 numberofports=1

# 查看所有监听中的端口
Get-NetTCPConnection -State Listen | Select-Object LocalPort, OwningProcess
```

---

## 配置检查清单

### 启动前端前

- [ ] 后端已启动在Port 3001
- [ ] 验证: `curl http://localhost:3001/api` 返回200
- [ ] 没有其他进程占用Port 3000
- [ ] `.env`文件正确设置了端口

### 启动后端前

- [ ] 没有其他后端进程运行
- [ ] Port 3001没有被占用
- [ ] 验证: `netstat -ano | findstr :3001` 无输出
- [ ] `.env`中`PORT=3001`已设置

### 运行性能测试前

- [ ] 关闭了前端开发服务器
- [ ] 后端独立运行在Port 3001
- [ ] 验证后端响应: `curl http://localhost:3001/health`
- [ ] `diagnostic-load-test.js`中的TARGET_PORT设置正确

---

## 常见问题排查

### 问题1: "Port 3001已被占用"

```bash
# 找出占用进程
netstat -ano | findstr ":3001"

# 结果: TCP 0.0.0.0:3001 0.0.0.0:0 LISTENING 12345
#       前面的数字是PID

# 杀死进程
taskkill /F /PID 12345

# 或全部杀死
taskkill /F /IM node.exe
```

### 问题2: 前端无法连接后端

```javascript
// 检查前端API配置
// frontend/src/lib/api/client.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
//                                                 ↑ 应该指向3001

// 或在admin页面检查
// fetch("http://localhost:3001/api/...") ← 确保是3001
```

### 问题3: 性能测试无法连接

```javascript
// diagnostic-load-test.js中
const TARGET_HOST = 'localhost';
const TARGET_PORT = 3001;  // ← 确保是3001

// 测试连接
curl http://localhost:3001/api
```

### 问题4: 性能测试结果异常 (90%失败)

```bash
# 首先检查是否在测试正确的后端
curl http://localhost:3001/health
# 应该返回: {"success":true, ...}

# 检查数据库连接
curl http://localhost:3001/api/products
# 应该返回: 产品列表或错误信息 (不应该是500)
```

---

## 推荐的开发工作流

### 本地开发

```bash
# 终端1: 启动后端
cd backend
npm run dev

# 终端2: 启动前端
cd frontend
npm run dev

# 终端3: 运行测试
cd .
npm test

# 或运行性能测试
node tests/performance/diagnostic-load-test.js
```

### 性能测试

```bash
# 第1步: 确保后端运行在3001
# (参考上面的步骤)

# 第2步: 关闭前端
taskkill /F /IM node.exe 2>nul || true

# 第3步: 只启动后端
cd backend
npm start

# 第4步: 运行性能测试
cd ..
node tests/performance/diagnostic-load-test.js
```

### 生产部署

```bash
# 使用反向代理 (Nginx)
# 前端和后端都在同一个域/端口
upstream frontend {
  server frontend:3000;
}

upstream api {
  server backend:3001;
}

server {
  listen 80;

  # 前端
  location / {
    proxy_pass http://frontend;
  }

  # API
  location /api {
    proxy_pass http://api;
  }
}
```

---

## 总结

| 场景 | 前端端口 | 后端端口 | 前端API地址 |
|-----|---------|---------|-------------|
| 本地开发 | 3000 | 3001 | http://localhost:3001 ✅ |
| 性能测试 | 关闭 | 3001 | N/A |
| 生产环境 | 同一域名/80 | 同一域名/80 | /api |

---

**最后更新**: 2025-10-17 02:35
**建议**:立即实施方案1 (后端3001+前端3000),然后重新运行性能测试
