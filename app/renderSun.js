import { mat4, identity, multiply } from '../utils/math-utils.js';
/**
 * Renders the sun as a scaled glowing sphere positioned in the sky.
 * 
 * This function sets up the model matrix based on the sun's world position,
 * applies scaling to simulate sun size, and then builds the MVP matrix to
 * correctly render it from the camera's perspective.
 * 
 * @param {Float32Array} viewMatrix - View matrix representing camera orientation.
 * @param {Float32Array} projectionMatrix - Projection matrix for screen conversion.
 * @param {Float32Array} sunPosition - 3D world-space position of the sun.
 * @param {Float32Array} lightDirection - Light direction vector (used in shaders).
 * @param {Object} values - Rendering options (shadows, quality).
 */
export function renderSun(viewMatrix, projectionMatrix, sunPosition, lightDirection, values) {
    const gl = this.gl;

    // Tell the shader this object is a sphere (used for special shading like glow)
    const u_isSphereLocation = gl.getUniformLocation(this.program, 'u_isSphere');
    if (u_isSphereLocation) gl.uniform1f(u_isSphereLocation, 1.0);
    // === Build the model matrix for the sun ===
    const sunModelMatrix = mat4();
    identity(sunModelMatrix);// Reset matrix to identity
    // Position the sun in world space
    sunModelMatrix[12] = sunPosition[0];
    sunModelMatrix[13] = sunPosition[1];
    sunModelMatrix[14] = sunPosition[2];
    // Apply uniform scale to make the sun visible
    const sunScale = 0.8;
    sunModelMatrix[0] = sunScale;
    sunModelMatrix[5] = sunScale;
    sunModelMatrix[10] = sunScale;
    // === Compute the MVP matrix ===
    const sunMvpMatrix = mat4();
    multiply(sunMvpMatrix, projectionMatrix, viewMatrix);// View-projection
    multiply(sunMvpMatrix, sunMvpMatrix, sunModelMatrix);// Apply model

    // === Pass uniforms to the shader ===
    this.renderer.setUniforms(
        lightDirection,        // Used for lighting or bloom direction
        sunMvpMatrix,          // Full transform for vertex shader
        sunModelMatrix,        // Model (for normals)
        sunModelMatrix,        // Normal matrix (same here, no rotation/scale skew)
        values.enableShadows,
        values.lowQuality
    );

    // === Draw the sun geometry ===
    this.renderer.drawObject(
        this.buffers.sunVertex,                // Vertex buffer for sphere geometry
        this.buffers.sunIndex,                 // Index buffer
        this.geometries.sun.indices.length,    // Number of indices to draw
        [1.0, 0.9, 0.6],                       // Soft warm color for the sun (glow)
        false, false, false                    // No grass, instancing, or billboard
    );
}
