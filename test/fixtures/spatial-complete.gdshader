// 测试样本: 完整的 spatial 着色器
shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec4 albedo_color : source_color = vec4(1.0);
uniform float roughness_value : hint_range(0.0, 1.0, 0.01) = 0.5;
uniform sampler2D albedo_texture : source_color, filter_linear_mipmap;
uniform float speed : hint_range(0.0, 10.0) = 1.0;

group_uniforms MyGroup;
uniform float custom_param = 0.0;
group_uniforms;

varying vec3 world_normal;
varying float vert_height;

const float MY_CONST = 3.14;

struct PointLight {
  vec3 position;
  vec3 color;
  float intensity;
};

void vertex() {
  VERTEX.y += sin(TIME * speed) * 0.1;
  world_normal = NORMAL;
  vert_height = VERTEX.y;
  UV = UV * 2.0;
}

void fragment() {
  vec4 tex = texture(albedo_texture, UV);
  ALBEDO = tex.rgb * albedo_color.rgb;
  ALPHA = albedo_color.a;
  METALLIC = 0.0;
  ROUGHNESS = roughness_value;
  NORMAL_MAP = texture(albedo_texture, UV).rgb;
  NORMAL_MAP_DEPTH = 1.0;
  EMISSION = vec3(0.0);

  if (vert_height > 1.0) {
    AO = 0.5;
  } else {
    AO = 1.0;
  }
}

void light() {
  float NdotL = max(dot(NORMAL, LIGHT), 0.0);
  DIFFUSE_LIGHT += LIGHT_COLOR * NdotL * ATTENUATION;
  SPECULAR_LIGHT += LIGHT_COLOR * pow(NdotL, 16.0) * ATTENUATION;
}
