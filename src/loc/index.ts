/**
 * GDShader 本地化 (i18n) 基础设施
 * 根据 VS Code 当前语言环境自动选择翻译表.
 *
 * 用法: import { loc } from '../loc';
 *       loc('key')  或  loc('key', arg1, arg2)
 *
 * 翻译键中的 {0}, {1} 等占位符会被替换为对应参数.
 */
import { zhCN } from './loc_zh-cn';
import { en } from './loc_en';

/** 翻译表类型: 每个 key 对应一个翻译字符串 */
export type LocaleTable = Record<string, string>;

/** 所有可用的翻译表 */
const LOCALE_TABLES: Record<string, LocaleTable> = {
  'zh-cn': zhCN,
  'zh-tw': zhCN, // 暂时回退到简体
  'en': en,
};

/** 检测 VS Code 语言环境 */
function detectLocale(): string {
  // VS Code 通过环境变量 VSCODE_NLS_CONFIG 传递语言设置
  try {
    const nlsConfig = process.env.VSCODE_NLS_CONFIG;
    if (nlsConfig) {
      const config = JSON.parse(nlsConfig);
      if (config.locale) return config.locale.toLowerCase();
    }
  } catch { /* ignore */ }
  return 'en';
}

const currentLocale = detectLocale();

/** 当前使用的翻译表 (匹配不到则回退到英文) */
const currentTable: LocaleTable =
  LOCALE_TABLES[currentLocale] ??
  LOCALE_TABLES[currentLocale.split('-')[0]] ??
  LOCALE_TABLES['en'] ??
  en;

/**
 * 获取本地化字符串.
 * @param key 翻译键
 * @param args 占位符参数 ({0}, {1}, ...)
 * @returns 翻译后的字符串, 找不到 key 时返回 key 本身
 */
export function loc(key: string, ...args: (string | number)[]): string {
  let text = currentTable[key] ?? en[key] ?? key;
  for (let i = 0; i < args.length; i++) {
    text = text.replace(`{${i}}`, String(args[i]));
  }
  return text;
}

/**
 * 尝试获取本地化字符串. 找不到 key 时返回 null (不 fallback 到 key 自身),
 * 便于调用方判断"是否存在可展示的描述".
 */
export function locOptional(key: string, ...args: (string | number)[]): string | null {
  const text = currentTable[key] ?? en[key];
  if (text === undefined) return null;
  let out = text;
  for (let i = 0; i < args.length; i++) {
    out = out.replace(`{${i}}`, String(args[i]));
  }
  return out;
}
