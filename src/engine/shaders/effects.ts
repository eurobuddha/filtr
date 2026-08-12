import { frag } from './common'

// All 15 effect fragment shaders. Each samples the prepped texture (u_tex),
// already brightness/contrast graded, and applies its own colour mode.

// ── ASCII ────────────────────────────────────────────────────────────────
export const ASCII = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform sampler2D u_atlas;
uniform float u_count;
uniform float u_cell;       // px per cell (incl. spacing)
uniform float u_glyph;      // glyph px (cell minus gap)
uniform vec2  u_res;
uniform float u_bmap;       // brightness mapping (gamma on ramp)
uniform float u_invert;
uniform float u_colorMode;  // 0 mono, 1 original
uniform vec3  u_char;
uniform vec3  u_bg;
uniform float u_intensity;

void main() {
  vec2 px = v_uv * u_res;
  vec2 cell = floor(px / u_cell);
  vec2 cellOrigin = cell * u_cell;
  vec2 center = (cellOrigin + 0.5 * u_cell) / u_res;
  vec3 srcC = texture(u_tex, center).rgb;
  float l = pow(clamp(luma(srcC), 0.0, 1.0), max(u_bmap, 0.01));
  l = mix(l, 1.0 - l, u_invert);
  float idx = clamp(floor(l * u_count), 0.0, u_count - 1.0);

  // local position inside the glyph box (centred, honouring spacing gap)
  vec2 inCell = px - cellOrigin;
  vec2 gap = vec2((u_cell - u_glyph) * 0.5);
  vec2 local = (inCell - gap) / u_glyph;
  float cov = 0.0;
  if (local.x >= 0.0 && local.x <= 1.0 && local.y >= 0.0 && local.y <= 1.0) {
    float ax = (idx + local.x) / u_count;
    cov = texture(u_atlas, vec2(ax, local.y)).r;
  }
  vec3 ink = (u_colorMode < 0.5) ? u_char : srcC * u_intensity;
  fragColor = vec4(mix(u_bg, ink, cov), 1.0);
}
`)

// ── Wave lines ─────────────────────────────────────────────────────────
export const WAVELINES = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_lineCount;
uniform float u_amplitude; // px
uniform float u_frequency;
uniform float u_dir;       // 0 horizontal, 1 vertical
uniform float u_thickness;
uniform float u_colorMode; // 0 custom/mono, 1 original
uniform vec3  u_fg;
uniform vec3  u_bg;

void main() {
  // work in a coordinate where .x runs along the line, .y across the stack
  vec2 uv = (u_dir < 0.5) ? v_uv : v_uv.yx;
  vec2 res = (u_dir < 0.5) ? u_res : u_res.yx;
  float on = 0.0;
  vec3 srcAt = vec3(0.0);
  float spacing = 1.0 / u_lineCount;
  float baseIdx = floor(uv.y * u_lineCount);
  for (int k = -2; k <= 2; k++) {
    float idx = baseIdx + float(k);
    float baseY = (idx + 0.5) * spacing;
    if (baseY < 0.0 || baseY > 1.0) continue;
    vec2 sampleUV = (u_dir < 0.5) ? vec2(uv.x, baseY) : vec2(baseY, uv.x);
    vec3 s = texture(u_tex, sampleUV).rgb;
    float l = luma(s);
    float disp = ((l - 0.5) * u_amplitude + sin(uv.x * u_frequency * 40.0) * u_amplitude * 0.25) / res.y;
    float center = baseY + disp;
    float dist = abs(uv.y - center) * res.y;
    float th = u_thickness * (0.4 + l * 1.6);
    float c = 1.0 - smoothstep(th - 1.0, th + 1.0, dist);
    if (c > on) { on = c; srcAt = s; }
  }
  vec3 line = (u_colorMode < 0.5) ? u_fg : srcAt;
  fragColor = vec4(mix(u_bg, line, on), 1.0);
}
`)

