# 密钥管理 API 文档

## 概述

密钥管理 API 提供完整的许可证密钥管理功能,包括批量导入、查看、作废、删除等操作。支持灵活的筛选和搜索,方便管理员高效管理大量密钥。

---

## 权限要求

### 查看权限
- **查看密钥列表和详情**: 需要管理员认证（`authenticate`）
- **查看统计信息**: 需要管理员认证（`authenticate`）

### 修改权限
- **批量导入、作废、删除**: 需要超级管理员（`requireSuperAdmin`）

---

## API 接口

### 1. 获取密钥列表

**端点**: `GET /api/admin/license-keys`

**权限**: 需要管理员认证

**查询参数**:
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | integer | 否 | 1 | 页码（最小值 1） |
| limit | integer | 否 | 20 | 每页数量（1-100） |
| productId | integer | 否 | - | 筛选指定产品的密钥 |
| status | string | 否 | - | 筛选状态（available/sold/revoked） |
| search | string | 否 | - | 搜索密钥值（部分匹配） |
| sortBy | string | 否 | createdAt | 排序字段（createdAt/soldAt） |
| sortOrder | string | 否 | desc | 排序方向（asc/desc） |

**请求示例**:
```bash
GET /api/admin/license-keys?page=1&limit=20&productId=1&status=available&sortBy=createdAt&sortOrder=desc
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "keys": [
      {
        "id": 1,
        "productId": 1,
        "keyValueEncrypted": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
        "status": "available",
        "orderId": null,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "soldAt": null,
        "revokedAt": null,
        "revokeReason": null,
        "product": {
          "id": 1,
          "name": "Windows 11 Pro",
          "slug": "windows-11-pro"
        },
        "order": null
      },
      {
        "id": 2,
        "productId": 1,
        "keyValueEncrypted": "YYYYY-YYYYY-YYYYY-YYYYY-YYYYY",
        "status": "sold",
        "orderId": 123,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "soldAt": "2025-01-15T10:30:00.000Z",
        "revokedAt": null,
        "revokeReason": null,
        "product": {
          "id": 1,
          "name": "Windows 11 Pro",
          "slug": "windows-11-pro"
        },
        "order": {
          "id": 123,
          "orderNumber": "ORD-20250115-ABC123",
          "email": "customer@example.com"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 250,
      "totalPages": 13
    }
  }
}
```

---

### 2. 获取单个密钥详情

**端点**: `GET /api/admin/license-keys/:id`

**权限**: 需要管理员认证

