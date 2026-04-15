/**
 * GDShader 词法分析器 (Lexer)
 * 将源文本切分为 Token 流. 正确处理注释, 预处理器指令, 数值字面量等.
 */
import { Token, TokenType, KEYWORD_MAP } from './token';
import { loc } from '../loc';

export interface LexerDiagnostic {
  line: number;
  column: number;
  length: number;
  message: string;
}

export class Lexer {
  private source: string;
  private pos = 0;
  private line = 0;
  private column = 0;
  private tokens: Token[] = [];
  readonly diagnostics: LexerDiagnostic[] = [];

  constructor(source: string) {
    this.source = source;
  }

  /** 执行词法分析, 返回 token 列表 (不含注释/空白, 但含 Preprocessor) */
  tokenize(): Token[] {
    this.tokens = [];
    this.pos = 0;
    this.line = 0;
    this.column = 0;
    this.diagnostics.length = 0;

    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos];

      // 预处理器: 行首 # (忽略前导空白)
      if (ch === '#') {
        this.readPreprocessor();
        continue;
      }

      // 注释
      if (ch === '/' && this.pos + 1 < this.source.length) {
        const next = this.source[this.pos + 1];
        if (next === '/') { this.readLineComment(); continue; }
        if (next === '*') { this.readBlockComment(); continue; }
      }

      // 数字
      if (ch >= '0' && ch <= '9') {
        this.readNumber();
        continue;
      }
      // .123 形式的浮点数
      if (ch === '.' && this.pos + 1 < this.source.length &&
        this.source[this.pos + 1] >= '0' && this.source[this.pos + 1] <= '9') {
        this.readNumber();
        continue;
      }

      // 标识符 / 关键字
      if (this.isIdentStart(ch)) {
        this.readIdentifier();
        continue;
      }

      // 字符串 (仅用于 #include, 但也可能出现在 hint_enum 中)
      if (ch === '"') {
        this.readString();
        continue;
      }

      // 运算符和标点
      if (this.readOperatorOrPunct()) {
        continue;
      }

