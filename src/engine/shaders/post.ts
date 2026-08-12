import { frag } from './common'

// ── Bloom (soft-threshold bright pass + disk blur, additive) ───────────
export const BLOOM_FRAG = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_threshold;
uniform float u_soft;
uniform float u_intensity;
uniform float u_radius; // px
void main() {
  vec4 base = texture(u_tex, v_uv);
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 24; i++) {
    float a = float(i) * 2.39996323;
    float rad = sqrt((float(i) + 0.5) / 24.0) * u_radius;
    vec2 off = vec2(cos(a), sin(a)) * rad / u_res;
    vec3 c = texture(u_tex, v_uv + off).rgb;
    float l = luma(c);
    float knee = max(u_soft, 0.001);
    float w = clamp((l - u_threshold + knee) / (2.0 * knee), 0.0, 1.0);
    w *= step(u_threshold - knee, l);
    sum += c * w;
  }
  fragColor = vec4(base.rgb + sum / 24.0 * u_intensity * 2.5, base.a);
}
`)

// ── Chromatic aberration / RGB split ───────────────────────────────────
export const CHROMATIC_FRAG = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_offset; // px
void main() {
  vec2 dir = (v_uv - 0.5);
  vec2 o = dir * (u_offset / u_res * 2.0) * length(u_res) * 0.02;
  float r = texture(u_tex, v_uv + o).r;
  vec4 g = texture(u_tex, v_uv);
  float b = texture(u_tex, v_uv - o).b;
  fragColor = vec4(r, g.g, b, g.a);
}
`)

// ── Scanlines ────────────────────────────────────────────────────────
export const SCANLINES_FRAG = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_opacity;
uniform float u_spacing; // px
void main() {
  vec4 c = texture(u_tex, v_uv);
  float s = 0.5 + 0.5 * sin(v_uv.y * u_res.y / max(u_spacing, 1.0) * 3.14159 * 2.0);
  c.rgb *= 1.0 - u_opacity * (1.0 - s);
  fragColor = c;
}
`)

// ── Vignette ─────────────────────────────────────────────────────────
export const VIGNETTE_FRAG = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform float u_intensity;
uniform float u_radius;
void main() {
  vec4 c = texture(u_tex, v_uv);
  float d = length(v_uv - 0.5) * 1.41421;
  float v = smoothstep(0.9, u_radius, d);
  c.rgb *= 1.0 - v * u_intensity;
  fragColor = c;
}
`)

// ── CRT curve (barrel + edge mask) ─────────────────────────────────────
export const CRT_FRAG = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform float u_amount;
void main() {
  vec2 uv = v_uv * 2.0 - 1.0;
  uv *= 1.0 + dot(uv, uv) * u_amount;
  uv = uv * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  fragColor = texture(u_tex, uv);
}
`)

// ── Film grain ───────────────────────────────────────────────────────
export const GRAIN_FRAG = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_time;
uniform float u_intensity; // 0..200
uniform float u_size;
uniform float u_speed;
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec2 p = floor(v_uv * u_res / max(u_size, 1.0));
  float g = hash21(p + floor(u_time * u_speed * 0.06) * 13.7);
  c.rgb += (g - 0.5) * (u_intensity / 200.0);
  fragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}
`)

// ── Phosphor (monochrome tube tint) ────────────────────────────────────
export const PHOSPHOR_FRAG = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec3 u_color;
void main() {
  vec4 c = texture(u_tex, v_uv);
  fragColor = vec4(u_color * luma(c.rgb), c.a);
}
`)

// ── Final composite (Y-flip + background) ──────────────────────────────
export const COMPOSITE_FRAG = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec3 u_bg;
void main() {
  vec4 c = texture(u_tex, vec2(v_uv.x, 1.0 - v_uv.y));
  fragColor = vec4(mix(u_bg, c.rgb, c.a), 1.0);
}
`)
