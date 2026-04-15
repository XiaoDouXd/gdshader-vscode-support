# GDShader Support for VS Code

为 VS Code 提供的 **GDShader** (Godot 着色语言, Godot 4.x) 支持.

## 功能

### 语法高亮
- 完整的 TMLanguage 语法定义, 支持 `.gdshader` 和 `.gdshaderinc` 文件
- 覆盖所有关键字, 类型, 内置变量, 运算符, 注释和预处理指令

### 代码补全
- **上下文感知**的自动补全:
  - `shader_type` 值 (`spatial`, `canvas_item`, `particles`, `sky`, `fog`)
  - `render_mode` 选项 (按着色器类型过滤)
  - Uniform 提示 (附带适用类型和说明)
  - 内置函数 (附带签名和参数 snippet, 按上下文过滤)
  - 内置变量 (按当前处理器函数上下文过滤, **覆盖全部 5 种着色器类型**)
  - GLSL 类型, 关键字和常量
  - Swizzle 分量 (`.xyz`, `.rgb`, `.stpq`)
- 通用后续语法要素匹配 (如 `shader_type ` 后自动提示类型名)

### 语法诊断
- 缺少 `shader_type` 声明检测
- 无效着色器类型校验
- 大括号/圆括号不匹配检测 (含跨行块注释正确处理)
- 缺少分号警告
- **处理器函数约束检查**: 检测不适用于当前着色器类型的处理器函数
- **discard 位置检查**: 确保 `discard` 仅在 `fragment()`/`light()` 中使用
- **内置变量只读检查**: 检测对 `in` 模式内置变量的写入

### 悬停提示
- 内置函数签名和说明 (含上下文限制信息)
- 类型信息
- 内置变量详情 (含访问模式 in/out/inout)
- 常量值 (`PI`, `TAU`, `E` 等)
- Uniform 提示详情 (含适用类型)
- 跨处理器函数上下文的变量提示

### 颜色预览
- `vec3(r, g, b)` 和 `vec4(r, g, b, a)` 值的内联拾色器
- 点击即可可视化编辑颜色

### 代码片段
- 完整着色器模板: `shader_spatial`, `shader_canvas_item`, `shader_particles`, `shader_sky`, `shader_fog`
- Uniform 片段: `uniform_range`, `uniform_color`, `uniform_texture`, `uniform_enum`
- 处理器函数片段: `func_vertex`, `func_fragment`, `func_light` 等

### 格式化
- 基础文档格式化, 自动规范缩进

### 命令
- **GDShader: 插入着色器模板** - 快速选择着色器类型并插入完整模板
- **GDShader: 预览颜色** - 显示光标位置 vec3/vec4 的颜色信息

## 架构

### 数据层 (`src/data/`)

语言数据从代码逻辑中分离, 存放在独立的 TypeScript 数据表文件中:

| 文件 | 内容 |
|---|---|
| `types.ts` | 共用接口和类型定义 |
| `keywords.ts` | 着色器类型, 数据类型, 关键字, 常量 |
| `render-modes.ts` | 各着色器类型的渲染模式 |
| `uniform-hints.ts` | Uniform 提示及其适用类型 |
| `builtin-functions.ts` | 所有内置函数 (含上下文限制) |
| `builtin-vars.ts` | 所有着色器类型的完整内置变量 |
| `syntax-rules.ts` | 语法约束规则, 处理器函数特化, 后续语法匹配 |
| `index.ts` | 统一导出入口 |

**增补数据只需编辑对应的数据表文件, 无需修改 provider 逻辑.**

### 功能层 (`src/providers/`)

| 文件 | 功能 |
|---|---|
| `completionProvider.ts` | 上下文感知代码补全 |
| `hoverProvider.ts` | 悬停提示 |
| `diagnosticsProvider.ts` | 语法诊断 (含语义级检查) |
| `formattingProvider.ts` | 文档格式化 |
| `colorProvider.ts` | 颜色预览/拾色器 |

## 快速开始

1. 打开 `.gdshader` 或 `.gdshaderinc` 文件
2. 插件自动激活
3. 输入时即可看到补全, 悬停符号查看文档

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch

# 在 VS Code 中按 F5 启动 Extension Development Host 进行调试
```

### Godot 参考文档

`__gitignore__godocs/` 目录下存放了 Godot 官方文档副本, 着色器相关的核心参考在:
- `tutorials/shaders/shader_reference/shading_language.rst` - 着色语言完整规范
- `tutorials/shaders/shader_reference/shader_functions.rst` - 内置函数参考
- `tutorials/shaders/shader_reference/spatial_shader.rst` - Spatial 着色器参考
- `tutorials/shaders/shader_reference/canvas_item_shader.rst` - Canvas Item 着色器参考
- `tutorials/shaders/shader_reference/particle_shader.rst` - 粒子着色器参考
- `tutorials/shaders/shader_reference/sky_shader.rst` - 天空着色器参考
- `tutorials/shaders/shader_reference/fog_shader.rst` - 雾效着色器参考

## 支持的文件扩展名

| 扩展名 | 说明 |
|---|---|
| `.gdshader` | GDShader 源文件 |
| `.gdshaderinc` | GDShader 包含文件 |

## 许可证

MIT
