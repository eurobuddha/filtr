// Off-screen render targets (texture + FBO) and a ping-pong pair used to
// chain effect passes. All targets are 8-bit RGBA with linear filtering.

export class RenderTarget {
  texture: WebGLTexture
  fbo: WebGLFramebuffer
  width = 0
  height = 0

  constructor(
    private gl: WebGL2RenderingContext,
    filter: number = gl.LINEAR,
  ) {
    this.texture = gl.createTexture()!
    this.fbo = gl.createFramebuffer()!
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return
    const gl = this.gl
    this.width = width
    this.height = height
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.texture,
      0,
    )
  }

  /** Bind this target for drawing and set the viewport. */
  bind() {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.viewport(0, 0, this.width, this.height)
  }

  dispose() {
    this.gl.deleteTexture(this.texture)
    this.gl.deleteFramebuffer(this.fbo)
  }
}

export class PingPong {
  private a: RenderTarget
  private b: RenderTarget

  constructor(gl: WebGL2RenderingContext, filter?: number) {
    this.a = new RenderTarget(gl, filter)
    this.b = new RenderTarget(gl, filter)
  }

  resize(w: number, h: number) {
    this.a.resize(w, h)
    this.b.resize(w, h)
  }

  get read() {
    return this.a
  }
  get write() {
    return this.b
  }
  swap() {
    const t = this.a
    this.a = this.b
    this.b = t
  }

  dispose() {
    this.a.dispose()
    this.b.dispose()
  }
}
