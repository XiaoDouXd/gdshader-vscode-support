/**
 * GDShader Hint 注释扫描器
 *
 * 从源码中提取以下特殊注释:
 * - `// #gdshader-hint-ignore`        — 紧跟在 #include 后, 表示忽略该 include 的"置灰"
 * - `// #gdshader-hint-redirection:./path` — 紧跟在 res:// #include 后, 将其重定向到相对路径
 * - `// #gdshader-hint-type:vec3`     — 为前一个变量声明指定类型 (any → vec3)
 * - `/* #gdshader-hint-type:vec3 *​/`  — 同上, 块注释版
 * - `// #gdshader-hint-declare:vec4 func(float p1, in float x);` — 注入一个符号定义到当前作用域
 * - `// #gdshader-hint-define:NAME` 或 `// #gdshader-hint-define:NAME(a,b) body` — 声明一个宏符号
 *
 * 同时提取所有 #include 指令的信息以及 #define/#ifdef/#if 等预处理块.
 * 注: `#gdshader-hint-def` 是旧名称, 仍然被支持 (等价于 #gdshader-hint-declare).
 */

export interface IncludeInfo {
  line: number;       // 0-based
  path: string;       // include 路径, 如 "res://shaders/utils.gdshaderinc"
  isResPath: boolean; // 是否为 res:// 路径
  isIgnored: boolean; // 是否被 #gdshader-hint-ignore 注释
  /** res:// 路径重定向: 通过 #gdshader-hint-redirection 指定的相对路径 */
  redirectPath?: string;
}

export interface HintTypeDef {
  line: number;
  typeName: string;
}

export interface MacroDef {
  /** 宏名 */
  name: string;
  /** 所在行 (0-based) */
  line: number;
  /** 是否为函数式宏 (#define FOO(x) ...) */
  isFunction: boolean;
  /** 函数式宏的参数名列表 */
  parameters?: string[];
  /** 宏体 (已处理续行符, 单行化) */
  body: string;
  /** 宏的来源 */
  origin?: 'define' | 'hint';
}

export interface HintDef {
  line: number;
  /** 原始定义文本, 如 'vec4 func(float p1, in float x)' */
  raw: string;
  /** 解析后的名称 */
  name: string;
  /** 解析后的类型 */
  typeName: string;
  /** 是否是函数 */
  isFunction: boolean;
  /** 函数签名 (如有) */
  signature?: string;
  /** 函数参数 (如有) */
  parameters?: { name: string; typeName: string; qualifier: string }[];
}

/** 条件预处理块 (#ifdef / #ifndef / #if / #elif / #else / #endif) */
export interface ConditionalBlock {
  /** 条件指令: 'ifdef' | 'ifndef' | 'if' | 'elif' | 'else' | 'endif' */
  kind: 'ifdef' | 'ifndef' | 'if' | 'elif' | 'else' | 'endif';
  /** 所在行 (0-based) */
  line: number;
  /** 条件表达式文本 (如 `DEBUG`, `defined(X) && !Y`), endif/else 为空 */
  condition: string;
  /** 嵌套深度 (0-based, #ifdef 处于 0 表示最外层) */
  depth: number;
  /** 与开头 `#if`/`#ifdef`/`#ifndef` 配对的起始行; 对于起始自身等于 line */
  openLine: number;
  /** 若能配对, 与之配对的 `#endif` 行 */
  endifLine?: number;
}

export interface HintScanResult {
  includes: IncludeInfo[];
  typeHints: HintTypeDef[];
  defHints: HintDef[];
  /** 由 #define 或 #gdshader-hint-define 声明的宏 */
  macros: MacroDef[];
  /** 条件编译块信息 (用于诊断配对/着色) */
  conditionals: ConditionalBlock[];
  /** 是否存在未 ignored 的 res:// include */
  hasUnresolvedResIncludes: boolean;
}

/**
 * 扫描源文本, 提取所有 hint 注释和 #include 信息.
 * 这是一个纯文本扫描, 不依赖 Lexer/Parser.
 */
