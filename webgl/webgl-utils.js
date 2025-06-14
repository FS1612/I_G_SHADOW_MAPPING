/**
 * Compiles a WebGL shader from source code.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {number} type - The shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER).
 * @param {string} source - GLSL source code.
 * @returns {WebGLShader|null} The compiled shader or null if compilation failed.
 */
export function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}
/**
 * Links a shader program using compiled vertex and fragment shaders.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {WebGLShader} vertexShader - The compiled vertex shader.
 * @param {WebGLShader} fragmentShader - The compiled fragment shader.
 * @returns {WebGLProgram|null} The linked program or null if linking failed.
 */
export function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}
/**
 * Creates and populates a vertex buffer.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {BufferSource} data - Float32Array of vertex data.
 * @returns {WebGLBuffer} The created buffer.
 */
export function createBuffer(gl, data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}
/**
 * Creates and populates an index buffer.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {BufferSource} data - Uint16Array of indices.
 * @returns {WebGLBuffer} The created index buffer.
 */
export function createIndexBuffer(gl, data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}
/**
 * Initializes a WebGL context from a canvas.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @returns {WebGLRenderingContext|null} The WebGL context or null if unsupported.
 */
export function initializeWebGL(canvas) {
    const gl = canvas.getContext('webgl');
    
    if (!gl) {
        alert('WebGL not supported!');
        return null;
    }
    
    return gl;
}
/**
 * Resizes the canvas to match the window and updates the viewport.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 */
export function resizeCanvas(canvas, gl) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
/**
 * Configures WebGL rendering state (clears screen, enables depth test).
 * @param {WebGLRenderingContext} gl - The WebGL context.
 */
export function setupWebGLState(gl) {
    gl.clearColor(0.5, 0.7, 1.0, 1.0);// sky blue
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);// enable Z-buffer
    gl.disable(gl.CULL_FACE);// draw both triangle faces
}