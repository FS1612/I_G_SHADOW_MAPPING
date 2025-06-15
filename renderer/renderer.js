import { multiply } from '../utils/math-utils.js';

/**
 * Handles rendering of 3D objects in WebGL by managing shader attributes and uniforms.
 */
export class Renderer {
    /**
     * Initializes the renderer with the WebGL context and shader program.
     * Binds attribute and uniform locations for fast access during rendering.
     * 
     * Stores shader-related locations for:
     * - Vertex attributes: position, normal, texture coordinates
     * - Uniforms: matrices, color, lighting, shadow and object type flags
     *
     * @param {WebGLRenderingContext} gl - The WebGL rendering context.
     * @param {WebGLProgram} program - The compiled and linked shader program.
     */
    constructor(gl, program) {
        this.gl = gl;
        this.program = program;
        this.shadowProgram = null;

        // Vertex attributes
        this.positionLocation = gl.getAttribLocation(program, 'a_position');
        this.normalLocation = gl.getAttribLocation(program, 'a_normal');
        this.texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');

        // Uniforms
        this.mvpMatrixLocation = gl.getUniformLocation(program, 'u_modelViewProjectionMatrix');
        this.modelMatrixLocation = gl.getUniformLocation(program, 'u_modelMatrix');
        this.normalMatrixLocation = gl.getUniformLocation(program, 'u_normalMatrix');
        this.colorLocation = gl.getUniformLocation(program, 'u_color');
        this.lightDirectionLocation = gl.getUniformLocation(program, 'u_lightDirection');
        this.isGroundLocation = gl.getUniformLocation(program, 'u_isGround');
        this.isGnomonLocation = gl.getUniformLocation(program, 'u_isGnomon');
        this.isHourLineLocation = gl.getUniformLocation(program, 'u_isHourLine');
        this.gnomonPositionLocation = gl.getUniformLocation(program, 'u_gnomonPosition');
        this.enableShadowsLocation = gl.getUniformLocation(program, 'u_enableShadows');
        this.lowQualityLocation = gl.getUniformLocation(program, 'u_lowQuality');
    }

    /**
     * Draws a 3D object using the current shader and WebGL context.
     * Configures vertex attributes and passes color and type-specific uniforms.
     * 
     * @param {WebGLBuffer} vertexBuffer - Vertex buffer containing position, normal, texCoord.
     * @param {WebGLBuffer} indexBuffer - Index buffer for element drawing.
     * @param {number} indexCount - Number of indices to draw.
     * @param {number[]} color - RGB color array (e.g. [0.5, 0.6, 0.7]).
     * @param {boolean} [isGround=false] - True if drawing the ground plane.
     * @param {boolean} [isGnomon=false] - True if drawing the gnomon.
     * @param {boolean} [isHourLine=false] - True if drawing hour line geometry.
     */
    drawObject(vertexBuffer, indexBuffer, indexCount, color, isGround = false, isGnomon = false, isHourLine = false) {
        const gl = this.gl;

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

        // Vertex format: position(3) + normal(3) + texCoord(2) = 8 floats = 32 bytes
        gl.enableVertexAttribArray(this.positionLocation);
        gl.vertexAttribPointer(this.positionLocation, 3, gl.FLOAT, false, 32, 0);

        gl.enableVertexAttribArray(this.normalLocation);
        gl.vertexAttribPointer(this.normalLocation, 3, gl.FLOAT, false, 32, 12);

        gl.enableVertexAttribArray(this.texCoordLocation);
        gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 32, 24);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        gl.uniform3fv(this.colorLocation, color);
        gl.uniform1f(this.isGroundLocation, isGround ? 1.0 : 0.0);
        gl.uniform1f(this.isGnomonLocation, isGnomon ? 1.0 : 0.0);
        gl.uniform1f(this.isHourLineLocation, isHourLine ? 1.0 : 0.0);

        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
    }

    /**
     * Sets uniforms shared across all objects for the current frame.
     * Includes lighting, transformation, and gnomon position.
     * 
     * @param {number[]} lightDirection - Normalized [x, y, z] direction of the sun.
     * @param {Float32Array} mvpMatrix - Model-View-Projection matrix.
     * @param {Float32Array} modelMatrix - Model transformation matrix.
     * @param {Float32Array} normalMatrix - Matrix for transforming normals.
     * @param {boolean} enableShadows - Whether shadows are enabled.
     * @param {boolean} lowQuality - Whether low quality mode is enabled.
     */
    setUniforms(lightDirection, mvpMatrix, modelMatrix, normalMatrix, enableShadows = true, lowQuality = false) {
        const gl = this.gl;

        gl.uniform3fv(this.lightDirectionLocation, lightDirection);
        gl.uniform3fv(this.gnomonPositionLocation, [0, 0, 0]);
        gl.uniformMatrix4fv(this.mvpMatrixLocation, false, mvpMatrix);
        gl.uniformMatrix4fv(this.modelMatrixLocation, false, modelMatrix);
        gl.uniformMatrix4fv(this.normalMatrixLocation, false, normalMatrix);
        gl.uniform1f(this.enableShadowsLocation, enableShadows ? 1.0 : 0.0);
        gl.uniform1f(this.lowQualityLocation, lowQuality ? 1.0 : 0.0);
    }

    /**
 * Draws an object using the shadow shader for depth-only rendering.
 * Assumes the vertex buffer contains interleaved position, normal, and texCoord data.
 *
 * Vertex format: 3 floats position, 3 floats normal, 2 floats texCoord (stride: 32 bytes).
 *
 * @param {WebGLBuffer} vertexBuffer - The buffer containing interleaved vertex data.
 * @param {WebGLBuffer} indexBuffer - The buffer containing indices.
 * @param {number} indexCount - The number of indices to render.
 */
    drawShadowObject(vertexBuffer, indexBuffer, indexCount) {
        const gl = this.gl;

        // Bind vertex buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

        // Get position attribute location for shadow program
        const positionLocation = gl.getAttribLocation(this.shadowProgram, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        // Vertex format: position(3) + normal(3) + texCoord(2) = 8 floats = 32 bytes stride
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 32, 0);

        // Bind index buffer and draw
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
    }

    /**
 * Sets the shader program used for shadow map rendering.
 * Must be called before rendering objects with `drawShadowObject`.
 *
 * @param {WebGLProgram} shadowProgram - The compiled shader program for depth rendering.
 */
    setShadowProgram(shadowProgram) {
        this.shadowProgram = shadowProgram;
    }
}