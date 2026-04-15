// 测试样本: 天空着色器
shader_type sky;
render_mode use_half_res_pass;

uniform vec3 top_color : source_color = vec3(0.3, 0.5, 1.0);
uniform vec3 bottom_color : source_color = vec3(0.1, 0.1, 0.1);
uniform float sun_size : hint_range(0.001, 0.1) = 0.02;

void sky() {
  if (AT_CUBEMAP_PASS) {
    COLOR = mix(bottom_color, top_color, clamp(EYEDIR.y * 0.5 + 0.5, 0.0, 1.0));

    if (LIGHT0_ENABLED) {
      float sun_amount = max(dot(EYEDIR, LIGHT0_DIRECTION), 0.0);
      sun_amount = pow(sun_amount, 1.0 / sun_size);
      COLOR += LIGHT0_COLOR * LIGHT0_ENERGY * sun_amount;
    }
    ALPHA = 1.0;
  } else if (AT_HALF_RES_PASS) {
    COLOR = HALF_RES_COLOR.rgb;
  } else {
    COLOR = texture(RADIANCE, EYEDIR).rgb;
  }
}
