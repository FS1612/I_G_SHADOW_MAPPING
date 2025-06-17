import { mat4, identity, multiply } from '../utils/math-utils.js';

export function renderSun(viewMatrix, projectionMatrix, sunPosition, lightDirection, values) {
    const gl = this.gl;

    const u_isSphereLocation = gl.getUniformLocation(this.program, 'u_isSphere');
    if (u_isSphereLocation) gl.uniform1f(u_isSphereLocation, 1.0);

    const sunModelMatrix = mat4();
    identity(sunModelMatrix);
    sunModelMatrix[12] = sunPosition[0];
    sunModelMatrix[13] = sunPosition[1];
    sunModelMatrix[14] = sunPosition[2];

    const sunScale = 0.8;
    sunModelMatrix[0] = sunScale;
    sunModelMatrix[5] = sunScale;
    sunModelMatrix[10] = sunScale;

    const sunMvpMatrix = mat4();
    multiply(sunMvpMatrix, projectionMatrix, viewMatrix);
    multiply(sunMvpMatrix, sunMvpMatrix, sunModelMatrix);

    this.renderer.setUniforms(lightDirection, sunMvpMatrix, sunModelMatrix, sunModelMatrix, values.enableShadows, values.lowQuality);

    this.renderer.drawObject(
        this.buffers.sunVertex,
        this.buffers.sunIndex,
        this.geometries.sun.indices.length,
        [1.0, 0.9, 0.6],
        false, false, false
    );
}