// ── Dithering (ordered families; error-diffusion handled on CPU) ─────────
export const DITHERING = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform sampler2D u_noise;
uniform vec2  u_res;
uniform float u_method;   // 8..11 bayer2/4/8/16, 12 clustered, 13 blue, 14 IGN
uniform float u_intensity;
uniform float u_colorMode; // 0 mono,1 tonal,2 indexed,3 rgb,4 original
uniform float u_levels;
uniform float u_gamma;
uniform vec3  u_fg;
uniform vec3  u_bg;
uniform vec3  u_pal[8];
uniform float u_palCount;
uniform float u_paletteSize;

float bayerN(vec2 p, float n) {
  float sum = 0.0, div = 0.0, scale = 1.0;
  for (int i = 0; i < 4; i++) {
    if (float(i) >= n) break;
    vec2 c = mod(floor(p / scale), 2.0);
    float b = c.x + c.y * 2.0;
    b = (c.x == c.y) ? (c.x == 0.0 ? 0.0 : 3.0) : (c.x > c.y ? 2.0 : 1.0);
    sum += b * pow(4.0, float(i));
    div += 3.0 * pow(4.0, float(i));
    scale *= 2.0;
  }
  return (sum + 0.5) / (div + 1.0);
}

float threshold(vec2 px) {
  if (u_method < 8.5) return bayerN(px, 1.0);      // bayer2
  else if (u_method < 9.5) return bayerN(px, 2.0); // bayer4
  else if (u_method < 10.5) return bayer8(px);     // bayer8
  else if (u_method < 11.5) return bayerN(px, 4.0);// bayer16
  else if (u_method < 12.5) {                      // clustered dot
    vec2 c = mod(px, 4.0);
    float d = length(c - 1.5);
    return clamp(d / 2.8, 0.0, 1.0);
  } else if (u_method < 13.5) {                    // blue noise
    return texture(u_noise, px / 64.0).r;
  }
  return fract(52.9829189 * fract(dot(floor(px), vec2(0.06711056, 0.00583715)))); // IGN
}

float quant(float v, float m, float L) {
  v += (m - 0.5) / max(L - 1.0, 1.0) * u_intensity;
  return clamp(floor(v * (L - 1.0) + 0.5), 0.0, L - 1.0) / (L - 1.0);
}

void main() {
  vec2 px = v_uv * u_res;
  float m = threshold(px);
  vec3 src = texture(u_tex, v_uv).rgb;
  src = pow(src, vec3(1.0 / max(u_gamma, 0.01)));
  float l = luma(src);

  if (u_colorMode < 0.5) {            // mono — 1-bit toward fg/bg
    float b = step(m, l);
    fragColor = vec4(mix(u_bg, u_fg, b), 1.0);
  } else if (u_colorMode < 1.5) {     // tonal — N grey levels
    float q = quant(l, m, u_levels);
    fragColor = vec4(mix(u_bg, u_fg, q), 1.0);
  } else if (u_colorMode < 2.5) {     // indexed — palette ramp
    float q = quant(l, m, u_palCount);
    int idx = int(clamp(q * (u_palCount - 1.0), 0.0, u_palCount - 1.0));
    fragColor = vec4(u_pal[idx], 1.0);
  } else if (u_colorMode < 3.5) {     // rgb — per channel
    float L = u_paletteSize;
    vec3 q = vec3(quant(src.r, m, L), quant(src.g, m, L), quant(src.b, m, L));
    fragColor = vec4(q, 1.0);
  } else {                            // original — posterised source
    vec3 q = vec3(quant(src.r, m, u_levels), quant(src.g, m, u_levels), quant(src.b, m, u_levels));
    fragColor = vec4(q, 1.0);
  }
}
`)

// ── Halftone ─────────────────────────────────────────────────────────────
export const HALFTONE = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_shape;     // 0 circle,1 square,2 diamond,3 line
uniform float u_dotScale;
uniform float u_spacing;   // px
uniform float u_angle;
uniform float u_invert;
uniform float u_colorMode; // 0 bw, 1 color
uniform vec3  u_fg;
uniform vec3  u_bg;

void main() {
  vec2 c = u_res * 0.5;
  float a = radians(u_angle);
  mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
  mat2 Rt = mat2(cos(a), sin(a), -sin(a), cos(a));
  vec2 px = v_uv * u_res;
  vec2 rp = R * (px - c) + c;
  vec2 cellIdx = floor(rp / u_spacing);
  vec2 cellCenterR = (cellIdx + 0.5) * u_spacing;
  vec2 srcPx = Rt * (cellCenterR - c) + c;
  vec3 s = texture(u_tex, clamp(srcPx / u_res, 0.0, 1.0)).rgb;
  float ink = clamp(luma(s), 0.0, 1.0);
  ink = mix(1.0 - ink, ink, u_invert);
  float maxR = 0.5 * u_spacing * 1.45 * u_dotScale;
  float radius = sqrt(ink) * maxR;
  vec2 d = rp - cellCenterR;
  float dist;
  if (u_shape < 0.5) dist = length(d);
  else if (u_shape < 1.5) dist = max(abs(d.x), abs(d.y));
  else if (u_shape < 2.5) dist = abs(d.x) + abs(d.y);
  else dist = abs(d.y);
  float inside = 1.0 - smoothstep(radius - 1.0, radius + 1.0, dist);
  vec3 inkC = (u_colorMode < 0.5) ? u_fg : s;
  fragColor = vec4(mix(u_bg, inkC, inside), 1.0);
}
`)

