/**
 * GDShader 格式化核心逻辑 (不依赖 vscode, 便于测试).
 * 基于 Lexer 产出的 token 流计算缩进:
 * - 正确忽略注释/字符串内部的括号
 * - 行尾注释不再干扰括号配对
 * - 多行块/文档注释保留 `*` 对齐 (修复 @param 等文档注释排版)
 * - 预处理器指令续行不被破坏
 */
import { Lexer } from '../parser/lexer';
import { Token, TokenType } from '../parser/token';

/** 单行格式化编辑 (将整行替换为 text) */
export interface FormatEdit {
  line: number;
  text: string;
}

function isCommentType(type: TokenType): boolean {
  return type === TokenType.LineComment
    || type === TokenType.BlockComment
    || type === TokenType.DocComment;
}

function countNewlines(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) n++; // '\n'
  }
  return n;
}

/**
 * 计算格式化编辑.
 * @param source 原始源文本 (用于词法分析)
 * @param lines 各行文本 (不含行尾换行符)
 * @param insertSpaces 是否用空格缩进
 * @param tabSize 缩进宽度
 */
export function computeFormatEdits(
  source: string,
  lines: string[],
  insertSpaces: boolean,
  tabSize: number,
): FormatEdit[] {
  const tabChar = insertSpaces ? ' '.repeat(tabSize) : '\t';
  const lineCount = lines.length;
  const edits: FormatEdit[] = [];

  // 词法分析, 保留注释 token
  const lexer = new Lexer(source, { includeTrivia: true });
  const tokens = lexer.tokenize();

  // 每行的"显著 token" (排除注释), 用于括号配对
  const sigByLine: Token[][] = Array.from({ length: lineCount }, () => []);
  // 多行块注释: 起始行 -> 注释 token
  const blockStarts = new Map<number, Token>();
  // 需跳过格式化的行 (如多行预处理指令的续行)
  const skipLines = new Set<number>();

  for (const t of tokens) {
    if (t.type === TokenType.EOF) continue;
    if (t.line >= lineCount) continue;

    if (!isCommentType(t.type)) {
      sigByLine[t.line].push(t);
    }

    if (t.type === TokenType.BlockComment || t.type === TokenType.DocComment) {
      if (countNewlines(t.value) > 0) {
        blockStarts.set(t.line, t);
      }
    }

    if (t.type === TokenType.Preprocessor) {
      const nl = countNewlines(t.value);
      for (let k = 1; k <= nl; k++) {
        if (t.line + k < lineCount) skipLines.add(t.line + k);
      }
    }
  }

  let indentLevel = 0;

  for (let i = 0; i < lineCount; i++) {
    const text = lines[i];
    const trimmed = text.trim();

    // 空行不处理
    if (trimmed.length === 0) continue;
    // 预处理器续行保留原样
    if (skipLines.has(i)) continue;

    // 多行块/文档注释, 且 /* 位于行首: 整块重新对齐
    const bc = blockStarts.get(i);
    if (bc) {
      const leadingWsLen = text.length - text.trimStart().length;
      if (text.charCodeAt(leadingWsLen) === 47 /* '/' */) {
        const endLine = bc.line + countNewlines(bc.value);
        const indent = tabChar.repeat(indentLevel);

        // 起始行: 保留从 /* 开始的内容
        const openingContent = text.slice(leadingWsLen);
        const expectedOpen = indent + openingContent;
        if (text !== expectedOpen) edits.push({ line: i, text: expectedOpen });

        // 续行: 对齐到 `indent + ' '`, 使 `*` 与 `/**` 的第二个 `*` 对齐
        for (let j = i + 1; j <= endLine; j++) {
          const raw = lines[j];
          const tr = raw.trim();
          if (tr.length === 0) continue; // 块内空行保留
          const content = tr.charCodeAt(0) === 42 /* '*' */
            ? indent + ' ' + tr
            : indent + tr;
          if (raw !== content) edits.push({ line: j, text: content });
        }

        i = endLine;
        continue;
      }
    }

    // 普通行: 基于 token 计算缩进
    const sigs = sigByLine[i];
    const firstSig = sigs.length > 0 ? sigs[0] : undefined;
    const lastSig = sigs.length > 0 ? sigs[sigs.length - 1] : undefined;

    // 本行应放置的缩进层级. 行首为 } 时回退一级 (闭括号与开括号同层)
    let lineIndent = indentLevel;
    if (firstSig && firstSig.type === TokenType.RBrace) {
      lineIndent = Math.max(0, indentLevel - 1);
    }

    const expectedIndent = tabChar.repeat(lineIndent);
    const expectedLine = expectedIndent + trimmed;
    if (text !== expectedLine) {
      edits.push({ line: i, text: expectedLine });
    }

    // 行尾为 { 时提升缩进 (供后续行). 同时正确处理 } else { (净变化 0, 行本身在外层)
    if (lastSig && lastSig.type === TokenType.LBrace) {
      indentLevel = lineIndent + 1;
    } else {
      indentLevel = lineIndent;
    }
  }

  return edits;
}
