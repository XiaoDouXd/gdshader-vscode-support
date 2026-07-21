shader_type spatial;

/**
 * 计算漫反射光照系数.
 * @param normal 表面法线 (归一化)
 * @param light_dir 指向光源的方向 (归一化)
 * @return 漫反射系数 [0, 1]
 */
float diffuse(vec3 normal, vec3 light_dir) {
  return max(dot(normal, light_dir), 0.0);
}

/*
 * 普通块注释.
 * 不含 @param, 但同样需要保持 * 对齐.
 */
void vertex() {
  VERTEX.y += 1.0;
}

void fragment() {
  // 行注释: 设置反照率
  ALBEDO = vec3(1.0);

  if (diffuse(NORMAL, vec3(0.0, 1.0, 0.0)) > 0.5) { // 背光判定
    EMISSION = vec3(0.1);
  } else {
    EMISSION = vec3(0.0);
  }
}