// ── Pixel sort ─────────────────────────────────────────────────────────
export const PIXELSORT = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_dir;     // 0 h,1 v,2 diag
uniform float u_mode;    // 0 brightness,1 hue,2 saturation
uniform float u_threshold;
uniform float u_streak;  // px
uniform float u_intensity;
uniform float u_reverse;

float key(vec3 c) {
  if (u_mode < 0.5) return luma(c);
  vec3 h = rgb2hsv(c);
  return (u_mode < 1.5) ? h.x : h.y;
}
void main() {
  vec2 dir = (u_dir < 0.5) ? vec2(1.0, 0.0) : (u_dir < 1.5) ? vec2(0.0, 1.0) : normalize(vec2(1.0));
  vec2 stp = dir / u_res;
  vec4 cur = texture(u_tex, v_uv);
  float l0 = luma(cur.rgb);
  vec4 best = cur;
  float bestKey = key(cur.rgb);
  int maxSteps = int(clamp(u_streak, 1.0, 220.0));
  for (int i = 1; i < 256; i++) {
    if (i > maxSteps) break;
    vec2 uv = v_uv - stp * float(i);
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) break;
    vec4 s = texture(u_tex, uv);
    if (luma(s.rgb) < u_threshold) break;
    float k = key(s.rgb);
    if (u_reverse < 0.5 ? k > bestKey : k < bestKey) { bestKey = k; best = s; }
  }
  vec3 outc = (l0 >= u_threshold) ? mix(cur.rgb, best.rgb, u_intensity) : cur.rgb;
  fragColor = vec4(outc, 1.0);
}
`)

// ── Dots ────────────────────────────────────────────────────────────────
export const DOTS = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_shape;   // 0 circle,1 square,2 diamond
uniform float u_grid;    // 0 square,1 hex
uniform float u_size;    // multiplier
uniform float u_spacing; // multiplier
uniform float u_invert;
uniform float u_colorMode; // 0 custom,1 original
uniform vec3  u_fg;
uniform vec3  u_bg;

void main() {
  float cell = 10.0 * u_spacing;
  vec2 px = v_uv * u_res;
  vec2 idx = floor(px / cell);
  float rowOff = (u_grid > 0.5) ? mod(idx.y, 2.0) * 0.5 : 0.0;
  idx.x = floor(px.x / cell - rowOff);
  vec2 cc = vec2((idx.x + rowOff + 0.5) * cell, (idx.y + 0.5) * cell);
  vec3 s = texture(u_tex, clamp(cc / u_res, 0.0, 1.0)).rgb;
  float ink = clamp(luma(s), 0.0, 1.0);
  ink = mix(1.0 - ink, ink, u_invert);
  float maxR = 0.5 * cell * 1.4 * u_size;
  float radius = sqrt(ink) * maxR;
  vec2 d = px - cc;
  float dist;
  if (u_shape < 0.5) dist = length(d);
  else if (u_shape < 1.5) dist = max(abs(d.x), abs(d.y));
  else dist = abs(d.x) + abs(d.y);
  float inside = 1.0 - smoothstep(radius - 1.0, radius + 1.0, dist);
  vec3 inkC = (u_colorMode < 0.5) ? u_fg : s;
  fragColor = vec4(mix(u_bg, inkC, inside), 1.0);
}
`)