**路径参数**:
- `id`: 密钥ID（整数）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "key": {
      "id": 1,
      "productId": 1,
      "keyValueEncrypted": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
      "status": "sold",
      "orderId": 123,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "soldAt": "2025-01-15T10:30:00.000Z",
      "revokedAt": null,
      "revokeReason": null,
      "product": {
        "id": 1,
        "name": "Windows 11 Pro",
        "slug": "windows-11-pro",
        ...
      },
      "order": {
        "id": 123,
        "orderNumber": "ORD-20250115-ABC123",
        "email": "customer@example.com",
        "totalAmount": 299.99,
        "items": [...]
      }
    }
  }
}
```

---

### 3. 批量导入密钥

**端点**: `POST /api/admin/license-keys/bulk-import`

**权限**: 需要超级管理员

**请求头**:
```
Authorization: Bearer <super-admin-token>
Content-Type: application/json
```

**请求体**:
```json
{
  "productId": 1,
  "keys": [
    "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
    "YYYYY-YYYYY-YYYYY-YYYYY-YYYYY",
    "ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ"
  ]
}
```

**字段说明**:
- `productId` (必填): 产品ID
- `keys` (必填): 密钥数组（1-1000个，会自动去重和过滤空字符串）

**响应示例** (成功):
```json
{
  "success": true,
  "message": "License keys imported successfully",
  "data": {
    "imported": 150,
    "duplicates": 50,
    "total": 200
  }
}
```

**说明**:
- `imported`: 成功导入的数量
- `duplicates`: 重复跳过的数量
- `total`: 提交的密钥总数

**错误响应** (所有密钥已存在):
```json
{
  "success": false,
  "code": "ALL_KEYS_EXIST",
  "message": "All keys already exist in the database",
  "data": {
    "duplicateCount": 200
  }
}
```

**错误响应** (产品不存在):
```json
{
  "success": false,
  "code": "PRODUCT_NOT_FOUND",
  "message": "Product not found"
}
```

---

### 4. 作废密钥

**端点**: `PATCH /api/admin/license-keys/:id/revoke`

**权限**: 需要超级管理员

**路径参数**:
- `id`: 密钥ID

**请求体** (可选):
```json
{
  "reason": "Customer requested refund"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "License key revoked successfully",
  "data": {
    "key": {
      "id": 1,
      "productId": 1,
      "keyValueEncrypted": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
      "status": "revoked",
      "orderId": 123,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "soldAt": "2025-01-15T10:30:00.000Z",
      "revokedAt": "2025-10-16T14:00:00.000Z",
      "revokeReason": "Customer requested refund",
      "product": {
        "id": 1,
        "name": "Windows 11 Pro",
        "slug": "windows-11-pro"
      }
    }
  }
}
```

**错误响应** (已被作废):
```json
{
  "success": false,
  "code": "ALREADY_REVOKED",
  "message": "License key is already revoked"
}
```

---

### 5. 批量作废密钥

**端点**: `POST /api/admin/license-keys/bulk-revoke`

**权限**: 需要超级管理员

**请求体**:
```json
{
  "ids": [1, 2, 3, 4, 5],
  "reason": "Product recall"
}
```

**字段说明**:
- `ids` (必填): 密钥ID数组（1-100个）
- `reason` (可选): 作废原因（最多500字符）

**响应示例**:
```json
{
  "success": true,
  "message": "License keys revoked successfully",
  "data": {
    "revokedCount": 5
  }
}
```

**说明**: 只会作废状态不是 `revoked` 的密钥,已作废的密钥会被跳过。

---

### 6. 删除密钥

**端点**: `DELETE /api/admin/license-keys/:id`

**权限**: 需要超级管理员

**路径参数**:
- `id`: 密钥ID

**响应示例**:
```json
{
  "success": true,
  "message": "License key deleted successfully"
}
```

**错误响应** (密钥已售出或已作废):
```json
{
  "success": false,
  "code": "CANNOT_DELETE",
  "message": "Cannot delete sold license key. Only available keys can be deleted."
}
```

**重要**: 只能删除状态为 `available` 的密钥。已售出或已作废的密钥无法删除,必须保留以维护数据完整性。

---

### 7. 批量删除密钥

**端点**: `POST /api/admin/license-keys/bulk-delete`

**权限**: 需要超级管理员

**请求体**:
```json
{
  "ids": [1, 2, 3, 4, 5]
}
```

**字段说明**:
- `ids` (必填): 密钥ID数组（1-100个）

**响应示例**:
```json
{
  "success": true,
  "message": "License keys deleted successfully",
  "data": {
    "deletedCount": 5
  }
}
```

**说明**: 只会删除状态为 `available` 的密钥,已售出或已作废的密钥会被跳过。

---

### 8. 获取密钥统计（按产品）

**端点**: `GET /api/admin/license-keys/stats/by-product`

**权限**: 需要管理员认证

**查询参数**:
- `productId` (可选): 筛选指定产品ID

**请求示例**:
```bash
GET /api/admin/license-keys/stats/by-product
GET /api/admin/license-keys/stats/by-product?productId=1
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "product": {
          "id": 1,
          "name": "Windows 11 Pro",
          "slug": "windows-11-pro"
        },
        "total": 250,
        "available": 120,
        "sold": 125,
        "revoked": 5
      },
      {
        "product": {
          "id": 2,
          "name": "Office 2021 Professional",
          "slug": "office-2021-pro"
        },
        "total": 180,
        "available": 85,
        "sold": 90,
        "revoked": 5
      }
    ],
    "total": 2
  }
}
```

---

## 使用示例

### 使用 cURL

**获取密钥列表**:
```bash
TOKEN="your-admin-token"

