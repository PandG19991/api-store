/**
 * 全局错误处理中间件
 */

import { isDevelopment } from '../config/env.js';

/**
 * 自定义错误类
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 常见错误类型
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation Error', errors = [], code = 'VALIDATION_ERROR') {
    super(message, 422, code);
    this.errors = errors;
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too Many Requests', code = 'TOO_MANY_REQUESTS') {
    super(message, 429, code);
  }
}

/**
 * Fastify 错误处理器
 */
export function errorHandler(error, request, reply) {
  // 记录错误日志
  request.log.error({
    err: error,
    req: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      ip: request.ip,
    },
  });

  // 自定义应用错误
  if (error.isOperational) {
    return reply.status(error.statusCode).send({
      success: false,
      code: error.code,
      message: error.message,
      ...(error.errors && { errors: error.errors }),
    });
  }

  // Prisma 错误处理
  if (error.code && error.code.startsWith('P')) {
    return handlePrismaError(error, reply);
  }

  // JWT 错误
  if (error.name === 'JsonWebTokenError') {
    return reply.status(401).send({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Invalid token',
    });
  }

  if (error.name === 'TokenExpiredError') {
    return reply.status(401).send({
      success: false,
      code: 'TOKEN_EXPIRED',
      message: 'Token expired',
    });
  }

  // Fastify 验证错误
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: error.validation,
    });
  }

  // 其他未知错误
  const statusCode = error.statusCode || 500;
  const message = isDevelopment ? error.message : 'Internal Server Error';

  return reply.status(statusCode).send({
    success: false,
    code: error.code || 'INTERNAL_ERROR',
    message,
    ...(isDevelopment && { stack: error.stack }),
  });
}

/**
 * 处理 Prisma 错误
 */
function handlePrismaError(error, reply) {
  const { code, meta } = error;

  const errorMap = {
    // 唯一约束冲突
    P2002: {
      statusCode: 409,
      code: 'DUPLICATE_ERROR',
      message: `${meta?.target?.join(', ')} already exists`,
    },
    // 记录未找到
    P2025: {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Record not found',
    },
    // 外键约束失败
    P2003: {
      statusCode: 400,
      code: 'FOREIGN_KEY_ERROR',
      message: 'Foreign key constraint failed',
    },
    // 必填字段缺失
    P2011: {
      statusCode: 400,
      code: 'REQUIRED_FIELD_MISSING',
      message: 'Required field missing',
    },
  };

  const errorInfo = errorMap[code] || {
    statusCode: 500,
    code: 'DATABASE_ERROR',
    message: isDevelopment ? error.message : 'Database error occurred',
  };

  return reply.status(errorInfo.statusCode).send({
    success: false,
    code: errorInfo.code,
    message: errorInfo.message,
    ...(isDevelopment && { details: error.message }),
  });
}

/**
 * 404 处理器
 */
export function notFoundHandler(request, reply) {
  reply.status(404).send({
    success: false,
    code: 'NOT_FOUND',
    message: `Route ${request.method}:${request.url} not found`,
  });
}

/**
 * 异步错误包装器
 */
export function asyncHandler(fn) {
  return async (request, reply) => {
    try {
      return await fn(request, reply);
    } catch (error) {
      reply.send(error);
    }
  };
}
