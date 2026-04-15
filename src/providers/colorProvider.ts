/**
 * GDShader 颜色提供器
 * 为 vec3/vec4 颜色值提供内联颜色预览和拾色器.
 */
import * as vscode from 'vscode';

export class GDShaderColorProvider implements vscode.DocumentColorProvider {
  /** 提取文档中的颜色信息 */
  provideDocumentColors(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.ColorInformation[] {
    const colors: vscode.ColorInformation[] = [];
    const text = document.getText();

    // 匹配 vec3(...) 和 vec4(...) 中看起来像颜色的值 (0-1 范围)
    const colorRegex = /\b(vec[34])\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/g;

    let match;
    while ((match = colorRegex.exec(text)) !== null) {
      const r = parseFloat(match[2]);
      const g = parseFloat(match[3]);
      const b = parseFloat(match[4]);
      const a = match[5] !== undefined ? parseFloat(match[5]) : 1.0;

      // 仅当值在合理范围内才视为颜色
      if (r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1 && a >= 0 && a <= 1) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);
        const color = new vscode.Color(r, g, b, a);
        colors.push(new vscode.ColorInformation(range, color));
      }
    }

    return colors;
  }

  /** 提供颜色的文本表示形式 (用于拾色器修改后的回写) */
  provideColorPresentations(
    color: vscode.Color,
    context: { document: vscode.TextDocument; range: vscode.Range },
    _token: vscode.CancellationToken
  ): vscode.ColorPresentation[] {
    const r = color.red.toFixed(3).replace(/\.?0+$/, '.0').replace(/^\.$/, '0.');
    const g = color.green.toFixed(3).replace(/\.?0+$/, '.0').replace(/^\.$/, '0.');
    const b = color.blue.toFixed(3).replace(/\.?0+$/, '.0').replace(/^\.$/, '0.');
    const a = color.alpha.toFixed(3).replace(/\.?0+$/, '.0').replace(/^\.$/, '0.');

    const presentations: vscode.ColorPresentation[] = [];

    // 判断原始文本是 vec3 还是 vec4
    const originalText = context.document.getText(context.range);
    const isVec4 = originalText.startsWith('vec4');

    if (isVec4 || color.alpha < 1.0) {
      presentations.push(new vscode.ColorPresentation(`vec4(${r}, ${g}, ${b}, ${a})`));
    }
    presentations.push(new vscode.ColorPresentation(`vec3(${r}, ${g}, ${b})`));

    return presentations;
  }
}