      // 未知字符
      this.addToken(TokenType.Error, 1);
      this.diagnostics.push({
        line: this.line, column: this.column - 1,
        length: 1, message: loc('lexer.unknownChar', ch),
      });
    }

    // EOF
    this.tokens.push({
      type: TokenType.EOF, value: '',
      line: this.line, column: this.column,
      offset: this.pos, length: 0,
    });

    return this.tokens;
  }

  // ─── 内部方法 ───

  private peek(offset = 0): string {
    return this.source[this.pos + offset] ?? '\0';
  }

  private advance(): string {
    const ch = this.source[this.pos];
    if (ch === '\n') {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }
    this.pos++;
    return ch;
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private addToken(type: TokenType, length: number): void {
    const startOffset = this.pos;
    const startLine = this.line;
    const startCol = this.column;
    const value = this.source.substring(this.pos, this.pos + length);
    for (let i = 0; i < length; i++) {
      this.advance();
    }
    this.tokens.push({
      type, value,
      line: startLine, column: startCol,
      offset: startOffset, length,
    });
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private isIdentChar(ch: string): boolean {
    return this.isIdentStart(ch) || (ch >= '0' && ch <= '9');
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isHexDigit(ch: string): boolean {
    return this.isDigit(ch) || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
  }

  // ─── 读取器 ───

  private readPreprocessor(): void {
    const startOffset = this.pos;
    const startLine = this.line;
    const startCol = this.column;
    // 读到行末 (处理续行符 \)
    while (this.pos < this.source.length) {
      if (this.source[this.pos] === '\n') {
        // 检查前一个非空字符是否为 \
        if (this.pos > 0 && this.source[this.pos - 1] === '\\') {
          this.advance(); // 跳过换行, 继续读
          continue;
        }
        break;
      }
      this.advance();
    }
    const value = this.source.substring(startOffset, this.pos);
    this.tokens.push({
      type: TokenType.Preprocessor, value,
      line: startLine, column: startCol,
      offset: startOffset, length: this.pos - startOffset,
    });
  }

  private readLineComment(): void {
    // 跳过 // 注释, 不产出 token
    while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
      this.advance();
    }
  }

  private readBlockComment(): void {
    const startLine = this.line;
    const startCol = this.column;
    // 跳过 /*
    this.advance(); // /
    this.advance(); // *
    let isDoc = false;
    if (this.pos < this.source.length && this.source[this.pos] === '*') {
      isDoc = true;
    }
    while (this.pos < this.source.length) {
      if (this.source[this.pos] === '*' && this.peek(1) === '/') {
        this.advance(); // *
        this.advance(); // /
        return;
      }
      this.advance();
    }
    // 未闭合的块注释
    this.diagnostics.push({
      line: startLine, column: startCol,
      length: 2, message: loc('lexer.unclosedBlockComment'),
    });
  }

  private readIdentifier(): void {
    const startOffset = this.pos;
    const startLine = this.line;
    const startCol = this.column;
    while (this.pos < this.source.length && this.isIdentChar(this.source[this.pos])) {
      this.advance();
    }
    const value = this.source.substring(startOffset, this.pos);
    const kwType = KEYWORD_MAP[value];
    // true/false 作为 BoolLiteral
    let type: TokenType;
    if (value === 'true' || value === 'false') {
      type = TokenType.BoolLiteral;
    } else {
      type = kwType ?? TokenType.Identifier;
    }
    this.tokens.push({
      type, value,
      line: startLine, column: startCol,
      offset: startOffset, length: this.pos - startOffset,
    });
  }

  private readNumber(): void {
    const startOffset = this.pos;
    const startLine = this.line;
    const startCol = this.column;
    let isFloat = false;
    let isUint = false;

    // 十六进制
    if (this.peek() === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
      this.advance(); this.advance(); // 0x
      while (this.pos < this.source.length && this.isHexDigit(this.source[this.pos])) {
        this.advance();
      }
      if (this.pos < this.source.length && (this.source[this.pos] === 'u' || this.source[this.pos] === 'U')) {
        isUint = true;
        this.advance();
      }
      const value = this.source.substring(startOffset, this.pos);
      this.tokens.push({
        type: isUint ? TokenType.UintLiteral : TokenType.IntLiteral,
        value, line: startLine, column: startCol,
        offset: startOffset, length: this.pos - startOffset,
      });
      return;
    }

    // 十进制整数或浮点数
    while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
      this.advance();
    }

    // 小数部分
    if (this.pos < this.source.length && this.source[this.pos] === '.' &&
      this.pos + 1 < this.source.length && this.isDigit(this.source[this.pos + 1])) {
      isFloat = true;
      this.advance(); // .
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
        this.advance();
      }
    } else if (this.pos < this.source.length && this.source[this.pos] === '.' &&
      // 处理 1. 形式 (数字后面直接跟点, 且后面不是标识符字符)
      (this.pos + 1 >= this.source.length || !this.isIdentStart(this.source[this.pos + 1]))) {
      isFloat = true;
      this.advance(); // .
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
        this.advance();
      }
    }

    // 科学计数法
    if (this.pos < this.source.length && (this.source[this.pos] === 'e' || this.source[this.pos] === 'E')) {
      isFloat = true;
      this.advance();
      if (this.pos < this.source.length && (this.source[this.pos] === '+' || this.source[this.pos] === '-')) {
        this.advance();
      }
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
        this.advance();
      }
    }

    // 后缀
    if (this.pos < this.source.length) {
      if (this.source[this.pos] === 'f' || this.source[this.pos] === 'F') {
        isFloat = true;
        this.advance();
      } else if (!isFloat && (this.source[this.pos] === 'u' || this.source[this.pos] === 'U')) {
        isUint = true;
        this.advance();
      }
    }

    const value = this.source.substring(startOffset, this.pos);
    let type: TokenType;
    if (isFloat) type = TokenType.FloatLiteral;
    else if (isUint) type = TokenType.UintLiteral;
    else type = TokenType.IntLiteral;

    this.tokens.push({
      type, value,
      line: startLine, column: startCol,
      offset: startOffset, length: this.pos - startOffset,
    });
  }

  private readString(): void {
    const startOffset = this.pos;
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // 跳过开头 "
    while (this.pos < this.source.length && this.source[this.pos] !== '"' && this.source[this.pos] !== '\n') {
      if (this.source[this.pos] === '\\') this.advance(); // 转义
      this.advance();
    }
    if (this.pos < this.source.length && this.source[this.pos] === '"') {
      this.advance();
    } else {
      this.diagnostics.push({
        line: startLine, column: startCol,
        length: this.pos - startOffset, message: loc('lexer.unclosedString'),
      });
    }
    const value = this.source.substring(startOffset, this.pos);
    this.tokens.push({
      type: TokenType.StringLiteral, value,
      line: startLine, column: startCol,
      offset: startOffset, length: this.pos - startOffset,
    });
  }

  private readOperatorOrPunct(): boolean {
    const ch = this.peek();
    const ch2 = this.peek(1);
    const ch3 = this.peek(2);

    // 三字符运算符
    if (ch === '<' && ch2 === '<' && ch3 === '=') { this.addToken(TokenType.LShiftAssign, 3); return true; }
    if (ch === '>' && ch2 === '>' && ch3 === '=') { this.addToken(TokenType.RShiftAssign, 3); return true; }

    // 双字符运算符
    if (ch === '=' && ch2 === '=') { this.addToken(TokenType.EqualEqual, 2); return true; }
    if (ch === '!' && ch2 === '=') { this.addToken(TokenType.BangEqual, 2); return true; }
    if (ch === '<' && ch2 === '=') { this.addToken(TokenType.LessEqual, 2); return true; }
    if (ch === '>' && ch2 === '=') { this.addToken(TokenType.GreaterEqual, 2); return true; }
    if (ch === '<' && ch2 === '<') { this.addToken(TokenType.LShift, 2); return true; }
    if (ch === '>' && ch2 === '>') { this.addToken(TokenType.RShift, 2); return true; }
    if (ch === '&' && ch2 === '&') { this.addToken(TokenType.AmpAmp, 2); return true; }
    if (ch === '|' && ch2 === '|') { this.addToken(TokenType.PipePipe, 2); return true; }
    if (ch === '+' && ch2 === '+') { this.addToken(TokenType.PlusPlus, 2); return true; }
    if (ch === '-' && ch2 === '-') { this.addToken(TokenType.MinusMinus, 2); return true; }
    if (ch === '+' && ch2 === '=') { this.addToken(TokenType.PlusAssign, 2); return true; }
    if (ch === '-' && ch2 === '=') { this.addToken(TokenType.MinusAssign, 2); return true; }
    if (ch === '*' && ch2 === '=') { this.addToken(TokenType.StarAssign, 2); return true; }
    if (ch === '/' && ch2 === '=') { this.addToken(TokenType.SlashAssign, 2); return true; }
    if (ch === '%' && ch2 === '=') { this.addToken(TokenType.PercentAssign, 2); return true; }
    if (ch === '&' && ch2 === '=') { this.addToken(TokenType.AmpAssign, 2); return true; }
    if (ch === '|' && ch2 === '=') { this.addToken(TokenType.PipeAssign, 2); return true; }
    if (ch === '^' && ch2 === '=') { this.addToken(TokenType.CaretAssign, 2); return true; }

    // 单字符
    const singleMap: Record<string, TokenType> = {
      '=': TokenType.Assign, '!': TokenType.Bang,
      '<': TokenType.Less, '>': TokenType.Greater,
      '+': TokenType.Plus, '-': TokenType.Minus,
      '*': TokenType.Star, '/': TokenType.Slash, '%': TokenType.Percent,
      '&': TokenType.Amp, '|': TokenType.Pipe, '^': TokenType.Caret, '~': TokenType.Tilde,
      '?': TokenType.Question, ':': TokenType.Colon,
      ';': TokenType.Semicolon, ',': TokenType.Comma, '.': TokenType.Dot,
      '(': TokenType.LParen, ')': TokenType.RParen,
      '{': TokenType.LBrace, '}': TokenType.RBrace,
      '[': TokenType.LBracket, ']': TokenType.RBracket,
    };

    const singleType = singleMap[ch];
    if (singleType !== undefined) {
      this.addToken(singleType, 1);
      return true;
    }

    return false;
  }
}
