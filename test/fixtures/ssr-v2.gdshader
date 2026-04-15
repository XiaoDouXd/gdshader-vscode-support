shader_type spatial;
render_mode unshaded, cull_disabled, fog_disabled, depth_draw_never, depth_test_disabled, shadows_disabled, blend_mix;

uniform sampler2D screen_tex : hint_screen_texture, repeat_disable, filter_linear_mipmap;
uniform sampler2D depth_tex : hint_depth_texture, repeat_disable, filter_nearest;
uniform bool enable_effect = true;
uniform int max_steps = 64;
uniform float step_scale = 0.15;
uniform float hit_thickness = 0.5;
uniform float max_ray_distance = 25.0;
uniform float reflection_intensity = 0.7;
uniform float fresnel_power = 2.5;
uniform float edge_fade_power = 2.0;
uniform float blur_lod = 0.4;
uniform bool use_floor_mask = true;
uniform float floor_mask_bias = 0.0;
uniform int binary_refine_steps = 5;
uniform bool enable_backface_reject = true;
uniform float backface_reject_threshold = 0.2;
uniform bool enable_adaptive_thickness = true;
uniform float adaptive_thickness_scale = 0.02;
uniform float miss_fallback_intensity = 0.15;
uniform float miss_fallback_lod = 3.0;
uniform float miss_fallback_offset = 0.05;
uniform bool enable_jitter = true;
uniform float jitter_intensity = 0.8;

vec3 view_pos_from_depth(vec2 screen_uv, float raw_depth, mat4 inv_proj) {
	vec3 ndc = vec3(screen_uv * 2.0 - 1.0, raw_depth);
	vec4 view = inv_proj * vec4(ndc, 1.0);
	return view.xyz / view.w;
}

vec3 normal_from_depth(vec2 uv, mat4 inv_proj) {
	vec2 texel = 1.0 / vec2(textureSize(depth_tex, 0));
	float d_c = texture(depth_tex, uv).r;
	float d_r = texture(depth_tex, uv + vec2(texel.x, 0.0)).r;
	float d_d = texture(depth_tex, uv + vec2(0.0, texel.y)).r;
	vec3 p_c = view_pos_from_depth(uv, d_c, inv_proj);
	vec3 p_r = view_pos_from_depth(uv + vec2(texel.x, 0.0), d_r, inv_proj);
	vec3 p_d = view_pos_from_depth(uv + vec2(0.0, texel.y), d_d, inv_proj);
	vec3 n = normalize(cross(p_r - p_c, p_d - p_c));
	if (dot(n, -p_c) < 0.0) {
		n = -n;
	}
	return n;
}

bool view_to_uv(vec3 view_pos, mat4 proj, out vec2 out_uv) {
	out_uv = vec2(-1.0);
	vec4 clip = proj * vec4(view_pos, 1.0);
	if (clip.w <= 0.0001) {
		return false;
	}
	vec3 ndc = clip.xyz / clip.w;
	out_uv = ndc.xy * 0.5 + 0.5;
	return all(greaterThan(out_uv, vec2(0.002))) && all(lessThan(out_uv, vec2(0.998)));
}

float hash_12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

bool march_ray_v2(
	vec3 origin, vec3 dir, mat4 proj, mat4 inv_proj,
	float jitter_offset,
	out vec2 hit_uv, out float hit_fade, out float hit_confidence
) {
	hit_uv = vec2(-1.0);
	hit_fade = 0.0;
	hit_confidence = 0.0;
	vec3 p = origin + dir * jitter_offset;
	vec3 prev_p = p;

	for (int i = 1; i <= 128; i++) {
		if (i > max_steps) {
			break;
		}
		float fi = float(i);
		float current_step = step_scale * (1.0 + fi * 0.06);
		prev_p = p;
		p += dir * current_step;
		float ray_dist = length(p - origin);
		if (ray_dist > max_ray_distance) {
			break;
		}
		vec2 suv;
		if (!view_to_uv(p, proj, suv)) {
			break;
		}
		float sampled_raw = texture(depth_tex, suv).r;
		if (sampled_raw >= 0.9999 || sampled_raw <= 0.0001) {
			continue;
		}
		vec3 sampled_pos = view_pos_from_depth(suv, sampled_raw, inv_proj);
		float ray_depth = -p.z;
		float scene_depth = -sampled_pos.z;
		float diff = ray_depth - scene_depth;
		float current_thickness = hit_thickness;
		if (enable_adaptive_thickness) {
			current_thickness = hit_thickness * (1.0 + scene_depth * adaptive_thickness_scale);
		}
		if (diff > 0.0 && diff < current_thickness) {
			vec3 lo = prev_p;
			vec3 hi = p;
			vec2 refined_uv = suv;
			for (int r = 0; r < 8; r++) {
				if (r >= binary_refine_steps) {
					break;
				}
				vec3 mid = (lo + hi) * 0.5;
				vec2 mid_uv;
				if (view_to_uv(mid, proj, mid_uv)) {
					float mid_raw = texture(depth_tex, mid_uv).r;
					if (mid_raw >= 0.9999 || mid_raw <= 0.0001) {
						lo = mid;
						continue;
					}
					float mid_scene_depth = -view_pos_from_depth(mid_uv, mid_raw, inv_proj).z;
					float mid_ray_depth = -mid.z;
					if (mid_ray_depth > mid_scene_depth) {
						hi = mid;
						refined_uv = mid_uv;
					} else {
						lo = mid;
					}
				} else {
					hi = mid;
				}
			}
			hit_uv = refined_uv;
			hit_fade = 1.0 - clamp(ray_dist / max_ray_distance, 0.0, 1.0);
			float refined_raw = texture(depth_tex, refined_uv).r;
			vec3 refined_pos = view_pos_from_depth(refined_uv, refined_raw, inv_proj);
			vec2 final_check_uv;
			vec3 final_p = (lo + hi) * 0.5;
			if (view_to_uv(final_p, proj, final_check_uv)) {
				float final_diff = abs(-final_p.z - (-refined_pos.z));
				hit_confidence = 1.0 - clamp(final_diff / current_thickness, 0.0, 1.0);
			} else {
				hit_confidence = 0.5;
			}
			return true;
		}
	}
	return false;
}