// ── Contour ──────────────────────────────────────────────────────────────
export const CONTOUR = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_fillMode; // 0 filled, 1 lines
uniform float u_levels;
uniform float u_thickness;
uniform float u_invert;
uniform float u_colorMode; // 0 custom,1 original
uniform vec3  u_line;
uniform vec3  u_bg;

float band(vec2 uv) { return floor(clamp(luma(texture(u_tex, uv).rgb), 0.0, 0.999) * u_levels); }

void main() {
  vec3 src = texture(u_tex, v_uv).rgb;
  float b = band(v_uv);
  vec2 t = u_thickness / u_res;
  float edge = 0.0;
  edge += abs(band(v_uv + vec2(t.x, 0.0)) - b);
  edge += abs(band(v_uv + vec2(0.0, t.y)) - b);
  float isLine = step(0.5, edge);
  float q = b / max(u_levels - 1.0, 1.0);
  q = mix(q, 1.0 - q, u_invert);

  if (u_fillMode > 0.5) {           // lines only
    vec3 base = (u_colorMode < 0.5) ? u_bg : src;
    fragColor = vec4(mix(base, u_line, isLine), 1.0);
  } else {                          // filled bands
    vec3 fill = (u_colorMode < 0.5) ? mix(u_bg, u_line, q) : floor(src * u_levels) / max(u_levels - 1.0, 1.0);
    fragColor = vec4(fill, 1.0);
  }
}
`)

// ── Edge detection ────────────────────────────────────────────────────
export const EDGE = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_algo;    // 0 sobel,1 prewitt,2 laplacian
uniform float u_threshold;
uniform float u_lineWidth;
uniform float u_invert;
uniform float u_colorMode; // 0 custom,1 original
uniform vec3  u_edge;
uniform vec3  u_bg;

float L(vec2 uv) { return luma(texture(u_tex, uv).rgb); }
void main() {
  vec2 t = u_lineWidth / u_res;
  float tl=L(v_uv+t*vec2(-1,1)), tm=L(v_uv+t*vec2(0,1)), tr=L(v_uv+t*vec2(1,1));
  float ml=L(v_uv+t*vec2(-1,0)), mm=L(v_uv), mr=L(v_uv+t*vec2(1,0));
  float bl=L(v_uv+t*vec2(-1,-1)), bm=L(v_uv+t*vec2(0,-1)), br=L(v_uv+t*vec2(1,-1));
  float mag;
  if (u_algo < 1.5) {
    float w = (u_algo < 0.5) ? 2.0 : 1.0;
    float gx = (tr + w*mr + br) - (tl + w*ml + bl);
    float gy = (tl + w*tm + tr) - (bl + w*bm + br);
    mag = length(vec2(gx, gy));
  } else {
    mag = abs(8.0*mm - (tl+tm+tr+ml+mr+bl+bm+br));
  }
  float e = smoothstep(u_threshold, u_threshold + 0.12, mag);
  e = mix(e, 1.0 - e, u_invert);
  vec3 ec = (u_colorMode < 0.5) ? u_edge : texture(u_tex, v_uv).rgb;
  fragColor = vec4(mix(u_bg, ec, e), 1.0);
}
`)

// ── Crosshatch ────────────────────────────────────────────────────────
export const CROSSHATCH = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_density;   // line spacing base
uniform float u_layers;    // 1..4
uniform float u_angle;
uniform float u_lineWidth;
uniform float u_randomness;
uniform float u_invert;
uniform vec3  u_fg;
uniform vec3  u_bg;

