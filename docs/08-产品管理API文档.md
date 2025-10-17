# 产品管理 API 文档

## 概述

产品管理 API 提供完整的 CRUD 功能,允许超级管理员创建、修改、查看和删除产品。支持产品基本信息管理、价格管理、库存查看等功能。

---

## 权限要求

### 查看权限
- **查看产品列表和详情**: 需要管理员认证（`authenticate`）
- 普通管理员和超级管理员都可以查看

### 修改权限
- **创建、更新、删除产品**: 需要超级管理员（`requireSuperAdmin`）
- 只有超级管理员可以执行修改操作

---

## API 接口

### 1. 获取产品列表

**端点**: `GET /api/admin/products`

**权限**: 需要管理员认证

**查询参数**:
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | integer | 否 | 1 | 页码（最小值 1） |
| limit | integer | 否 | 20 | 每页数量（1-100） |
| search | string | 否 | - | 搜索关键词（匹配名称、slug、描述） |
| isActive | boolean | 否 | - | 筛选启用/禁用状态 |
| sortBy | string | 否 | createdAt | 排序字段（name/createdAt/updatedAt） |
| sortOrder | string | 否 | desc | 排序方向（asc/desc） |

**请求示例**:
```bash
GET /api/admin/products?page=1&limit=20&search=windows&isActive=true&sortBy=name&sortOrder=asc
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "name": "Windows 11 Pro",
        "slug": "windows-11-pro",
        "description": "Professional edition of Windows 11",
        "features": ["Lifetime license", "Instant delivery", "24/7 support"],
        "isActive": true,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-15T10:30:00.000Z",
        "availableStock": 120,
        "prices": [
          {
            "id": 1,
            "region": "CN",
            "currency": "CNY",
            "amount": 299.99,
            "productId": 1,
            "createdAt": "2025-01-01T00:00:00.000Z"
          },
          {
            "id": 2,
            "region": "US",
            "currency": "USD",
            "amount": 49.99,
            "productId": 1,
            "createdAt": "2025-01-01T00:00:00.000Z"
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1
    }
  }
}
```

---

### 2. 获取单个产品详情

**端点**: `GET /api/admin/products/:id`

**权限**: 需要管理员认证

**路径参数**:
- `id`: 产品ID（整数）

**请求示例**:
```bash
GET /api/admin/products/1
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "name": "Windows 11 Pro",
      "slug": "windows-11-pro",
      "description": "Professional edition of Windows 11",
      "features": ["Lifetime license", "Instant delivery", "24/7 support"],
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z",
      "prices": [
        {
          "id": 1,
          "region": "CN",
          "currency": "CNY",
          "amount": 299.99,
          "productId": 1,
          "createdAt": "2025-01-01T00:00:00.000Z"
        }
      ]
    },
    "inventory": {
      "total": 250,
      "available": 120,
      "sold": 125,
      "revoked": 5
    }
  }
}
```

---

### 3. 创建新产品

**端点**: `POST /api/admin/products`

**权限**: 需要超级管理员

**请求头**:
```
Authorization: Bearer <super-admin-token>
Content-Type: application/json
```

**请求体**:
```json
{
  "name": "Office 2021 Professional",
  "slug": "office-2021-pro",
  "description": "Complete office suite with Word, Excel, PowerPoint, Outlook and more",
  "features": [
    "Lifetime license",
    "One-time purchase",
    "Instant email delivery",
    "Windows and Mac compatible"
  ],
  "isActive": true,
  "prices": [
    {
      "region": "CN",
      "currency": "CNY",
      "amount": 399.99
    },
    {
      "region": "US",
      "currency": "USD",
      "amount": 59.99
    },
    {
      "region": "EU",
      "currency": "EUR",
      "amount": 54.99
    }
  ]
}
```

**字段说明**:
- `name` (必填): 产品名称（1-255字符）
- `slug` (必填): URL友好标识（小写字母、数字、连字符，1-255字符）
- `description` (可选): 产品描述
- `features` (可选): 产品特性数组
- `isActive` (可选): 是否启用（默认 true）
- `prices` (必填): 价格数组（至少一个）
  - `region` (必填): 地区代码（2-10字符）
  - `currency` (必填): 货币代码（3字符，如 CNY/USD/EUR）
  - `amount` (必填): 价格（非负数）