void vertex() {
	POSITION = vec4(VERTEX.xy, 0.0, 1.0);
}

void fragment() {
	vec2 uv = SCREEN_UV;
	vec3 final_color = vec3(0.0);
	vec3 src = textureLod(screen_tex, uv, 0.0).rgb;
	if (!enable_effect) {
		final_color = src;
	} else {
		mat4 proj = PROJECTION_MATRIX;
		mat4 inv_proj = INV_PROJECTION_MATRIX;
		float raw_depth = texture(depth_tex, uv).r;
		if (raw_depth >= 0.9999 || raw_depth <= 0.0001) {
			final_color = src;
		} else {
			vec3 pos_vs = view_pos_from_depth(uv, raw_depth, inv_proj);
			vec3 normal_vs = normal_from_depth(uv, inv_proj);
			vec3 view_dir = normalize(-pos_vs);
			vec3 reflect_dir = reflect(-view_dir, normal_vs);
			vec3 ray_origin = pos_vs + normal_vs * 0.05;
			float jitter_offset = 0.0;
			if (enable_jitter) {
				float noise = hash_12(uv * vec2(textureSize(depth_tex, 0)) + vec2(TIME * 7.13));
				jitter_offset = step_scale * jitter_intensity * noise;
			}
			vec2 hit_uv;
			float hit_fade;
			float hit_confidence;
			bool hit = march_ray_v2(
				ray_origin, reflect_dir, proj, inv_proj,
				jitter_offset,
				hit_uv, hit_fade, hit_confidence
			);
			if (hit && enable_backface_reject) {
				vec3 hit_normal = normal_from_depth(hit_uv, inv_proj);
				float backface_dot = dot(hit_normal, reflect_dir);
				if (backface_dot > backface_reject_threshold) {
					hit = false;
				}
			}
			if (hit) {
				vec3 reflected_color = textureLod(screen_tex, hit_uv, blur_lod).rgb;
				float ndotv = clamp(dot(normal_vs, view_dir), 0.0, 1.0);
				float fresnel = pow(1.0 - ndotv, fresnel_power);
				float normal_mask = 1.0;
				if (use_floor_mask) {
					normal_mask = smoothstep(floor_mask_bias, floor_mask_bias + 0.5, normal_vs.y);
				}
				vec2 ef = smoothstep(vec2(0.0), vec2(0.1), hit_uv)
					* (vec2(1.0) - smoothstep(vec2(0.9), vec2(1.0), hit_uv));
				float edge_atten = ef.x * ef.y;
				float confidence_factor = mix(0.5, 1.0, hit_confidence);
				float weight = reflection_intensity
					* (0.25 + fresnel * 0.75)
					* normal_mask
					* edge_atten
					* hit_fade
					* confidence_factor;
				weight = clamp(weight, 0.0, 0.95);
				final_color = mix(src, reflected_color, weight);
			} else {
				if (miss_fallback_intensity > 0.001) {
					float ndotv = clamp(dot(normal_vs, view_dir), 0.0, 1.0);
					float fresnel = pow(1.0 - ndotv, fresnel_power);
					float normal_mask = 1.0;
					if (use_floor_mask) {
						normal_mask = smoothstep(floor_mask_bias, floor_mask_bias + 0.5, normal_vs.y);
					}
					vec2 fallback_uv = clamp(
						uv + reflect_dir.xy * miss_fallback_offset,
						vec2(0.01), vec2(0.99)
					);
					vec3 fallback_color = textureLod(screen_tex, fallback_uv, miss_fallback_lod).rgb;
					float fallback_weight = miss_fallback_intensity
						* fresnel
						* normal_mask;
					fallback_weight = clamp(fallback_weight, 0.0, 0.5);
					final_color = mix(src, fallback_color, fallback_weight);
				} else {
					final_color = src;
				}
			}
		}
	}
	ALBEDO = final_color;
	ALPHA = 1.0;
}