float hatch(vec2 px, float ang, float spacing, float w) {
  float a = radians(ang);
  float coord = px.x * cos(a) + px.y * sin(a);
  float f = abs(fract(coord / spacing) - 0.5) * 2.0; // 0 at line centre
  return 1.0 - smoothstep(0.0, w / spacing, f);
}
void main() {
  vec3 src = texture(u_tex, v_uv).rgb;
  float l = clamp(luma(src), 0.0, 1.0);
  l = mix(l, 1.0 - l, u_invert);
  float dark = 1.0 - l;
  vec2 px = v_uv * u_res + (hash21(floor(v_uv * u_res / 4.0)) - 0.5) * u_randomness * 8.0;
  float spacing = max(2.0, u_density * 1.4);
  float w = max(1.0, u_lineWidth);
  float ink = 0.0;
  // progressively add layers as the pixel gets darker
  if (dark > 0.0) ink = max(ink, hatch(px, u_angle, spacing, w) * step(0.05, dark));
  if (u_layers > 1.5 && dark > 0.28) ink = max(ink, hatch(px, u_angle + 90.0, spacing, w));
  if (u_layers > 2.5 && dark > 0.52) ink = max(ink, hatch(px, u_angle + 45.0, spacing, w));
  if (u_layers > 3.5 && dark > 0.74) ink = max(ink, hatch(px, u_angle + 135.0, spacing, w));
  ink *= smoothstep(0.0, 0.15, dark);
  fragColor = vec4(mix(u_bg, u_fg, ink), 1.0);
}
`)

// ── Blockify ─────────────────────────────────────────────────────────────
export const BLOCKIFY = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_block;
uniform float u_style;   // 0 full,1 shaded,2 outline
uniform float u_border;
uniform vec3  u_borderColor;
uniform float u_colorMode; // 0 color,1 grayscale

vec3 blockAvg(vec2 cell) {
  vec3 s = vec3(0.0);
  for (int j = 0; j < 4; j++)
    for (int i = 0; i < 4; i++) {
      vec2 uv = (cell + (vec2(float(i), float(j)) + 0.5) / 4.0) * u_block / u_res;
      s += texture(u_tex, clamp(uv, 0.0, 1.0)).rgb;
    }
  return s / 16.0;
}
void main() {
  vec2 px = v_uv * u_res;
  vec2 cell = floor(px / u_block);
  vec3 avg = blockAvg(cell);
  if (u_colorMode > 0.5) avg = vec3(luma(avg));
  if (u_style > 0.5 && u_style < 1.5) {     // shaded — quantise brightness
    float q = floor(luma(avg) * 6.0) / 5.0;
    avg = clamp(avg * (0.45 + 0.55 * q), 0.0, 1.0);
  }
  vec2 inCell = px - cell * u_block;
  float bw = max(u_border, u_style > 1.5 ? 1.0 : 0.0);
  float onBorder = (inCell.x < bw || inCell.y < bw || inCell.x > u_block - bw || inCell.y > u_block - bw) ? 1.0 : 0.0;
  vec3 outc;
  if (u_style > 1.5) outc = onBorder > 0.5 ? avg : avg * 0.08; // outline: cell edges only
  else outc = mix(avg, u_borderColor, u_border > 0.0 ? onBorder : 0.0);
  fragColor = vec4(outc, 1.0);
}
`)

// ── Threshold ─────────────────────────────────────────────────────────
export const THRESHOLD = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform sampler2D u_noise;
uniform vec2  u_res;
uniform float u_levels;
uniform float u_point;   // threshold point
uniform float u_dither;
uniform float u_invert;
uniform float u_colorMode; // 0 custom,1 color
uniform vec3  u_fg;
uniform vec3  u_bg;

