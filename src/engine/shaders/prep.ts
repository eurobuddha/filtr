import { frag } from './common'

// Pre-effect prep: applies the active effect's brightness/contrast, and (ASCII
// only) saturation, hue, gamma, sharpen, blur, edge-enhance and colour quantize.
// Every effect shader samples the prepped texture so colour grading is uniform.
export const PREP_FRAG = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_brightness; // -1..1
uniform float u_contrast;   // -1..1
uniform float u_isAscii;    // 0/1 — enable the extended grade
uniform float u_saturation; // -1..1
uniform float u_hue;        // degrees
uniform float u_gamma;      // 0.1..3
uniform float u_sharpness;  // 0..1
uniform float u_blur;       // px radius
uniform float u_edge;       // 0..1 edge enhance
uniform float u_quantize;   // 0 = off, else levels

vec3 sampleBlur(vec2 uv, float r) {
  if (r < 0.5) return texture(u_tex, uv).rgb;
  vec2 px = r / u_res;
  vec3 s = vec3(0.0);
  s += texture(u_tex, uv).rgb * 4.0;
  s += texture(u_tex, uv + vec2(px.x, 0.0)).rgb * 2.0;
  s += texture(u_tex, uv - vec2(px.x, 0.0)).rgb * 2.0;
  s += texture(u_tex, uv + vec2(0.0, px.y)).rgb * 2.0;
  s += texture(u_tex, uv - vec2(0.0, px.y)).rgb * 2.0;
  s += texture(u_tex, uv + px).rgb;
  s += texture(u_tex, uv - px).rgb;
  s += texture(u_tex, uv + vec2(px.x, -px.y)).rgb;
  s += texture(u_tex, uv + vec2(-px.x, px.y)).rgb;
  return s / 16.0;
}

void main() {
  vec4 src = texture(u_tex, v_uv);
  vec3 c = src.rgb;

  if (u_isAscii > 0.5) {
    c = sampleBlur(v_uv, u_blur);
    // sharpen + edge enhance (unsharp mask)
    float amt = u_sharpness * 1.5 + u_edge * 1.5;
    if (amt > 0.001) {
      vec2 px = 1.0 / u_res;
      vec3 blur = sampleBlur(v_uv, 1.0);
      c = clamp(c + (c - blur) * amt, 0.0, 1.0);
    }
  }

  // brightness + contrast (all effects)
  c = (c - 0.5) * (1.0 + u_contrast) + 0.5;
  c += u_brightness;
  c = clamp(c, 0.0, 1.0);

  if (u_isAscii > 0.5) {
    c = pow(c, vec3(1.0 / max(u_gamma, 0.001)));
    float l = luma(c);
    c = clamp(mix(vec3(l), c, 1.0 + u_saturation), 0.0, 1.0);
    if (abs(u_hue) > 0.001) {
      vec3 hsv = rgb2hsv(c);
      hsv.x = fract(hsv.x + u_hue / 360.0);
      c = hsv2rgb(hsv);
    }
    if (u_quantize >= 2.0) {
      c = floor(c * u_quantize) / max(1.0, u_quantize - 1.0);
      c = clamp(c, 0.0, 1.0);
    }
  }

  fragColor = vec4(c, src.a);
}
`)
