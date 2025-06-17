import { mat4, identity, multiply } from '../utils/math-utils.js';

/**
 * Renders the animated sky dome with sun position.
 */

export function renderSky(lightDirection, projectionMatrix, viewMatrix, time) {
    const gl = this.gl;

    if (!this.skyProgram) {
        console.error('Sky program not created');
        return;
    }

    // Save current program
    const previousProgram = this.program;

    // Use sky program
    gl.useProgram(this.skyProgram);

    // Disable depth writing for sky
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);

    // Sky MVP matrix (large scale)
    const skyModelMatrix = mat4();
    const skyMvpMatrix = mat4();
    identity(skyModelMatrix);

    // Scale sky to be very large
    skyModelMatrix[0] = 50; // Scale X
    skyModelMatrix[5] = 50; // Scale Y
    skyModelMatrix[10] = 50; // Scale Z

    multiply(skyMvpMatrix, projectionMatrix, viewMatrix);
    multiply(skyMvpMatrix, skyMvpMatrix, skyModelMatrix);

    // Set sky uniforms
    const skyMvpLocation = gl.getUniformLocation(this.skyProgram, 'u_modelViewProjectionMatrix');
    const skyLightLocation = gl.getUniformLocation(this.skyProgram, 'u_lightDirection');
    const skyTimeLocation = gl.getUniformLocation(this.skyProgram, 'u_time');

    if (skyMvpLocation) gl.uniformMatrix4fv(skyMvpLocation, false, skyMvpMatrix);
    if (skyLightLocation) gl.uniform3fv(skyLightLocation, lightDirection);
    if (skyTimeLocation) gl.uniform1f(skyTimeLocation, time * 0.001);

    // Bind and draw sky geometry
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

    // Re-enable depth test and writing
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);

    // Restore previous program
    gl.useProgram(previousProgram);
}