void main() {
  vec2 px = v_uv * u_res;
  vec3 src = texture(u_tex, v_uv).rgb;
  float l = luma(src);
  float d = (u_dither > 0.5) ? (bayer8(px) - 0.5) / u_levels : 0.0;
  l = clamp(l + d, 0.0, 1.0);
  // bias around threshold point
  l = clamp((l - u_point) / max(0.0001, (l > u_point ? (1.0 - u_point) : u_point)) * 0.5 + 0.5, 0.0, 1.0);
  float q = floor(l * u_levels) / max(u_levels - 1.0, 1.0);
  q = mix(q, 1.0 - q, u_invert);
  if (u_colorMode < 0.5) {
    fragColor = vec4(mix(u_bg, u_fg, q), 1.0);
  } else {
    vec3 pq = floor(src * u_levels) / max(u_levels - 1.0, 1.0);
    fragColor = vec4(mix(pq, 1.0 - pq, u_invert), 1.0);
  }
}
`)

// ── Noise field ──────────────────────────────────────────────────────
export const NOISEFIELD = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_time;
uniform float u_type;    // 0 perlin,1 simplex,2 worley
uniform float u_scale;
uniform float u_intensity;
uniform float u_octaves;
uniform float u_speed;
uniform float u_animate;
uniform float u_distortOnly;

float field(vec2 p) {
  float t = u_animate > 0.5 ? u_time * u_speed : 0.0;
  if (u_type < 0.5) {        // perlin-ish via fbm
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 8; i++) { if (float(i) >= u_octaves) break; v += a * vnoise(p + t); p *= 2.0; a *= 0.5; }
    return v;
  } else if (u_type < 1.5) { // simplex-ish (smoother fbm)
    return fbm(p * 0.8 + t);
  }
  return 1.0 - worley(p * 0.5 + t); // worley
}
void main() {
  vec2 p = v_uv * (u_scale * 0.1) * vec2(u_res.x / u_res.y, 1.0);
  float n = field(p);
  if (u_distortOnly > 0.5) {
    vec2 off = vec2(field(p + 3.1), field(p + 7.7)) - 0.5;
    vec3 s = texture(u_tex, clamp(v_uv + off * u_intensity * 0.1, 0.0, 1.0)).rgb;
    fragColor = vec4(s, 1.0);
  } else {
    vec3 s = texture(u_tex, v_uv).rgb;
    vec3 outc = mix(s, s * (0.4 + n * 1.2), clamp(u_intensity, 0.0, 1.0));
    outc = clamp(outc + (n - 0.5) * (u_intensity - 1.0) * 0.5, 0.0, 1.0);
    fragColor = vec4(outc, 1.0);
  }
}
`)

// ── Matrix rain ──────────────────────────────────────────────────────
export const MATRIX = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform sampler2D u_atlas;
uniform float u_count;
uniform vec2  u_res;
uniform float u_time;
uniform float u_cell;
uniform float u_speed;
uniform float u_trail;     // cells
uniform float u_dir;       // 0 down,1 up,2 left,3 right
uniform float u_glow;
uniform float u_bgOpacity;
uniform vec3  u_rain;
uniform float u_threshold;

