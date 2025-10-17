/**
 * 加密工具模块
 * 用于密钥的加密存储和解密
 * 算法: AES-256-GCM
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 初始化向量长度
const SALT_LENGTH = 64; // 盐值长度
const TAG_LENGTH = 16; // 认证标签长度
const KEY_LENGTH = 32; // 密钥长度 (256 bits)

/**
 * 从环境变量中获取加密密钥
 * @returns {Buffer} 32字节的密钥
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // 如果密钥是十六进制字符串,转换为 Buffer
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }

  // 否则使用 scrypt 派生密钥
  return crypto.scryptSync(key, 'salt', KEY_LENGTH);
}

/**
 * 加密文本
 * @param {string} text - 要加密的明文
 * @returns {string} 加密后的文本 (格式: iv:encryptedData:authTag, Base64���码)
 */
export function encrypt(text) {
  try {
    const key = getEncryptionKey();

    // 生成随机初始化向量
    const iv = crypto.randomBytes(IV_LENGTH);

    // 创建加密器
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // 加密数据
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 获取认证标签
    const authTag = cipher.getAuthTag();

    // 组合: iv + encrypted + authTag (使用 Base64 编码)
    const result = Buffer.concat([
      iv,
      Buffer.from(encrypted, 'hex'),
      authTag
    ]).toString('base64');

    return result;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * 解密文本
 * @param {string} encryptedText - 加密的文本 (Base64编码)
 * @returns {string} 解密后的明文
 */
export function decrypt(encryptedText) {
  try {
    const key = getEncryptionKey();

    // 将 Base64 字符串转换为 Buffer
    const buffer = Buffer.from(encryptedText, 'base64');

    // 提取 IV, 加密数据, 认证标签
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(buffer.length - TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH, buffer.length - TAG_LENGTH);

    // 创建解密器
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // 解密数据
    let decrypted = decipher.update(encrypted, 'binary', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * 生成随机密钥 (用于初始化 ENCRYPTION_KEY)
 * @returns {string} 32字节的十六进制密钥
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * 哈希密码 (用于管理员密码)
 * @param {string} password - 明文密码
 * @returns {Promise<string>} 哈希后的密码
 */
export async function hashPassword(password) {
  const bcrypt = await import('bcrypt');
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * 验证密码
 * @param {string} password - 明文密码
 * @param {string} hash - 哈希值
 * @returns {Promise<boolean>} 是否匹配
 */
export async function verifyPassword(password, hash) {
  const bcrypt = await import('bcrypt');
  return bcrypt.compare(password, hash);
}

/**
 * 生成随机字符串
 * @param {number} length - 长度
 * @returns {string} 随机字符串
 */
export function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * 生成6位数字验证码
 * @returns {string} 6位数字验证码
 */
export function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 测试示例 (仅供开发环境使用)
if (process.env.NODE_ENV === 'development' && import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Encryption Test ===');

  // 设置测试密钥
  process.env.ENCRYPTION_KEY = generateEncryptionKey();
  console.log('Generated Key:', process.env.ENCRYPTION_KEY);

  const plainText = 'XXXXX-XXXXX-XXXXX-XXXXX';
  console.log('Plain Text:', plainText);

  const encrypted = encrypt(plainText);
  console.log('Encrypted:', encrypted);

  const decrypted = decrypt(encrypted);
  console.log('Decrypted:', decrypted);

  console.log('Match:', plainText === decrypted);

  console.log('\n=== Verification Code Test ===');
  console.log('Code:', generateVerificationCode());
}
