/**
 * 管理员服务
 * 处理管理员认证和用户管理
 */

import bcrypt from 'bcrypt';
import prisma from '../config/database.js';

/**
 * 密码加密轮数
 */
const SALT_ROUNDS = 10;

/**
 * 管理员服务类
 */
class AdminService {
  /**
   * 创建管理员用户
   * @param {Object} data - 管理员数据
   * @param {string} data.username - 用户名
   * @param {string} data.password - 密码
   * @param {string} data.email - 邮箱（可选）
   * @param {string} data.role - 角色（默认 admin）
   * @returns {Promise<Object>} 创建的管理员（不含密码）
   */
  async createAdmin({ username, password, email, role = 'admin' }) {
    // 检查用户名是否已存在
    const existingUser = await prisma.adminUser.findUnique({
      where: { username },
    });

    if (existingUser) {
      throw new Error('Username already exists');
    }

    // 如果提供了邮箱，检查是否已存在
    if (email) {
      const existingEmail = await prisma.adminUser.findUnique({
        where: { email },
      });

      if (existingEmail) {
        throw new Error('Email already exists');
      }
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 创建管理员
    const admin = await prisma.adminUser.create({
      data: {
        username,
        passwordHash,
        email,
        role,
      },
    });

    // 移除密码字段
    const { passwordHash: _, ...adminWithoutPassword } = admin;

    return adminWithoutPassword;
  }

  /**
   * 验证管理员登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise<Object>} 管理员信息（不含密码）
   */
  async validateLogin(username, password) {
    // 查找管理员
    const admin = await prisma.adminUser.findUnique({
      where: { username },
    });

    if (!admin) {
      throw new Error('Invalid username or password');
    }

    // 检查是否被禁用
    if (!admin.isActive) {
      throw new Error('Account is disabled');
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, admin.passwordHash);

    if (!isValid) {
      throw new Error('Invalid username or password');
    }

    // 更新最后登录时间
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // 移除密码字段
    const { passwordHash: _, ...adminWithoutPassword } = admin;

    return adminWithoutPassword;
  }

  /**
   * 通过 ID 获取管理员
   * @param {number} id - 管理员 ID
   * @returns {Promise<Object|null>} 管理员信息（不含密码）
   */
  async getAdminById(id) {
    const admin = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!admin) {
      return null;
    }

    const { passwordHash: _, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
  }

  /**
   * 通过用户名获取管理员
   * @param {string} username - 用户名
   * @returns {Promise<Object|null>} 管理员信息（不含密码）
   */
  async getAdminByUsername(username) {
    const admin = await prisma.adminUser.findUnique({
      where: { username },
    });

    if (!admin) {
      return null;
    }

    const { passwordHash: _, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
  }

  /**
   * 获取所有管理员列表
   * @returns {Promise<Array>} 管理员列表（不含密码）
   */
  async getAllAdmins() {
    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return admins.map(({ passwordHash: _, ...admin }) => admin);
  }

  /**
   * 更新管理员信息
   * @param {number} id - 管理员 ID
   * @param {Object} data - 更新数据
   * @returns {Promise<Object>} 更新后的管理员（不含密码）
   */
  async updateAdmin(id, data) {
    const updateData = { ...data };

    // 如果包含密码，加密后再更新
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
      delete updateData.password;
    }

    const admin = await prisma.adminUser.update({
      where: { id },
      data: updateData,
    });

    const { passwordHash: _, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
  }

  /**
   * 删除管理员
   * @param {number} id - 管理员 ID
   */
  async deleteAdmin(id) {
    await prisma.adminUser.delete({
      where: { id },
    });
  }

  /**
   * 更改管理员密码
   * @param {number} id - 管理员 ID
   * @param {string} oldPassword - 旧密码
   * @param {string} newPassword - 新密码
   */
  async changePassword(id, oldPassword, newPassword) {
    const admin = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    // 验证旧密码
    const isValid = await bcrypt.compare(oldPassword, admin.passwordHash);

    if (!isValid) {
      throw new Error('Invalid old password');
    }

    // 加密新密码并更新
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.adminUser.update({
      where: { id },
      data: { passwordHash },
    });
  }

  /**
   * 启用/禁用管理员
   * @param {number} id - 管理员 ID
   * @param {boolean} isActive - 是否启用
   */
  async setActive(id, isActive) {
    await prisma.adminUser.update({
      where: { id },
      data: { isActive },
    });
  }
}

export default new AdminService();
