// ─────────────────────────────────────────────────────────────────────────
// WebGL2 primitives: context, shader/program compilation, fullscreen-quad
// passes, and a typed uniform setter. Kept dependency-free and imperative so
// the render loop never touches React.
// ─────────────────────────────────────────────────────────────────────────

export class GLError extends Error {}

export function createGL(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true, // needed for canvas-to-blob export
    powerPreference: 'high-performance',
  })
  if (!gl) throw new GLError('WebGL2 is not available in this browser.')
  // Float render targets are nice-to-have; we degrade gracefully without them.
  gl.getExtension('EXT_color_buffer_float')
  gl.getExtension('OES_texture_float_linear')
  return gl
}

export const VERT_FULLSCREEN = /* glsl */ `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
  label: string,
): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new GLError(`Failed to compile ${label} shader:\n${log}\n\n${numberLines(src)}`)
  }
  return sh
}

function numberLines(src: string): string {
  return src
    .split('\n')
    .map((l, i) => `${String(i + 1).padStart(3, ' ')}| ${l}`)
    .join('\n')
}

export type UniformValue =
  | number
  | boolean
  | Float32Array
  | number[]
  | { texture: WebGLTexture; unit: number }

export class Program {
  readonly program: WebGLProgram
  private uniformLocs = new Map<string, WebGLUniformLocation | null>()

  constructor(
    private gl: WebGL2RenderingContext,
    fragSrc: string,
    vertSrc: string = VERT_FULLSCREEN,
    label = 'program',
  ) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc, `${label}:vert`)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc, `${label}:frag`)
    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.bindAttribLocation(program, 0, 'a_pos')
    gl.linkProgram(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program)
      gl.deleteProgram(program)
      throw new GLError(`Failed to link ${label}:\n${log}`)
    }
    this.program = program
  }

  private loc(name: string): WebGLUniformLocation | null {
    if (!this.uniformLocs.has(name)) {
      this.uniformLocs.set(name, this.gl.getUniformLocation(this.program, name))
    }
    return this.uniformLocs.get(name)!
  }

  use(): this {
    this.gl.useProgram(this.program)
    return this
  }

  set(uniforms: Record<string, UniformValue>): this {
    const gl = this.gl
    for (const name in uniforms) {
      const loc = this.loc(name)
      if (loc === null) continue
      const v = uniforms[name]
      if (typeof v === 'number') {
        gl.uniform1f(loc, v)
      } else if (typeof v === 'boolean') {
        // shaders declare these flags as `float`, so set them as floats
        gl.uniform1f(loc, v ? 1 : 0)
      } else if (Array.isArray(v) || v instanceof Float32Array) {
        const arr = v as ArrayLike<number>
        switch (arr.length) {
          case 2:
            gl.uniform2f(loc, arr[0], arr[1])
            break
          case 3:
            gl.uniform3f(loc, arr[0], arr[1], arr[2])
            break
          case 4:
            gl.uniform4f(loc, arr[0], arr[1], arr[2], arr[3])
            break
          default:
            gl.uniform1fv(loc, arr as Float32List)
        }
      } else {
        // texture sampler bound to a unit
        gl.activeTexture(gl.TEXTURE0 + v.unit)
        gl.bindTexture(gl.TEXTURE_2D, v.texture)
        gl.uniform1i(loc, v.unit)
      }
    }
    return this
  }

  /** Set a `vec3[]` uniform from a flat Float32Array (length = n*3). */
  setVec3Array(name: string, arr: Float32Array): this {
    const loc = this.loc(name)
    if (loc !== null) this.gl.uniform3fv(loc, arr)
    return this
  }

  dispose() {
    this.gl.deleteProgram(this.program)
  }
}

/** A single fullscreen-quad VAO, shared by every pass on one context. */
export class FullscreenQuad {
  private vao: WebGLVertexArrayObject

  constructor(private gl: WebGL2RenderingContext) {
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    // two triangles covering clip space
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    )
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
    this.vao = vao
  }

  draw() {
    this.gl.bindVertexArray(this.vao)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3)
    this.gl.bindVertexArray(null)
  }
}

/** Convert "#rrggbb" to a normalised [r,g,b] triple for shader uniforms. */
export function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.padEnd(6, '0')
  const int = parseInt(n, 16)
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255]
}
