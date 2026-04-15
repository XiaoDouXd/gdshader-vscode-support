// 测试样本: 雾效着色器
shader_type fog;

uniform float density_multiplier : hint_range(0.0, 10.0) = 1.0;
uniform vec3 fog_color : source_color = vec3(0.5, 0.6, 0.7);

void fog() {
  float dist = length(WORLD_POSITION - OBJECT_POSITION);
  float falloff = clamp(1.0 - dist / SIZE.x, 0.0, 1.0);

  DENSITY = falloff * density_multiplier;
  ALBEDO = fog_color;
  EMISSION = vec3(0.0);
}
