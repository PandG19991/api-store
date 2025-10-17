# Windows 平台安装指南

本指南适用于 Windows 10/11 系统。

---

## 方案一：使用 Scoop（推荐 - 最简单）

Scoop 是 Windows 的命令行包管理器，类似于 macOS 的 Homebrew。

### 1. 安装 Scoop

打开 **PowerShell**（以管理员身份运行），执行：

```powershell
# 设置执行策略
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# 安装 Scoop
irm get.scoop.sh | iex
```

### 2. 使用 Scoop 安装 PostgreSQL 和 Redis

```powershell
# 安装 PostgreSQL
scoop install postgresql

# 安装 Redis
scoop install redis
```

### 3. 启动服务

**启动 PostgreSQL:**
```powershell
pg_ctl -D "$env:USERPROFILE\scoop\apps\postgresql\current\data" start
```

**启动 Redis:**
```powershell
redis-server
```

### 4. 创建数据库

```powershell
# 连接到 PostgreSQL
psql -U postgres

# 在 psql 提示符下执行
CREATE DATABASE license_store;
\q
```

---

## 方案二：使用官方安装包

### 安装 PostgreSQL

1. **下载安装包**
   - 访问: https://www.postgresql.org/download/windows/
   - 下载 PostgreSQL 15 或更高版本

2. **运行安装程序**
   - 双击下载的 .exe 文件
   - 设置密码（记住这个密码！）
   - 端口保持默认 5432
   - 完成安装

3. **添加到环境变量**
   - 将 `C:\Program Files\PostgreSQL\15\bin` 添加到系统 PATH

4. **创建数据库**
   ```cmd
   # 打开命令提示符
   psql -U postgres

   # 输入密码后执行
   CREATE DATABASE license_store;
   \q
   ```

### 安装 Redis

**Windows 不官方支持 Redis，有几个选择：**

#### 选项 A: 使用 Memurai（Redis 的 Windows 替代品）
1. 访问: https://www.memurai.com/
2. 下载并安装 Memurai Developer Edition（免费）
3. 安装后 Redis 会作为 Windows 服务自动运行

#### 选项 B: 使用 WSL2 + Redis
如果您已启用 WSL2：
```bash
wsl --install
# 重启后进入 WSL
sudo apt-get update
sudo apt-get install redis-server
sudo service redis-server start
```

#### 选项 C: 使用 Redis 的非官方 Windows 构建
1. 访问: https://github.com/tporadowski/redis/releases
2. 下载最新的 .msi 安装包
3. 安装并启动服务

---

## 方案三：使用 Docker Desktop（最灵活）

### 1. 安装 Docker Desktop

1. 下载: https://www.docker.com/products/docker-desktop/
2. 安装并重启电脑
3. 启动 Docker Desktop

### 2. 启动数据库容器

在项目根目录创建 `docker-compose.yml`（我已经为您创建了），然后运行：

```cmd
cd d:\tools\密钥网站
docker-compose up -d
```

这会自动启动 PostgreSQL 和 Redis。

---

## 验证安装

### 检查 PostgreSQL

```cmd
psql --version
# 应该显示: psql (PostgreSQL) 15.x

# 测试连接
psql -U postgres -c "SELECT version();"
```

### 检查 Redis

```cmd
redis-cli --version
# 应该显示: redis-cli x.x.x

# 测试连接
redis-cli ping
# 应该返回: PONG
```

---

## 配置数据库连接

编辑 `backend\.env` 文件：

```env
# 如果 PostgreSQL 密码是 postgres
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/license_store"

# 如果您设置了不同的密码
DATABASE_URL="postgresql://postgres:你的密码@localhost:5432/license_store"

# Redis 连接
REDIS_URL="redis://localhost:6379"
```

---

## 常见问题

### 问题 1: PostgreSQL 服务未启动

**Windows 服务方式启动:**
1. 按 `Win + R`
2. 输入 `services.msc`
3. 找到 `postgresql-x64-15`
4. 右键 → 启动

**命令行方式:**
```cmd
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start
```

### 问题 2: Redis 连接失败

确保 Redis 服务正在运行：
```cmd
# 检查进程
tasklist | findstr redis

# 手动启动
redis-server
```

### 问题 3: 端口被占用

修改 `.env` 中的端口：
```env
# 使用不同的端口
PORT=3001
```

---

## 下一步

安装完成后，继续执行：
1. `cd backend`
2. `npm install`
3. `npm run db:migrate`
4. `npm run dev`

---

**提示:** 如果遇到任何问题，请检查相应服务的日志文件。
