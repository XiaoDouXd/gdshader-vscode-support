# GDShader Hint 注释系统

GDShader Support 插件提供了一组特殊注释标记 (`#gdshader-hint-*`), 用于在 VS Code 环境中增强对 GDShader 文件的分析能力. 这些标记以行注释 (`//`) 或块注释 (`/* */`) 形式书写, 不影响 Godot 引擎的着色器编译.

## 总览

| 标记 | 用途 | 位置 |
|---|---|---|
| `#gdshader-hint-ignore` | 忽略 `#include` 诊断 | `#include` 同行尾部或下一行 |
| `#gdshader-hint-redirection:路径` | 重定向 `res://` include 到本地路径 | `#include` 同行尾部或下一行 |
| `#gdshader-hint-def:定义` | 注入符号定义 (变量/函数) | 任意位置 (通常紧随 `#include` 之后) |
| `#gdshader-hint-type:类型` | 为变量指定类型 | 变量声明的同行或上一行 |

---

## `#gdshader-hint-ignore`

**作用**: 告诉插件忽略当前 `#include` 行的诊断. 用于 `res://` 路径无法在编辑器中解析的场景.

**效果**:
- 移除 `res://` include 行的"置灰" (Unnecessary) 提示
- 移除非 `res://` include 目标不存在时的错误提示
- **不会**将 include 文件的符号纳入补全/悬停上下文

**写法**:

```gdshader
// 写法 1: 同行尾部
#include "res://addons/my_plugin/lib.gdshaderinc" // #gdshader-hint-ignore

// 写法 2: 下一行
#include "res://addons/my_plugin/lib.gdshaderinc"
// #gdshader-hint-ignore

// 写法 3: 块注释
#include "res://addons/my_plugin/lib.gdshaderinc" /* #gdshader-hint-ignore */
```

---

## `#gdshader-hint-redirection:路径`

**作用**: 将 `res://` 路径的 `#include` 重定向到一个本地相对路径. 插件会读取该相对路径对应的文件, 将其中的符号 (函数, 变量, struct, const 等) 注入到当前文件的分析上下文中.

**适用场景**: Godot 项目中使用 `res://` 路径引用 include 文件, 但 VS Code 无法解析 `res://`. 通过 redirection 将其指向同一文件在工作区内的相对路径.

**效果**:
- include 文件中的全局符号可在当前文件中获得补全和悬停提示
- 未定义标识符检查可以正确识别来自 include 文件的符号
- 如果重定向目标文件不存在, 会报错误诊断
- 不再置灰该 `#include` 行

**写法**:

```gdshader
// 写法 1: 同行尾部
#include "res://addons/my_plugin/utils.gdshaderinc" // #gdshader-hint-redirection:./local/utils.gdshaderinc

// 写法 2: 下一行
#include "res://shaders/common.gdshaderinc"
// #gdshader-hint-redirection:../common/common.gdshaderinc
```

路径为相对于当前 `.gdshader` 文件的相对路径, 支持 `./` 和 `../`.

---

## `#gdshader-hint-def:定义`

**作用**: 在当前文件的全局作用域中注入一个符号定义. 用于声明来自外部 (如 `res://` include) 的函数或变量, 使其参与补全, 悬停提示和未定义标识符检查.

**适用场景**: 当无法通过 `#gdshader-hint-redirection` 直接读取 include 文件时, 可以手动声明需要的符号.

**效果**:
- 声明的符号可在补全中出现
- 悬停时显示符号类型和 "通过 #gdshader-hint-def 声明" 标记
- 不会报未定义标识符警告

**写法**:

```gdshader
// 声明一个函数
// #gdshader-hint-def:vec4 my_func(float param1, in vec3 normal);

// 声明一个变量
// #gdshader-hint-def:vec3 imported_color;

// 声明一个常量
// #gdshader-hint-def:float MY_CONSTANT;

// 块注释形式
/* #gdshader-hint-def:float helper(vec3 a) */
```

**函数定义语法**: `返回类型 函数名(参数列表)`
- 参数: `[限定符] 类型 名称`, 多个参数用逗号分隔
- 限定符可选: `in`, `out`, `inout`, `const`

---

## `#gdshader-hint-type:类型`

**作用**: 为前一个变量声明指定类型. 用于插件无法推断变量类型的场景.

**写法**:

```gdshader
// 行注释形式 (下一行的变量)
// #gdshader-hint-type:vec3
float x;

// 块注释形式 (同行的变量)
float x; /* #gdshader-hint-type:mat4 */
```

---

## 组合使用示例

### 场景: Godot 项目中的 include 文件

```gdshader
shader_type spatial;

// 方式 1: 用 redirection 重定向 (推荐, 自动获取所有符号)
#include "res://addons/my_plugin/utils.gdshaderinc" // #gdshader-hint-redirection:./utils.gdshaderinc

// 方式 2: 用 ignore + 手动 def (无法访问实际文件时)
#include "res://addons/remote_lib/lib.gdshaderinc" // #gdshader-hint-ignore
// #gdshader-hint-def:vec4 remote_func(float x, vec3 normal);
// #gdshader-hint-def:float REMOTE_CONSTANT;

void fragment() {
    // 两种方式声明的符号都可以获得补全和悬停提示
    vec4 result = remote_func(1.0, NORMAL);
    ALBEDO = result.rgb;
}
```

### 场景: 本地相对路径 include

```gdshader
shader_type spatial;

// 相对路径 include 无需额外标记, 插件自动解析
#include "utils.gdshaderinc"

void fragment() {
    // utils.gdshaderinc 中的符号自动可用
}
```

---

## 智能提示

在注释中输入 `#gdshader-hint-` 时, 插件会提供所有可用标记的自动补全, 包含说明和 snippet 模板.

## 注意事项

- 所有 `#gdshader-hint-*` 标记仅供 VS Code 插件使用, Godot 引擎会将其视为普通注释, 完全忽略
- `#gdshader-hint-ignore` 与 `#gdshader-hint-redirection` 可以同时存在于同一个 `#include` 上, 此时 ignore 会阻止诊断提示, 但 redirection 仍会加载符号
- `#gdshader-hint-def` 声明的符号不参与重复定义检查 (不会与用户代码冲突)
- 悬停局部变量时, 声明行尾部的行注释内容会被增补到悬停提示中, 但 `#gdshader-hint-*` 部分会自动移除
