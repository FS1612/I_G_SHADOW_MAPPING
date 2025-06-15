
import { shadowVertexShaderSource, shadowFragmentShaderSource, skyVertexShaderSource, skyFragmentShaderSource } from './shaders.js';
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
/**
 * Initializes a shadow map framebuffer, texture, and associated shaders.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @returns {{
 *   shadowFramebuffer: WebGLFramebuffer,
 *   shadowTexture: WebGLTexture,
 *   shadowProgram: WebGLProgram
 * }} An object containing the framebuffer, shadow texture, and compiled shader program for shadow rendering.
 */
export function initShadowMap(gl) {
    const shadowMapSize = 2048; // resolution setting
    
    // Create shadow map texture 
    const shadowTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, shadowMapSize, shadowMapSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    
    // filtering for shadow maps
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    // Create framebuffer
    const shadowFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTexture, 0);
    
    // Create depth buffer
    const depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, shadowMapSize, shadowMapSize);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    // Create shadow program
    const shadowVertexShader = createShader(gl, gl.VERTEX_SHADER, shadowVertexShaderSource);
    const shadowFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, shadowFragmentShaderSource);
    const shadowProgram = createProgram(gl, shadowVertexShader, shadowFragmentShader);
    
    return { shadowFramebuffer, shadowTexture, shadowProgram };
}
/**
 * Crea i shader per il cielo
 */
export function createSkyProgram(gl, skyVertexShaderSource, skyFragmentShaderSource) {
    const skyVertexShader = createShader(gl, gl.VERTEX_SHADER, skyVertexShaderSource);
    const skyFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, skyFragmentShaderSource);
    return createProgram(gl, skyVertexShader, skyFragmentShader);
}

/**
 * Crea la geometria per la cupola del cielo
 */
export function createSkyDome(gl) {
    const vertices = [];
    const indices = [];
    
    const radius = 100;
    const segments = 32;
    const rings = 16;
    
    // Genera vertici
    for (let ring = 0; ring <= rings; ring++) {
        const phi = (ring / rings) * Math.PI * 0.5; // Solo metà superiore
        for (let seg = 0; seg <= segments; seg++) {
            const theta = (seg / segments) * Math.PI * 2;
            
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.cos(phi);
            const z = radius * Math.sin(phi) * Math.sin(theta);
            
            vertices.push(x, y, z);
        }
    }
    
    // Genera indici
    for (let ring = 0; ring < rings; ring++) {
        for (let seg = 0; seg < segments; seg++) {
            const current = ring * (segments + 1) + seg;
            const next = current + segments + 1;
            
            indices.push(current, next, current + 1);
            indices.push(next, next + 1, current + 1);
        }
    }
    
    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
    };
}