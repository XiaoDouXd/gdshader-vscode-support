# 代码风格规范

## 语言

- 标点符号一律使用**半角**(英文标点), 例如: `,` `.` `(` `)` `:` `;` `!` `?`
- 不使用全角标点, 如 `，` `。` `（` `）` `：` `；` `！` `？`

## 示例

```
// 正确: 这是一个注释, 用半角标点.
// 错误: 这是一个注释，用全角标点。
```

## 命名

- 文件名: kebab-case, 如 `completion-provider.ts`
- 类名: PascalCase, 如 `GDShaderCompletionProvider`
- 函数/变量: camelCase, 如 `detectShaderType`
- 常量: UPPER_SNAKE_CASE, 如 `SHADER_TYPES`

## TypeScript

- 使用 `strict` 模式
- 优先使用 `const`, 其次 `let`, 禁止 `var`
- 导出的函数/类必须添加 JSDoc 中文注释
- 文件头部添加简短的模块说明注释

## 格式化

- 缩进: 2 空格(跟随项目 tsconfig/editorconfig)
- 行尾: LF
- 文件末尾保留一个空行
- 单行最大长度: 120 字符
