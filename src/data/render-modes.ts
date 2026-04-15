/**
 * GDShader 渲染模式数据表
 * 按着色器类型组织的渲染模式列表.
 */

// ─── 渲染模式 ───
export const RENDER_MODES: Record<string, string[]> = {
  spatial: [
    'blend_mix', 'blend_add', 'blend_sub', 'blend_mul', 'blend_premul_alpha',
    'depth_draw_opaque', 'depth_draw_always', 'depth_draw_never', 'depth_prepass_alpha',
    'depth_test_disabled', 'depth_test_default', 'depth_test_inverted',
    'sss_mode_skin',
    'cull_back', 'cull_front', 'cull_disabled',
    'unshaded', 'wireframe', 'debug_shadow_splits',
    'diffuse_burley', 'diffuse_lambert', 'diffuse_lambert_wrap', 'diffuse_toon',
    'specular_schlick_ggx', 'specular_toon', 'specular_disabled',
    'skip_vertex_transform', 'world_vertex_coords', 'ensure_correct_normals',
    'shadows_disabled', 'ambient_light_disabled', 'shadow_to_opacity',
    'vertex_lighting', 'particle_trails',
    'alpha_to_coverage', 'alpha_to_coverage_and_one',
    'fog_disabled',
  ],
  canvas_item: [
    'blend_mix', 'blend_add', 'blend_sub', 'blend_mul', 'blend_premul_alpha', 'blend_disabled',
    'unshaded', 'light_only',
    'skip_vertex_transform',
    'world_vertex_coords',
    'particle_trails',
  ],
  particles: [
    'keep_data',
    'disable_force', 'disable_velocity',
    'collision_use_scale',
  ],
  sky: [
    'use_half_res_pass', 'use_quarter_res_pass',
    'disable_fog',
  ],
  fog: [],
};
