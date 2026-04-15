/**
 * 命令注册模块
 * 提供插入着色器模板, 预览颜色等命令.
 */
import * as vscode from 'vscode';
import { loc } from './loc';

/** 注册所有命令 */
export function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('gdshader.insertShaderTemplate', insertShaderTemplate),
    vscode.commands.registerCommand('gdshader.generateColorPreview', generateColorPreview)
  );
}

/** 插入着色器模板: 弹出选择框, 选择着色器类型后插入对应模板 */
async function insertShaderTemplate() {
  const shaderTypes = [
    { label: 'spatial', description: loc('cmd.shader.spatial') },
    { label: 'canvas_item', description: loc('cmd.shader.canvas_item') },
    { label: 'particles', description: loc('cmd.shader.particles') },
    { label: 'sky', description: loc('cmd.shader.sky') },
    { label: 'fog', description: loc('cmd.shader.fog') },
  ];

  const selected = await vscode.window.showQuickPick(shaderTypes, {
    placeHolder: loc('cmd.template.placeholder')
  });

  if (!selected) {
    return;
  }

  const templates: Record<string, string> = {
    spatial: `shader_type spatial;
render_mode blend_mix;

uniform vec4 albedo_color : source_color = vec4(1.0);

void vertex() {
\t// ${loc('cmd.template.vertex')}
}

void fragment() {
\tALBEDO = albedo_color.rgb;
\tALPHA = albedo_color.a;
}

void light() {
\t// ${loc('cmd.template.light')}
}
`,
    canvas_item: `shader_type canvas_item;

uniform vec4 modulate_color : source_color = vec4(1.0);

void vertex() {
\t// ${loc('cmd.template.vertex')}
}

void fragment() {
\tvec4 tex_color = texture(TEXTURE, UV);
\tCOLOR = tex_color * modulate_color;
}

void light() {
\t// ${loc('cmd.template.light')}
}
`,
    particles: `shader_type particles;

uniform float spread : hint_range(0.0, 180.0) = 45.0;

void start() {
\t// ${loc('cmd.template.particleInit')}
}

void process() {
\t// ${loc('cmd.template.particleProcess')}
}
`,
    sky: `shader_type sky;

uniform vec4 top_color : source_color = vec4(0.3, 0.5, 1.0, 1.0);
uniform vec4 bottom_color : source_color = vec4(0.1, 0.1, 0.1, 1.0);

void sky() {
\tCOLOR = mix(bottom_color.rgb, top_color.rgb, clamp(EYEDIR.y, 0.0, 1.0));
}
`,
    fog: `shader_type fog;

void fog() {
\tDENSITY = 1.0;
\tALBEDO = vec3(1.0);
\tEMISSION = vec3(0.0);
}
`,
  };

  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const template = templates[selected.label];
    await editor.edit(editBuilder => {
      editBuilder.insert(editor.selection.active, template);
    });
  }
}

/** 预览颜色: 在光标位置查找 vec3/vec4 颜色值并显示信息 */
async function generateColorPreview() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'gdshader') {
    vscode.window.showWarningMessage(loc('cmd.openGdshaderFile'));
    return;
  }

  // 在光标所在行查找 vec3/vec4 颜色值
  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line).text;
  const colorRegex = /vec[34]\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/g;

  let match;
  while ((match = colorRegex.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (position.character >= start && position.character <= end) {
      const r = Math.min(1, Math.max(0, parseFloat(match[1])));
      const g = Math.min(1, Math.max(0, parseFloat(match[2])));
      const b = Math.min(1, Math.max(0, parseFloat(match[3])));
      const a = match[4] !== undefined ? Math.min(1, Math.max(0, parseFloat(match[4]))) : 1.0;

      const hexR = Math.round(r * 255).toString(16).padStart(2, '0');
      const hexG = Math.round(g * 255).toString(16).padStart(2, '0');
      const hexB = Math.round(b * 255).toString(16).padStart(2, '0');
      const hexA = Math.round(a * 255).toString(16).padStart(2, '0');

      vscode.window.showInformationMessage(
        loc('cmd.color.info',
          (r * 255).toFixed(0), (g * 255).toFixed(0), (b * 255).toFixed(0),
          a.toFixed(2), `${hexR}${hexG}${hexB}${hexA}`)
      );
      return;
    }
  }

  vscode.window.showInformationMessage(loc('cmd.color.notFound'));
}
