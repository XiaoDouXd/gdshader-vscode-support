// 测试样本: 粒子着色器
shader_type particles;
render_mode disable_velocity;

uniform float spread : hint_range(0.0, 180.0) = 45.0;
uniform float initial_speed : hint_range(0.0, 100.0) = 10.0;

void start() {
  if (RESTART_POSITION) {
    TRANSFORM = EMISSION_TRANSFORM;
    float angle = float(INDEX) * TAU / float(NUMBER);
    VELOCITY = vec3(cos(angle), 1.0, sin(angle)) * initial_speed;
  }
  if (RESTART_COLOR) {
    COLOR = vec4(1.0, 0.5, 0.0, 1.0);
  }
  ACTIVE = true;
  CUSTOM = vec4(0.0);
}

void process() {
  VELOCITY.y -= 9.8 * DELTA;
  COLOR.a -= DELTA / LIFETIME;

  if (COLLIDED) {
    VELOCITY = reflect(VELOCITY, COLLISION_NORMAL) * 0.5;
  }

  if (COLOR.a <= 0.0) {
    ACTIVE = false;
  }
}
