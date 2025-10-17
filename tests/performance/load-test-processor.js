
/**
 * Artillery 负载测试处理器
 * 提供随机数据生成和响应处理
 */

module.exports = {
  randomEmail: randomEmail,
  randomProduct: randomProduct,
  generateOrderId: generateOrderId,
  storeOrderId: storeOrderId,
};

let orderIds = [];

function randomEmail(context, ee, next) {
  const domains = ["gmail.com", "yahoo.com", "outlook.com", "test.com"];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const name = `user${Math.floor(Math.random() * 10000)}`;
  context.vars.randomEmail = `${name}@${domain}`;
  return next();
}

function randomProduct(context, ee, next) {
  const products = [
    "prod-001",
    "prod-002",
    "prod-003",
    "prod-004",
    "prod-005",
  ];
  context.vars.randomProduct =
    products[Math.floor(Math.random() * products.length)];
  return next();
}

function generateOrderId(context, ee, next) {
  context.vars.orderId = `order-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  return next();
}

function storeOrderId(requestParams, context, ee, next) {
  // 从响应中提取订单ID
  if (context.vars.orderId) {
    orderIds.push(context.vars.orderId);
  }
  return next();
}
