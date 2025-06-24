import { mat4, identity, multiply } from '../utils/math-utils.js';

/**
 * Renders a large, animated sky dome that surrounds the scene.
 * 
 * This function uses a dedicated sky shader program and disables depth testing,
 * so the sky always appears behind all objects. It applies a large scaling
 * transform and feeds time and light direction into the shader for dynamic effects.
 * 
 * @param {Float32Array} lightDirection - Direction of sunlight (used for coloring/gradient).
 * @param {Float32Array} projectionMatrix - Camera projection matrix.
 * @param {Float32Array} viewMatrix - Camera view matrix.
 * @param {number} time - Animation time in milliseconds (used for dynamic sky changes).
 */
export function renderSky(lightDirection, projectionMatrix, viewMatrix, time) {
    const gl = this.gl;

    if (!this.skyProgram) {
        console.error('Sky program not created');
        return;
    }

    // === Preserve currently active program ===
    const previousProgram = this.program;

    // === Use the dedicated sky shader program ===
    gl.useProgram(this.skyProgram); // Reset to identity

    // === Prevent sky geometry from writing depth ===
    gl.depthMask(false);// Disable writing to depth buffer
    gl.disable(gl.DEPTH_TEST);// Disable depth testing (sky should always render behind)

    // === Build a large model matrix for the sky dome ===
    const skyModelMatrix = mat4();
    identity(skyModelMatrix);// Reset to identity

    // Scale sky dome to be very large around the camera
    skyModelMatrix[0] = 50; // Scale X
    skyModelMatrix[5] = 50; // Scale Y
    skyModelMatrix[10] = 50; // Scale Z

    // === Compute full MVP matrix ===
    const skyMvpMatrix = mat4();
    multiply(skyMvpMatrix, projectionMatrix, viewMatrix);
    multiply(skyMvpMatrix, skyMvpMatrix, skyModelMatrix);

    // === Set uniform variables for the shader ===
    const skyMvpLocation = gl.getUniformLocation(this.skyProgram, 'u_modelViewProjectionMatrix');
    const skyLightLocation = gl.getUniformLocation(this.skyProgram, 'u_lightDirection');
    const skyTimeLocation = gl.getUniformLocation(this.skyProgram, 'u_time');

    if (skyMvpLocation) gl.uniformMatrix4fv(skyMvpLocation, false, skyMvpMatrix);
    if (skyLightLocation) gl.uniform3fv(skyLightLocation, lightDirection);
    if (skyTimeLocation) gl.uniform1f(skyTimeLocation, time * 0.001);

    // === Bind sky geometry and draw ===
    if (this.skyBuffers.vertex && this.skyBuffers.index) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffers.vertex);
        const skyPositionLocation = gl.getAttribLocation(this.skyProgram, 'a_position');
        if (skyPositionLocation >= 0) {
            gl.enableVertexAttribArray(skyPositionLocation);
            gl.vertexAttribPointer(skyPositionLocation, 3, gl.FLOAT, false, 0, 0);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.skyBuffers.index);
        gl.drawElements(gl.TRIANGLES, this.skyGeometry.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    // === Restore default depth state ===
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);

    // === Restore previous shader program ===
    gl.useProgram(previousProgram);
}