export function scanHints(source: string): HintScanResult {
  const lines = source.split('\n');
  const includes: IncludeInfo[] = [];
  const typeHints: HintTypeDef[] = [];
  const defHints: HintDef[] = [];
  const macros: MacroDef[] = [];
  const conditionals: ConditionalBlock[] = [];
  /** 未配对的 #if/#ifdef/#ifndef 栈, 栈元素为 conditionals 数组中的索引 */
  const openStack: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.replace(/\r$/, '');
    const trimmed = line.trim();

    // ── #define 检测 (支持多行续行 \) ──
    const defineMatch = trimmed.match(/^#\s*define\s+(\w+)(.*)$/);
    if (defineMatch) {
      const macroName = defineMatch[1];
      let rest = defineMatch[2];
      const startLine = i;
      // 收集续行
      while (rest.replace(/\r$/, '').endsWith('\\') && i + 1 < lines.length) {
        // 去掉末尾的 \ (以及可能的 \r), 再拼上下一行
        rest = rest.replace(/\\\s*\r?$/, ' ');
        i++;
        rest += lines[i].replace(/\r$/, '');
      }
      rest = rest.replace(/\r$/, '').trim();

      // 函数式宏: #define NAME(a, b) ...
      // 仅当 rest 以 "(" 开头 (表示 `NAME` 与 `(` 之间无空格) 时才视为函数式宏
      let isFunction = false;
      let parameters: string[] | undefined;
      let body = rest;
      if (rest.startsWith('(')) {
        const paramEnd = rest.indexOf(')');
        if (paramEnd > 0) {
          isFunction = true;
          parameters = rest.substring(1, paramEnd).split(',').map(p => p.trim()).filter(p => p);
          body = rest.substring(paramEnd + 1).trim();
        }
      }
      macros.push({ name: macroName, line: startLine, isFunction, parameters, body, origin: 'define' });
      continue;
    }

    // ── #ifdef / #ifndef / #if / #elif / #else / #endif ──
    const condMatch = trimmed.match(/^#\s*(ifdef|ifndef|if|elif|else|endif)\b(.*)$/);
    if (condMatch) {
      const kind = condMatch[1] as ConditionalBlock['kind'];
      // 条件表达式文本, 去掉可能的行内注释
      let condExpr = condMatch[2].replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').trim();
      if (kind === 'else' || kind === 'endif') condExpr = '';

      const depth = openStack.length;
      const block: ConditionalBlock = {
        kind, line: i, condition: condExpr,
        depth: kind === 'endif' ? Math.max(0, depth - 1) : (kind === 'elif' || kind === 'else' ? Math.max(0, depth - 1) : depth),
        openLine: i,
      };
      if (kind === 'ifdef' || kind === 'ifndef' || kind === 'if') {
        openStack.push(conditionals.length);
      } else if (kind === 'elif' || kind === 'else') {
        // 关联到最近的开头
        if (openStack.length > 0) {
          block.openLine = conditionals[openStack[openStack.length - 1]].line;
        }
      } else if (kind === 'endif') {
        const openIdx = openStack.pop();
        if (openIdx !== undefined) {
          block.openLine = conditionals[openIdx].line;
          conditionals[openIdx].endifLine = i;
        }
      }
      conditionals.push(block);
      continue;
    }

    // ── #include 检测 ──
    const includeMatch = trimmed.match(/^#include\s+"([^"]+)"/);
    if (includeMatch) {
      const path = includeMatch[1];
      const isResPath = path.startsWith('res://');
      // 检查同行或下一行是否有 #gdshader-hint-ignore
      const isIgnored = hasIgnoreHint(line, lines[i + 1]);
      // 检查同行或下一行是否有 #gdshader-hint-redirection
      const redirectPath = findRedirectionHint(line, lines[i + 1]);
      includes.push({ line: i, path, isResPath, isIgnored, redirectPath });
      continue;
    }

    // ── // #gdshader-hint-type:TYPE ──
    const lineTypeMatch = trimmed.match(/\/\/\s*#gdshader-hint-type\s*:\s*(\w+)/);
    if (lineTypeMatch) {
      typeHints.push({ line: i, typeName: lineTypeMatch[1] });
      continue;
    }

    // ── /* #gdshader-hint-type:TYPE */ (可能在行内) ──
    const blockTypeMatch = line.match(/\/\*\s*#gdshader-hint-type\s*:\s*(\w+)\s*\*\//);
    if (blockTypeMatch) {
      typeHints.push({ line: i, typeName: blockTypeMatch[1] });
      // 不 continue — 同一行可能还有其他内容
    }

    // ── // #gdshader-hint-define:NAME[(args)] [body] 或 /* ... */ ──
    const lineDefineMatch = trimmed.match(/\/\/\s*#gdshader-hint-define\s*:\s*(.+)/);
    if (lineDefineMatch) {
      const m = parseHintDefine(lineDefineMatch[1].trim(), i);
      if (m) macros.push(m);
      continue;
    }
    const blockDefineMatch = line.match(/\/\*\s*#gdshader-hint-define\s*:\s*(.+?)\s*\*\//);
    if (blockDefineMatch) {
      const m = parseHintDefine(blockDefineMatch[1].trim(), i);
      if (m) macros.push(m);
      // 不 continue
    }

    // ── // #gdshader-hint-declare:DEFINITION (也兼容旧的 #gdshader-hint-def) ──
    const defMatch = trimmed.match(/\/\/\s*#gdshader-hint-(?:declare|def)\s*:\s*(.+)/);
    if (defMatch) {
      const parsed = parseDefHint(defMatch[1].trim(), i);
      if (parsed) defHints.push(parsed);
      continue;
    }

    // ── /* #gdshader-hint-declare:DEFINITION */ (也兼容旧的 #gdshader-hint-def) ──
    const blockDefMatch = line.match(/\/\*\s*#gdshader-hint-(?:declare|def)\s*:\s*(.+?)\s*\*\//);
    if (blockDefMatch) {
      const parsed = parseDefHint(blockDefMatch[1].trim(), i);
      if (parsed) defHints.push(parsed);
    }
  }

  const hasUnresolvedResIncludes = includes.some(inc => inc.isResPath && !inc.isIgnored && !inc.redirectPath);

  return { includes, typeHints, defHints, macros, conditionals, hasUnresolvedResIncludes };
}

/** 检查同行尾部或下一行是否有 #gdshader-hint-ignore */
function hasIgnoreHint(currentLine: string, nextLine?: string): boolean {
  if (/\/\/\s*#gdshader-hint-ignore/.test(currentLine)) return true;
  if (/\/\*\s*#gdshader-hint-ignore\s*\*\//.test(currentLine)) return true;
  if (nextLine) {
    const nextTrimmed = nextLine.trim();
    if (/^\/\/\s*#gdshader-hint-ignore/.test(nextTrimmed)) return true;
    if (/^\/\*\s*#gdshader-hint-ignore\s*\*\//.test(nextTrimmed)) return true;
  }
  return false;
}

/** 检查同行尾部或下一行是否有 #gdshader-hint-redirection:path */
function findRedirectionHint(currentLine: string, nextLine?: string): string | undefined {
  const pattern = /#gdshader-hint-redirection\s*:\s*(\S+)/;
  const m1 = currentLine.match(pattern);
  if (m1) return m1[1];
  if (nextLine) {
    const m2 = nextLine.match(pattern);
    if (m2) return m2[1];
  }
  return undefined;
}

/**
 * 解析 #gdshader-hint-define 的内容.
 * 支持:
 *   NAME
 *   NAME body text
 *   NAME(a, b) body text
 */
function parseHintDefine(raw: string, line: number): MacroDef | null {
  // 先匹配 NAME
  const nameMatch = raw.match(/^(\w+)(.*)$/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  let rest = nameMatch[2];

  // 函数式: 名称后紧跟 `(`
  let isFunction = false;
  let parameters: string[] | undefined;
  let body = rest.trim();
  if (rest.startsWith('(')) {
    const paramEnd = rest.indexOf(')');
    if (paramEnd > 0) {
      isFunction = true;
      parameters = rest.substring(1, paramEnd).split(',').map(p => p.trim()).filter(p => p);
      body = rest.substring(paramEnd + 1).trim();
    }
  }
  return { name, line, isFunction, parameters, body, origin: 'hint' };
}

/**
 * 解析 #gdshader-hint-def 的定义内容.
 * 支持:
 *   vec4 func(float p1, in float x);
 *   float my_var;
 *   mat4 MY_CONST;
 */
function parseDefHint(raw: string, line: number): HintDef | null {
  // 去掉末尾分号
  const cleaned = raw.replace(/;\s*$/, '').trim();

  // 尝试匹配函数: TYPE NAME(PARAMS)
  const fnMatch = cleaned.match(/^(\w+)\s+(\w+)\s*\(([^)]*)\)/);
  if (fnMatch) {
    const typeName = fnMatch[1];
    const name = fnMatch[2];
    const paramsStr = fnMatch[3].trim();
    const parameters = paramsStr ? parseParams(paramsStr) : [];
    const signature = `${typeName} ${name}(${paramsStr})`;
    return { line, raw: cleaned, name, typeName, isFunction: true, signature, parameters };
  }

  // 尝试匹配变量: TYPE NAME
  const varMatch = cleaned.match(/^(\w+)\s+(\w+)/);
  if (varMatch) {
    return { line, raw: cleaned, name: varMatch[2], typeName: varMatch[1], isFunction: false };
  }

  return null;
}

function parseParams(paramsStr: string): { name: string; typeName: string; qualifier: string }[] {
  return paramsStr.split(',').map(p => {
    const parts = p.trim().split(/\s+/);
    if (parts.length >= 3) {
      // qualifier type name  或  qualifier1 qualifier2 type name...
      // 简化: 最后一个是 name, 倒数第二个是 type, 其余是 qualifier
      const name = parts[parts.length - 1];
      const typeName = parts[parts.length - 2];
      const qualifier = parts.slice(0, -2).join(' ');
      return { name, typeName, qualifier };
    } else if (parts.length === 2) {
      return { name: parts[1], typeName: parts[0], qualifier: '' };
    } else {
      return { name: parts[0], typeName: 'any', qualifier: '' };
    }
  });
}
