/**
 * IP 地理位置服务
 * 用于根据用户 IP 识别国家和区域，匹配本地化价格
 */

import geoip from 'geoip-lite';
import config from '../config/env.js';

/**
 * 国家代码与货币的映射关系
 */
const COUNTRY_CURRENCY_MAP = {
  CN: 'CNY', // 中国 - 人民币
  US: 'USD', // 美国 - 美元
  JP: 'JPY', // 日本 - 日元
  KR: 'KRW', // 韩国 - 韩元
  GB: 'GBP', // 英国 - 英镑
  EU: 'EUR', // 欧盟 - 欧元
  HK: 'HKD', // 香港 - 港币
  TW: 'TWD', // 台湾 - 新台币
  SG: 'SGD', // 新加坡 - 新币
  AU: 'AUD', // 澳大利亚 - 澳元
  CA: 'CAD', // 加拿大 - 加元
  // 欧盟国家使用欧元
  DE: 'EUR', // 德国
  FR: 'EUR', // 法国
  IT: 'EUR', // 意大利
  ES: 'EUR', // 西班牙
  NL: 'EUR', // 荷兰
};

/**
 * 默认国家和货币配置
 */
const DEFAULT_COUNTRY = 'US';
const DEFAULT_CURRENCY = 'USD';

/**
 * GeoService 类
 */
class GeoService {
  /**
   * 根据 IP 地址获取地理位置信息
   * @param {string} ip - IP 地址
   * @returns {Object|null} 地理位置信息
   */
  lookup(ip) {
    try {
      // 处理本地 IP 地址
      if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
        return this.getDefaultLocation();
      }

      // 如果是 IPv6 映射的 IPv4 地址 (::ffff:192.168.1.1)
      if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
      }

      // 查询 IP 地理位置
      const geo = geoip.lookup(ip);

      if (!geo) {
        console.warn(`[GeoService] IP lookup failed for: ${ip}`);
        return this.getDefaultLocation();
      }

      return {
        ip,
        country: geo.country, // 国家代码 (如 'CN', 'US')
        region: geo.region,   // 地区
        city: geo.city,       // 城市
        timezone: geo.timezone, // 时区
        ll: geo.ll,           // 经纬度 [latitude, longitude]
        currency: this.getCurrencyByCountry(geo.country),
      };
    } catch (error) {
      console.error('[GeoService] Lookup error:', error);
      return this.getDefaultLocation();
    }
  }

  /**
   * 根据 IP 获取国家代码
   * @param {string} ip - IP 地址
   * @returns {string} 国家代码
   */
  getCountryCode(ip) {
    const location = this.lookup(ip);
    return location ? location.country : DEFAULT_COUNTRY;
  }

  /**
   * 根据 IP 获取货币代码
   * @param {string} ip - IP 地址
   * @returns {string} 货币代码
   */
  getCurrency(ip) {
    const location = this.lookup(ip);
    return location ? location.currency : DEFAULT_CURRENCY;
  }

  /**
   * 根据国家代码获取货币
   * @param {string} countryCode - 国家代码
   * @returns {string} 货币代码
   */
  getCurrencyByCountry(countryCode) {
    return COUNTRY_CURRENCY_MAP[countryCode] || DEFAULT_CURRENCY;
  }

  /**
   * 获取默认位置信息
   * @returns {Object} 默认位置
   */
  getDefaultLocation() {
    return {
      ip: '0.0.0.0',
      country: DEFAULT_COUNTRY,
      region: null,
      city: null,
      timezone: null,
      ll: null,
      currency: DEFAULT_CURRENCY,
    };
  }

  /**
   * 验证 IP 地址格式
   * @param {string} ip - IP 地址
   * @returns {boolean} 是否有效
   */
  isValidIP(ip) {
    if (!ip) return false;

    // IPv4 正则
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 正则 (简化版)
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * 检查是否为内网 IP
   * @param {string} ip - IP 地址
   * @returns {boolean} 是否为内网 IP
   */
  isPrivateIP(ip) {
    if (!ip) return false;

    // 处理 IPv6 映射的 IPv4
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    // 本地地址
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      return true;
    }

    // 私有网络地址段
    const privateRanges = [
      /^10\./,                      // 10.0.0.0 - 10.255.255.255
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0 - 172.31.255.255
      /^192\.168\./,                // 192.168.0.0 - 192.168.255.255
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * 获取所有支持的国家和货币列表
   * @returns {Array} 国家货币列表
   */
  getSupportedCountries() {
    return Object.entries(COUNTRY_CURRENCY_MAP).map(([country, currency]) => ({
      country,
      currency,
    }));
  }

  /**
   * 检查国家是否受支持
   * @param {string} countryCode - 国家代码
   * @returns {boolean} 是否支持
   */
  isCountrySupported(countryCode) {
    return countryCode in COUNTRY_CURRENCY_MAP;
  }
}

// 导出单例
export default new GeoService();