**响应示例**:
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "product": {
      "id": 2,
      "name": "Office 2021 Professional",
      "slug": "office-2021-pro",
      "description": "Complete office suite...",
      "features": ["Lifetime license", "One-time purchase", ...],
      "isActive": true,
      "createdAt": "2025-10-16T12:00:00.000Z",
      "updatedAt": "2025-10-16T12:00:00.000Z",
      "prices": [...]
    }
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "code": "SLUG_EXISTS",
  "message": "Product with this slug already exists"
}
```

---

### 4. 更新产品信息

**端点**: `PUT /api/admin/products/:id`

**权限**: 需要超级管理员

**路径参数**:
- `id`: 产品ID

**请求体** (所有字段都是可选的):
```json
{
  "name": "Windows 11 Professional Edition",
  "slug": "windows-11-professional",
  "description": "Updated description",
  "features": ["New feature 1", "New feature 2"],
  "isActive": true
}
```

**注意**: 此接口只更新产品基本信息，不更新价格。价格更新请使用专用接口。

**响应示例**:
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "product": {
      "id": 1,
      "name": "Windows 11 Professional Edition",
      "slug": "windows-11-professional",
      "description": "Updated description",
      "features": ["New feature 1", "New feature 2"],
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-10-16T12:30:00.000Z",
      "prices": [...]
    }
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "code": "NOT_FOUND",
  "message": "Product not found"
}
```

```json
{
  "success": false,
  "code": "SLUG_EXISTS",
  "message": "Product with this slug already exists"
}
```

---

### 5. 删除产品

**端点**: `DELETE /api/admin/products/:id`

**权限**: 需要超级管理员

**路径参数**:
- `id`: 产品ID

**请求示例**:
```bash
DELETE /api/admin/products/3
Authorization: Bearer <super-admin-token>
```

**响应示例**:
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

**错误响应** (产品有关联数据):
```json
{
  "success": false,
  "code": "CANNOT_DELETE",
  "message": "Cannot delete product with existing license keys or orders. Consider deactivating instead."
}
```

**说明**: 如果产品已有密钥或订单，无法删除。建议使用禁用功能（`isActive: false`）替代删除。

---

### 6. 更新产品价格

**端点**: `PUT /api/admin/products/:id/prices`

**权限**: 需要超级管理员

**路径参数**:
- `id`: 产品ID

**请求体**:
```json
{
  "prices": [
    {
      "region": "CN",
      "currency": "CNY",
      "amount": 349.99
    },
    {
      "region": "US",
      "currency": "USD",
      "amount": 54.99
    },
    {
      "region": "EU",
      "currency": "EUR",
      "amount": 49.99
    }
  ]
}
```

**说明**: 此操作会删除所有旧价格，并创建新价格。请确保包含所有需要的地区价格。

**响应示例**:
```json
{
  "success": true,
  "message": "Prices updated successfully",
  "data": {
    "product": {
      "id": 1,
      "name": "Windows 11 Pro",
      "slug": "windows-11-pro",
      "prices": [
        {
          "id": 15,
          "region": "CN",
          "currency": "CNY",
          "amount": 349.99,
          "productId": 1,
          "createdAt": "2025-10-16T13:00:00.000Z"
        },
        ...
      ]
    }
  }
}
```

---

### 7. 切换产品启用/禁用状态

**端点**: `PATCH /api/admin/products/:id/toggle-active`

**权限**: 需要超级管理员

**路径参数**:
- `id`: 产品ID

**请求示例**:
```bash
PATCH /api/admin/products/1/toggle-active
Authorization: Bearer <super-admin-token>
```

**响应示例** (启用产品):
```json
{
  "success": true,
  "message": "Product activated successfully",
  "data": {
    "product": {
      "id": 1,
      "name": "Windows 11 Pro",
      "slug": "windows-11-pro",
      "isActive": true,
      ...
    }
  }
}
```

**响应示例** (禁用产品):
```json
{
  "success": true,
  "message": "Product deactivated successfully",
  "data": {
    "product": {
      "id": 1,
      "isActive": false,
      ...
    }
  }
}
```

**用途**: 快速启用/禁用产品,禁用后的产品不会在公开API中显示。

---

## 使用示例

### 使用 cURL

**获取产品列表**:
```bash
TOKEN="your-admin-token"

curl -X GET "http://localhost:3000/api/admin/products?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**搜索产品**:
```bash
curl -X GET "http://localhost:3000/api/admin/products?search=windows&isActive=true" \
  -H "Authorization: Bearer $TOKEN"
```

**创建产品**:
```bash
curl -X POST http://localhost:3000/api/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Adobe Photoshop 2024",
    "slug": "adobe-photoshop-2024",
    "description": "Industry-leading image editing software",
    "features": ["Lifetime license", "Latest features"],
    "isActive": true,
    "prices": [
      {"region": "CN", "currency": "CNY", "amount": 599.99},
      {"region": "US", "currency": "USD", "amount": 89.99}
    ]
  }'
```

**更新产品**:
```bash
curl -X PUT http://localhost:3000/api/admin/products/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Windows 11 Pro Updated",
    "description": "New description"
  }'
```

**更新价格**:
```bash
curl -X PUT http://localhost:3000/api/admin/products/1/prices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prices": [
      {"region": "CN", "currency": "CNY", "amount": 399.99},
      {"region": "US", "currency": "USD", "amount": 59.99}
    ]
  }'
```

**切换启用状态**:
```bash
curl -X PATCH http://localhost:3000/api/admin/products/1/toggle-active \
  -H "Authorization: Bearer $TOKEN"