curl -X GET "http://localhost:3000/api/admin/license-keys?page=1&limit=50&productId=1&status=available" \
  -H "Authorization: Bearer $TOKEN"
```

**搜索密钥**:
```bash
curl -X GET "http://localhost:3000/api/admin/license-keys?search=XXXXX" \
  -H "Authorization: Bearer $TOKEN"
```

**批量导入密钥**:
```bash
curl -X POST http://localhost:3000/api/admin/license-keys/bulk-import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "keys": [
      "AAAAA-BBBBB-CCCCC-DDDDD-EEEEE",
      "FFFFF-GGGGG-HHHHH-IIIII-JJJJJ",
      "KKKKK-LLLLL-MMMMM-NNNNN-OOOOO"
    ]
  }'
```

**作废单个密钥**:
```bash
curl -X PATCH http://localhost:3000/api/admin/license-keys/1/revoke \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Customer requested refund"}'
```

**批量作废密钥**:
```bash
curl -X POST http://localhost:3000/api/admin/license-keys/bulk-revoke \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": [1, 2, 3, 4, 5],
    "reason": "Product recall"
  }'
```

**删除单个密钥**:
```bash
curl -X DELETE http://localhost:3000/api/admin/license-keys/1 \
  -H "Authorization: Bearer $TOKEN"
```

**批量删除密钥**:
```bash
curl -X POST http://localhost:3000/api/admin/license-keys/bulk-delete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": [1, 2, 3, 4, 5]}'
```

**获取统计信息**:
```bash
curl -X GET http://localhost:3000/api/admin/license-keys/stats/by-product \
  -H "Authorization: Bearer $TOKEN"
```

### 使用 JavaScript (Fetch API)

```javascript
const BASE_URL = 'http://localhost:3000/api/admin';
const token = localStorage.getItem('adminToken');

// 获取密钥列表
async function fetchLicenseKeys(params = {}) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${BASE_URL}/license-keys?${query}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  return await response.json();
}

// 批量导入密钥
async function importLicenseKeys(productId, keys) {
  const response = await fetch(`${BASE_URL}/license-keys/bulk-import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId, keys }),
  });

  const data = await response.json();

  if (data.success) {
    console.log(`Imported: ${data.data.imported}, Duplicates: ${data.data.duplicates}`);
  }

  return data;
}

// 作废密钥
async function revokeKey(id, reason) {
  const response = await fetch(`${BASE_URL}/license-keys/${id}/revoke`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  return await response.json();
}

// 批量作废
async function bulkRevokeKeys(ids, reason) {
  const response = await fetch(`${BASE_URL}/license-keys/bulk-revoke`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids, reason }),
  });

  return await response.json();
}

// 获取统计
async function getKeyStats(productId = null) {
  const query = productId ? `?productId=${productId}` : '';
  const response = await fetch(`${BASE_URL}/license-keys/stats/by-product${query}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  return await response.json();
}

// 使用示例
fetchLicenseKeys({ page: 1, limit: 50, productId: 1, status: 'available' });

importLicenseKeys(1, [
  'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX',
  'YYYYY-YYYYY-YYYYY-YYYYY-YYYYY',
]);

revokeKey(1, 'Customer requested refund');

bulkRevokeKeys([1, 2, 3], 'Product recall');

getKeyStats(1);
```

---

## 批量导入最佳实践

### 1. 从CSV文件导入

```javascript
// 前端代码: 解析CSV并导入
async function importFromCSV(file, productId) {
  const text = await file.text();
  const lines = text.split('\n');

  // 假设CSV格式: key,notes
  const keys = lines
    .slice(1) // 跳过标题行
    .map(line => line.split(',')[0].trim())
    .filter(key => key.length > 0);

  // 分批导入（每批500个）
  const batchSize = 500;
  const results = [];

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const result = await importLicenseKeys(productId, batch);
    results.push(result);

    console.log(`Batch ${Math.floor(i / batchSize) + 1}: Imported ${result.data.imported}`);
  }

  const totalImported = results.reduce((sum, r) => sum + r.data.imported, 0);
  const totalDuplicates = results.reduce((sum, r) => sum + r.data.duplicates, 0);

  console.log(`Total imported: ${totalImported}, Total duplicates: ${totalDuplicates}`);

  return { totalImported, totalDuplicates };
}
```

### 2. 从文本文件导入

```javascript
// 每行一个密钥
async function importFromTextFile(file, productId) {
  const text = await file.text();
  const keys = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return await importLicenseKeys(productId, keys);
}
```

### 3. 验证密钥格式

```javascript
// 在导入前验证密钥格式
function validateKeyFormat(key) {
  // 示例: Windows产品密钥格式 XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
  const windowsKeyPattern = /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/;

  return windowsKeyPattern.test(key);
}

