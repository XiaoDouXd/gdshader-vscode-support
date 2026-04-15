// 测试样本: 完整的 canvas_item 着色器
shader_type canvas_item;

uniform vec4 modulate : source_color = vec4(1.0);
uniform sampler2D noise_texture;

void vertex() {
  VERTEX += vec2(sin(TIME), cos(TIME)) * 2.0;
}

void fragment() {
  vec4 tex = texture(TEXTURE, UV);
  vec4 noise = texture(noise_texture, UV + TIME * 0.1);
  COLOR = tex * modulate * noise;

  NORMAL_MAP = texture(NORMAL_TEXTURE, UV).rgb;
  NORMAL_MAP_DEPTH = 0.5;
}

void light() {
  float cNdotL = max(0.0, dot(NORMAL, LIGHT_DIRECTION));
  LIGHT = vec4(LIGHT_COLOR.rgb * COLOR.rgb * LIGHT_ENERGY * cNdotL, LIGHT_COLOR.a);
}