void main() {
  vec2 px = v_uv * u_res;
  vec2 cell = floor(px / u_cell);
  vec2 local = fract(px / u_cell);
  bool vert = u_dir < 1.5;                 // down(0) / up(1) are vertical
  bool reverse = (u_dir == 1.0 || u_dir == 2.0); // up / left run in reverse
  float colId = vert ? cell.x : cell.y;
  float pos = vert ? cell.y : cell.x;
  float colLen = vert ? (u_res.y / u_cell) : (u_res.x / u_cell);
  float effPos = reverse ? (colLen - pos) : pos;

  float colRand = hash21(vec2(colId, 1.0));
  float speed = (0.4 + colRand) * u_speed;
  float head = fract(u_time * speed * 0.12 + colRand) * (colLen + 24.0) - 12.0;
  float fromHead = head - effPos;
  float intensity = clamp(1.0 - fromHead / max(u_trail, 1.0), 0.0, 1.0) * step(0.0, fromHead);

  float gid = floor(u_time * 7.0 + pos * 1.3 + colId * 2.1);
  vec2 luv = vert ? local : local.yx;
  float idx = floor(hash21(vec2(gid, colId)) * u_count);
  float cov = texture(u_atlas, vec2((idx + clamp(luv.x, 0.0, 1.0)) / u_count, luv.y)).r;

  vec3 src = texture(u_tex, (cell + 0.5) * u_cell / u_res).rgb;
  float srcMask = mix(1.0, step(u_threshold, luma(src)), step(0.001, u_threshold));
  float bright = intensity * cov * srcMask;
  float isHead = step(0.0, fromHead) * step(fromHead, 1.0);
  vec3 col = u_rain * bright * (0.6 + u_glow);
  col = mix(col, vec3(0.85, 1.0, 0.9), isHead * cov * 0.9);
  vec3 bg = src * (1.0 - u_bgOpacity);
  fragColor = vec4(bg + col, 1.0);
}
`)

// ── VHS ──────────────────────────────────────────────────────────────
export const VHS = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_time;
uniform float u_distortion;
uniform float u_noise;
uniform float u_colorBleed;
uniform float u_scanlines;
uniform float u_tracking;

void main() {
  vec2 uv = v_uv;
  float line = floor(uv.y * u_res.y);
  // tracking error: occasional horizontal jump on some scanlines
  float band = step(0.985 - u_tracking * 0.06, hash21(vec2(line, floor(u_time * 8.0))));
  float jitter = (hash21(vec2(line, floor(u_time * 24.0))) - 0.5) * u_tracking * 0.08;
  uv.x += jitter + band * (hash21(vec2(floor(u_time*4.0), line)) - 0.5) * 0.2;
  // wavy distortion
  uv.x += sin(uv.y * 30.0 + u_time * 3.0) * u_distortion * 0.01;
  // colour bleed (horizontal RGB offset)
  float o = u_colorBleed * 0.012;
  float r = texture(u_tex, uv + vec2(o, 0.0)).r;
  vec4 g = texture(u_tex, uv);
  float b = texture(u_tex, uv - vec2(o, 0.0)).b;
  vec3 col = vec3(r, g.g, b);
  // bleed smear
  col = mix(col, texture(u_tex, uv + vec2(o * 2.0, 0.0)).rgb, u_colorBleed * 0.3);
  // noise
  float n = hash21(uv * u_res + u_time * 60.0);
  col += (n - 0.5) * u_noise;
  // scanlines
  col *= 1.0 - u_scanlines * (0.5 + 0.5 * sin(uv.y * u_res.y * 3.14159));
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`)

// ── Voronoi ──────────────────────────────────────────────────────────
export const VORONOI = frag(/* glsl */ `
uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_cell;      // px
uniform float u_edgeWidth;
uniform float u_edgeColor; // 0 black,1 white,2 darkened
uniform float u_colorMode; // 0 cell avg,1 center sample,2 gradient
uniform float u_randomize;

void main() {
  float scale = u_res.x / u_cell;
  vec2 g = vec2(scale, scale * u_res.y / u_res.x);
  vec2 p = v_uv * g;
  vec2 cell = floor(p);
  float d1 = 1e9, d2 = 1e9;
  vec2 best = p;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      vec2 jit = (vec2(hash21(c), hash21(c + 19.1)) - 0.5) * u_randomize;
      vec2 feat = c + 0.5 + jit;
      float d = distance(p, feat);
      if (d < d1) { d2 = d1; d1 = d; best = feat; }
      else if (d < d2) d2 = d;
    }
  vec2 srcUV = clamp(best / g, 0.0, 1.0);
  vec3 col;
  if (u_colorMode < 1.5) col = texture(u_tex, srcUV).rgb;       // avg/center ≈ feature sample
  else col = texture(u_tex, v_uv).rgb * (0.6 + 0.4 * (1.0 - d1)); // gradient
  float edge = smoothstep(0.0, 0.02 + u_edgeWidth * 0.15, d2 - d1);
  vec3 ec = (u_edgeColor < 0.5) ? vec3(0.0) : (u_edgeColor < 1.5) ? vec3(1.0) : col * 0.3;
  fragColor = vec4(mix(ec, col, edge), 1.0);
}
`)

export const COPY = frag(/* glsl */ `
uniform sampler2D u_tex;
void main() { fragColor = texture(u_tex, v_uv); }
`)
