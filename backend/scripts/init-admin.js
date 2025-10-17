/**
 * 初始化管理员脚本
 * 创建第一个超级管理员账号
 */

import readline from 'readline';
import adminService from '../src/services/admin.service.js';
import prisma from '../src/config/database.js';

// 创建命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * 询问问题并获取答案
 */
function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('\n🔧 管理员账号初始化\n');
  console.log('这将创建一个超级管理员账号。\n');

  try {
    // 检查是否已有管理员
    const existingAdmins = await adminService.getAllAdmins();

    if (existingAdmins.length > 0) {
      console.log('⚠️  警告: 已存在以下管理员账号：');
      existingAdmins.forEach((admin) => {
        console.log(`   - ${admin.username} (${admin.role})`);
      });
      console.log('');

      const confirm = await question('是否继续创建新管理员？ (yes/no): ');

      if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
        console.log('\n❌ 已取消\n');
        rl.close();
        await prisma.$disconnect();
        return;
      }
      console.log('');
    }

    // 获取用户输入
    const username = await question('请输入用户名 (3-50个字符): ');

    if (!username || username.length < 3 || username.length > 50) {
      throw new Error('用户名必须在 3-50 个字符之间');
    }

    const password = await question('请输入密码 (最少6个字符): ');

    if (!password || password.length < 6) {
      throw new Error('密码最少需要 6 个字符');
    }

    const email = await question('请输入邮箱 (可选，直接回车跳过): ');

    const emailValue = email.trim() || null;

    // 创建管理员
    console.log('\n⏳ 正在创建管理员...\n');

    const admin = await adminService.createAdmin({
      username,
      password,
      email: emailValue,
      role: 'super_admin',
    });

    console.log('✅ 管理员创建成功！\n');
    console.log('账号信息：');
    console.log(`   - ID: ${admin.id}`);
    console.log(`   - 用户名: ${admin.username}`);
    console.log(`   - 邮箱: ${admin.email || '(未设置)'}`);
    console.log(`   - 角色: ${admin.role}`);
    console.log(`   - 创建时间: ${admin.createdAt}`);
    console.log('');
    console.log('📝 请妥善保管管理员账号和密码！');
    console.log('');
  } catch (error) {
    console.error('\n❌ 创建失败:', error.message);
    console.log('');
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// 运行脚本
main();
