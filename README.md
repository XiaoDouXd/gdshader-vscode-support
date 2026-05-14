# GDShader Support for VS Code

![img1](./docs/img/img1.png)

![img2](./docs/img/img2.png)

![img3](./docs/img/img3.png)

![img4](./docs/img/img4.png)

---

## ✨ Feature Overview

This extension provides comprehensive editor support for **Godot 4.x**'s GDShader language, covering the full development experience from syntax highlighting to semantic-level diagnostics.

### 🎨 Syntax Highlighting

- Full TMLanguage grammar definition for `.gdshader` and `.gdshaderinc` files
- Coverage of all keywords, types, built-in variables, operators, comments, and preprocessor directives

### 💡 Intelligent Code Completion

A **context-aware** auto-completion system:

| Category | Details |
|---|---|
| `shader_type` values | `spatial`, `canvas_item`, `particles`, `sky`, `fog` |
| `render_mode` options | Automatically filtered by current shader type |
| Uniform hints | With applicable types and descriptions |
| Built-in functions | With signatures and parameter snippets, context-filtered |
| Built-in variables | Covers **all 5 shader types**, filtered by processor function context |
| Swizzle components | `.xyz`, `.rgb`, `.stpq`, etc. |
| GLSL types & constants | Full type, keyword, and constant support |

Also supports general follow-up syntax matching (e.g., typing `shader_type ` triggers type name suggestions).

### 🔍 Semantic Diagnostics

Provides **semantic-level** diagnostics beyond plain text checks:

- Missing `shader_type` declaration detection & invalid shader type validation
- Mismatched braces/parentheses detection (with correct handling across multi-line block comments)
- Missing semicolon warnings
- **Processor function constraint checking** — detects processor functions not applicable to the current shader type
- **`discard` position check** — ensures usage only within `fragment()` / `light()`
- **Built-in variable read-only check** — detects illegal writes to `in` mode built-in variables

### 📖 Hover Information

Hover over any symbol to view detailed documentation:

- Built-in function signatures, descriptions, and context restriction info
- Type information & built-in variable details (with access mode: `in` / `out` / `inout`)
- Constant values (`PI`, `TAU`, `E`, etc.)
- Uniform hint details (with applicable type list)
- Cross-processor-function context variable hints

### 🎨 Color Preview

- Inline color picker for `vec3(r, g, b)` and `vec4(r, g, b, a)` values
- Click to visually edit colors in-place

### 📋 Snippets

| Category | Trigger | Description |
|---|---|---|
| Shader templates | `shader_spatial`, `shader_canvas_item`, `shader_particles`, `shader_sky`, `shader_fog` | Complete templates for all 5 shader types |
| Uniforms | `uniform_range`, `uniform_color`, `uniform_texture`, `uniform_enum` | Common Uniform declaration snippets |
| Processor functions | `func_vertex`, `func_fragment`, `func_light`, etc. | Skeleton snippets for each processor function |

### 🔧 Formatting & Commands

- **Document formatting**: Auto-normalize indentation
- **GDShader: Insert Shader Template** — Quickly select a shader type and insert a full template
- **GDShader: Preview Color** — Display color information for `vec3`/`vec4` at cursor position

---

## 💬 Hint Comments

This extension supports **special hint comments** to help the analyzer understand your code better. These comments are placed in your GDShader source code and are only used by the extension — they have no effect on the actual shader compilation.

| Hint | Syntax | Description |
|---|---|---|
| **Ignore** | `// #gdshader-hint-ignore` | Placed **on the same line or next line** after a `#include`. Suppresses the "unresolved resource path" warning for that include. |
| **Redirection** | `// #gdshader-hint-redirection:./relative/path` | Placed **on the same line or next line** after a `res://` `#include`. Redirects the Godot resource path to a local relative path so the extension can resolve it. |
| **Type Hint** | `// #gdshader-hint-type:vec3`<br>`/* #gdshader-hint-type:vec3 */` | Specifies the type of the **preceding variable declaration**. Useful when the type cannot be inferred automatically (e.g., external function return values). |
| **Declare Symbol** | `// #gdshader-hint-declare:vec4 my_func(float p1, in float x);`<br>or<br>`// #gdshader-hint-declare:float MY_VAR;` | Injects a **function or variable symbol** into the current scope. Supports both functions (with parameters) and simple variables. The legacy alias `#gdshader-hint-def` is also supported. |
| **Declare Macro** | `// #gdshader-hint-define:MY_FLAG`<br>`// #gdshader-hint-define:SQR(x) ((x)*(x))` | Declares a macro symbol (equivalent to `#define`). Useful when a macro is defined externally but needs to be recognized by the analyzer. |

### Usage Examples

```glsl
// ── Redirection & Ignore for #include ──
#include "res://shaders/utils.gdshaderinc" // #gdshader-hint-redirection:./utils.gdshaderinc
#include "res://third_party/something.gdshaderinc" // #gdshader-hint-ignore

// ── Type Hint ──
var custom_data = get_custom_data(); // #gdshader-hint-type:vec3

// ── Declare a function ──
// #gdshader-hint-declare:vec4 blend_overlay(vec4 base, vec4 overlay);

// ── Declare a variable ──
// #gdshader-hint-declare:float GLOBAL_SCALE;

// ── Declare a macro ──
// #gdshader-hint-define:MAX_STEPS 64
// #gdshader-hint-define:SQR(x) ((x)*(x))
```

> **Note:** All hints can use either line comments (`// ...`) or block comments (`/* ... */`). For `#gdshader-hint-ignore` and `#gdshader-hint-redirection`, the hint can appear at the **end of the `#include` line** or on the **next line**.

### Doc Comments

Both `///` line doc comments and `/** ... */` block doc comments (markdown) on the line(s) immediately above a function declaration are picked up and shown in the hover tooltip. Supported tags include `@param`, `@return`, `@brief`, etc.

```glsl
/**
 * Computes the squared length of a vector.
 * - @param v input vector
 * - @return length squared
 */
float len_sq(vec3 v) { return dot(v, v); }
```

## 🚀 Quick Start

1. Open a `.gdshader` or `.gdshaderinc` file — the extension activates automatically
2. Start typing to see intelligent completions; hover over symbols for documentation

> All features can be toggled independently via settings:
> - `gdshader.diagnostics.enabled`
> - `gdshader.completion.enabled`
> - `gdshader.hover.enabled`
> - `gdshader.format.enabled`

## 🏗 Architecture

The extension follows a **data-driven architecture** with language data separated from logic code:

```
src/
├── data/          ← Data layer: language data tables (extensible independently)
│   ├── keywords.ts
│   ├── render-modes.ts
│   ├── builtin-functions.ts
│   ├── builtin-vars.ts
│   └── ...
└── providers/     ← Feature layer: editor feature implementations
    ├── completionProvider.ts    → Context-aware completion
    ├── hoverProvider.ts         → Hover information
    ├── diagnosticsProvider.ts   → Semantic diagnostics
    ├── formattingProvider.ts    → Formatting
    └── colorProvider.ts         → Color preview
```

**Adding or updating data requires editing only the corresponding data table — no provider logic changes needed.**

## Supported File Formats

| Extension | Description |
|---|---|
| `.gdshader` | GDShader source file |
| `.gdshaderinc` | GDShader include file |

## Development

```bash
# Install dependencies
npm install

# Build
npm run compile

# Watch mode
npm run watch

# Press F5 in VS Code to launch Extension Development Host for debugging
```

For detailed development documentation, see [./docs/](./docs/).

## License

[MIT](./LICENSE)