```

**删除产品**:
```bash
curl -X DELETE http://localhost:3000/api/admin/products/3 \
  -H "Authorization: Bearer $TOKEN"
```

### 使用 JavaScript (Fetch API)

```javascript
const BASE_URL = 'http://localhost:3000/api/admin';
const token = localStorage.getItem('adminToken');

// 获取产品列表
async function fetchProducts(params = {}) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${BASE_URL}/products?${query}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (data.success) {
    console.log('Products:', data.data.products);
    console.log('Pagination:', data.data.pagination);
  }

  return data;
}

// 创建产品
async function createProduct(productData) {
  const response = await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(productData),
  });

  const data = await response.json();

  if (data.success) {
    console.log('Product created:', data.data.product);
  } else {
    console.error('Error:', data.message);
  }

  return data;
}

// 更新产品
async function updateProduct(id, updates) {
  const response = await fetch(`${BASE_URL}/products/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  return await response.json();
}

// 删除产品
async function deleteProduct(id) {
  const response = await fetch(`${BASE_URL}/products/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  return await response.json();
}

// 切换启用状态
async function toggleProductStatus(id) {
  const response = await fetch(`${BASE_URL}/products/${id}/toggle-active`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  return await response.json();
}

// 使用示例
fetchProducts({ page: 1, limit: 10, search: 'windows', isActive: true });

createProduct({
  name: 'New Product',
  slug: 'new-product',
  description: 'Product description',
  features: ['Feature 1', 'Feature 2'],
  isActive: true,
  prices: [
    { region: 'CN', currency: 'CNY', amount: 299.99 },
  ],
});
```

---

## 数据验证规则

### 产品名称 (name)
- ✅ 必填
- ✅ 1-255 字符
- ✅ 任意字符

### Slug
- ✅ 必填
- ✅ 1-255 字符
- ✅ 只允许小写字母、数字、连字符
- ✅ 正则: `^[a-z0-9-]+$`
- ✅ 必须唯一

### 描述 (description)
- ⭕ 可选
- ✅ 任意长度文本

### 特性 (features)
- ⭕ 可选
- ✅ 字符串数组

### 价格 (prices)
- ✅ 创建时必填
- ✅ 至少包含一个价格
- ✅ 每个价格必须包含:
  - `region`: 2-10字符
  - `currency`: 3字符（如 CNY, USD, EUR）
  - `amount`: 非负数

---

## 错误处理

| HTTP状态码 | 错误代码 | 说明 |
|-----------|---------|------|
| 401 | UNAUTHORIZED | Token无效或已过期 |
| 403 | FORBIDDEN | 权限不足（需要超级管理员） |
| 404 | NOT_FOUND | 产品不存在 |
| 400 | SLUG_EXISTS | Slug已被使用 |
| 400 | CANNOT_DELETE | 无法删除（有关联数据） |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

---

## 最佳实践

### 1. 产品 Slug 命名

推荐格式:
```
产品名-版本-类型

示例:
- windows-11-pro
- office-2021-home-business
- adobe-photoshop-2024
- autocad-2023-student
```

### 2. 价格设置

建议为所有主要市场设置价格:
```json
{
  "prices": [
    {"region": "CN", "currency": "CNY", "amount": 299.99},
    {"region": "US", "currency": "USD", "amount": 49.99},
    {"region": "EU", "currency": "EUR", "amount": 44.99},
    {"region": "UK", "currency": "GBP", "amount": 39.99}
  ]
}
```

### 3. 产品特性描述

使用清晰简洁的要点:
```json
{
  "features": [
    "终身许可证",
    "即时邮件交付",
    "官方正版激活",
    "支持 Windows 10/11",
    "24/7 客户支持"
  ]
}
```

### 4. 软删除 vs 硬删除

- **软删除** (推荐): 使用 `isActive: false` 禁用产品
  - 保留历史数据
  - 可以重新启用
  - 不影响已有订单

- **硬删除**: 使用 DELETE 接口
  - 仅当产品无任何关联数据时
  - 不可恢复
  - 慎用!

### 5. 批量操作

如需批量更新多个产品,建议:
```javascript
async function batchUpdateProducts(updates) {
  const promises = updates.map(({ id, data }) =>
    updateProduct(id, data)
  );

  const results = await Promise.allSettled(promises);

  const successful = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');

  console.log(`Success: ${successful.length}, Failed: ${failed.length}`);

  return { successful, failed };
}
```

---

## 相关文件

```
backend/src/
├── routes/admin/
│   └── products.js              # 产品管理路由
│
└── middleware/
    └── auth.js                   # 认证中间件
```

---

## 总结

产品管理 API 提供了完整的产品 CRUD 功能,包括:
- ✅ 分页、搜索、筛选、排序
- ✅ 产品基本信息管理
- ✅ 多地区价格管理
- ✅ 库存统计查看
- ✅ 启用/禁用切换
- ✅ 安全的删除保护

所有修改操作都需要超级管理员权限,确保系统安全。
