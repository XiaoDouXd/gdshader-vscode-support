// 测试样本: 包含各种语法错误的着色器 (用于诊断测试)

// 错误 1: 缺少 shader_type

// 错误 2: 无效的处理器函数
void sky() {
  // sky() 不属于 spatial (默认)
}

// 错误 3: discard 在 vertex 中
void vertex() {
  discard;
}

// 错误 4: 写入只读变量
void fragment() {
  FRAGCOORD = vec4(0.0);
  ALBEDO = vec3(1.0);
}

// 错误 5: 缺少分号
void light() {
  DIFFUSE_LIGHT = vec3(1.0)
}
