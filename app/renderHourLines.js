import { mat4, identity, multiply } from '../utils/math-utils.js';
/**
 * Renders hour lines and their markers on a horizontal plane (like on a sundial).
 * 
 * Each line and its marker are transformed using a shared model matrix (slightly lifted above the surface),
 * and rendered with distinct colors for visual clarity.
 * 
 * @param {Float32Array} viewMatrix - Camera view matrix.
 * @param {Float32Array} projectionMatrix - Projection matrix for screen space conversion.
 * @param {Float32Array} lightDirection - Direction vector of the light source.
 * @param {Object} values - Rendering flags (e.g., shadows, quality settings).
 */
export function renderHourLines(viewMatrix, projectionMatrix, lightDirection, values) {
    this.buffers.hourLines.forEach((lineData, index) => {
        const originalLineData = this.geometries.hourLines[index];
        // Start with identity model matrix (no rotation or scaling)
        const modelMatrix = mat4();
        identity(modelMatrix);
        // Slightly raise the hour lines above the ground plane to avoid Z-fighting
        modelMatrix[13] = 0.01; // translate Y by +0.01 units
         // Build MVP = Projection * View * Model
        const mvpMatrix = mat4();
        multiply(mvpMatrix, projectionMatrix, viewMatrix);
        multiply(mvpMatrix, mvpMatrix, modelMatrix);
        
        this.renderer.setUniforms(
            lightDirection, 
            mvpMatrix, 
            modelMatrix, // model matrix
            modelMatrix, // normal matrix (same here, no rotation/scale)
            values.enableShadows, 
            values.lowQuality
        );

         // --- Draw main hour line ---
        this.renderer.drawObject(
            lineData.lineVertexBuffer,
            lineData.lineIndexBuffer,
            originalLineData.lineIndices.length,
            [1.0, 0.0, 0.0], // Bright red (for visual debug)
            false, false, true,false, false
        );

        // Marker
        this.renderer.drawObject(
            lineData.markerVertexBuffer,
            lineData.markerIndexBuffer,
            originalLineData.markerIndices.length,
            [0.0, 1.0, 0.0], // Bright green
            false, false, true,false, false
        );
    });
}