async function importWithValidation(productId, keys) {
  const validKeys = keys.filter(validateKeyFormat);
  const invalidKeys = keys.filter(k => !validateKeyFormat(k));

  if (invalidKeys.length > 0) {
    console.warn(`${invalidKeys.length} invalid keys skipped:`, invalidKeys);
  }

  if (validKeys.length === 0) {
    throw new Error('No valid keys to import');
  }

  return await importLicenseKeys(productId, validKeys);
}
```

---

## 密钥状态说明

| 状态 | 说明 | 可执行操作 |
|------|------|-----------|
| `available` | 可用，未售出 | 查看、删除、作废 |
| `sold` | 已售出 | 查看、作废（不可删除） |
| `revoked` | 已作废 | 查看（不可删除、不可再次作废） |

**状态转换**:
- `available` → `sold`: 自动（当订单完成时）
- `available` → `revoked`: 手动作废
- `sold` → `revoked`: 手动作废
- `revoked` → 无法转换为其他状态（永久）

---

## 错误处理

| HTTP状态码 | 错误代码 | 说明 |
|-----------|---------|------|
| 401 | UNAUTHORIZED | Token无效或已过期 |
| 403 | FORBIDDEN | 权限不足（需要超级管理员） |
| 404 | NOT_FOUND | 密钥不存在 |
| 404 | PRODUCT_NOT_FOUND | 产品不存在 |
| 400 | NO_VALID_KEYS | 没有有效的密钥 |
| 400 | ALL_KEYS_EXIST | 所有密钥已存在 |
| 400 | ALREADY_REVOKED | 密钥已被作废 |
| 400 | CANNOT_DELETE | 无法删除（不是available状态） |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

---

## 安全注意事项

1. **密钥加密存储**: 数据库中存储的是加密后的密钥（`keyValueEncrypted`）
2. **操作日志**: 建议记录所有密钥操作（导入、作废、删除）的审计日志
3. **批量限制**: 单次最多导入1000个、作废100个、删除100个密钥
4. **权限控制**: 只有超级管理员可以执行修改操作
5. **数据完整性**: 已售出和已作废的密钥无法删除,确保历史数据完整

---

## 相关文件

```
backend/src/
├── routes/admin/
│   └── license-keys.js          # 密钥管理路由
│
└── middleware/
    └── auth.js                   # 认证中间件
```

---

## 总结

密钥管理 API 提供了全面的许可证密钥管理功能:
- ✅ 灵活的查询和筛选（分页、搜索、按产品/状态筛选）
- ✅ 批量导入（支持1-1000个密钥,自动去重）
- ✅ 单个和批量作废
- ✅ 单个和批量删除（仅限可用状态）
- ✅ 详细的统计信息
- ✅ 完善的权限控制和错误处理

所有修改操作都需要超级管理员权限,确保密钥管理的安全性。
