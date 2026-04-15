# GDShader Support for VS Code

<p align="center">
  <strong>Complete GDShader (Godot Shading Language) development support for Visual Studio Code</strong>
</p>

<!-- Preview screenshot placeholder -->
<p align="center">
  <!-- TODO: Insert preview screenshot here -->
</p>

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
