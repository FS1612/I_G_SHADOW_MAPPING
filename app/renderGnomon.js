import { mat4, identity, multiply } from '../utils/math-utils.js';

/**
 * Renders the gnomon (a visual scene reference axis) using given view and projection matrices.
 * 
 * It starts from the identity model matrix (no transformation), combines it with the view and projection
 * to compute the MVP matrix, sets shader uniforms, and draws the object.
 * 
 * @param {Float32Array} viewMatrix - The camera view matrix.
 * @param {Float32Array} projectionMatrix - The projection matrix.
 * @param {Float32Array} lightDirection - Direction of the light source (for lighting/shadows).
 * @param {Object} values - Rendering settings (e.g., shadows, quality flags).
 */
export function renderGnomon(viewMatrix, projectionMatrix, lightDirection, values) {
    const modelMatrix = mat4();
    identity(modelMatrix);// Start from identity: no scaling, rotation, or translation
    // Compute MVP = projection * view * model (in that order)
    const mvpMatrix = mat4();
    multiply(mvpMatrix, projectionMatrix, viewMatrix);
    multiply(mvpMatrix, mvpMatrix, modelMatrix);
    // Set shader uniforms: lighting, matrices, rendering flags
    // modelMatrix: transforms vertex positions; normalMatrix: transforms lighting normals (same as modelMatrix here since there's no scaling or rotation)
    this.renderer.setUniforms(
        lightDirection,
        mvpMatrix,
        modelMatrix, // model
        modelMatrix, // normal matrix (identity here)
        values.enableShadows,
        values.lowQuality
    );
    // Draw the gnomon with a dark red color
    this.renderer.drawObject(
        this.buffers.gnomonVertex,
        this.buffers.gnomonIndex,
        this.geometries.gnomon.indices.length,
        [0.1, 0.0, 0.0], // RGB color
        false,  // isGrass
        true,   // isOpaque
        false,  // useInstancing
        false,  // isBillboard
        false   // isWireframe
    );
}
