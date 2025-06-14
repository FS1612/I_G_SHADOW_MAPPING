
import { multiply } from '../utils/math-utils.js';
/**
 * Handles rendering of 3D objects in WebGL by managing shader attributes and uniforms.
 */
export class Renderer {
    /**
     * Initializes the renderer with the WebGL context and shader program.
     * Binds attribute and uniform locations for fast access during rendering.
     * 
     * @param {WebGLRenderingContext} gl - The WebGL context.
     * @param {WebGLProgram} program - The compiled shader program.
     */
    constructor(gl, program) {
        this.gl = gl;
        this.program = program;
        
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
     */
    setUniforms(lightDirection, mvpMatrix, modelMatrix, normalMatrix) {
        const gl = this.gl;
        
        gl.uniform3fv(this.lightDirectionLocation, lightDirection);
        gl.uniform3fv(this.gnomonPositionLocation, [0, 0, 0]);
        gl.uniformMatrix4fv(this.mvpMatrixLocation, false, mvpMatrix);
        gl.uniformMatrix4fv(this.modelMatrixLocation, false, modelMatrix);
        gl.uniformMatrix4fv(this.normalMatrixLocation, false, normalMatrix);
    }
}