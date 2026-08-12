// Shared GLSL prelude prepended to fragment shaders via `frag(body)`.
// Provides the precision header, common varyings/uniforms, and a small math lib.

export const GLSL_LIB = /* glsl */ `
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;

// Rec.709 luma
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// hash / value noise
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(c, vec3(1.0 / 2.2)); }

// 8x8 ordered Bayer threshold in [0,1)
const float BAYER8[64] = float[64](
  0.0,32.0,8.0,40.0,2.0,34.0,10.0,42.0, 48.0,16.0,56.0,24.0,50.0,18.0,58.0,26.0,
  12.0,44.0,4.0,36.0,14.0,46.0,6.0,38.0, 60.0,28.0,52.0,20.0,62.0,30.0,54.0,22.0,
  3.0,35.0,11.0,43.0,1.0,33.0,9.0,41.0, 51.0,19.0,59.0,27.0,49.0,17.0,57.0,25.0,
  15.0,47.0,7.0,39.0,13.0,45.0,5.0,37.0, 63.0,31.0,55.0,23.0,61.0,29.0,53.0,21.0);
float bayer8(vec2 p) {
  int i = int(mod(p.y, 8.0)) * 8 + int(mod(p.x, 8.0));
  return (BAYER8[i] + 0.5) / 64.0;
}

// cellular / worley noise, returns nearest-feature distance
float worley(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float md = 1.5;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(hash21(n + g), hash21(n + g + 41.3));
      md = min(md, length(g + o - f));
    }
  return md;
}
`

/** Build a complete fragment shader from a body that uses the shared lib. */
export function frag(body: string): string {
  return `#version 300 es\n${GLSL_LIB}\n${body}`
}
