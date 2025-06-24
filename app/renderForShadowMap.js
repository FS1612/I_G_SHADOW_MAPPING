import { mat4, identity } from '../utils/math-utils.js';
/**
 * Renders scene objects (grass blades and gnomon) to the shadow map.
 * 
 * This function uses a specific shader program for shadow rendering (`shadowProgram`).
 * For each grass blade, it calculates a wind-influenced transformation and renders it.
 * A static object (gnomon) is also rendered with an identity model matrix.
 * 
 * The internal `renderer.drawShadowObject` method is called to draw each object using
 * its vertex and index buffers along with the computed model matrix.
 * 
 * @method renderForShadowMap
 */
export function renderForShadowMap() {
    const gl = this.gl;
    gl.useProgram(this.shadowProgram);

    // === GRASS BLADES ===
    for (const blade of this.buffers.grassBlades) {
        
        const transform = blade.transform;
        const windTime = this.animationTime * 2.0 + (transform.windPhase || 0);
        const windStrength = 0.15;
        // Compute wind offsets based on height and time
        const windOffsetX = Math.sin(windTime) * windStrength * (transform.height || 1);
        const windOffsetZ = Math.cos(windTime * 1.3) * windStrength * (transform.height || 1) * 0.5;

        const model = mat4();
        identity(model);
        // Start from identity matrix to reset any previous transformations.
        // Then apply rotation, scaling, and wind-offset translation to build the final model matrix.
        // Build model matrix for this grass blade
        const cos = Math.cos(transform.rotation);
        const sin = Math.sin(transform.rotation);
        // Apply rotation and scale in the XZ plane
        model[0] = transform.scale * cos;
        model[2] = -transform.scale * sin;
        model[8] = transform.scale * sin;
        model[10] = transform.scale * cos;
        model[5] = transform.scale;// Scale along Y axis
        // Apply translation with wind offset
        model[12] = transform.position[0] + windOffsetX;
        model[13] = transform.position[1];
        model[14] = transform.position[2] + windOffsetZ;
        // Render the grass blade to the shadow map
        this.renderer.drawShadowObject(
            blade.vertex,
            blade.index,
            blade.transform.geometry.indices.length,
            true,// isGrass = true
            model
        );
    }
    // === GNOMON ===
{
    const modelMatrix = mat4();
    identity(modelMatrix);// No transformation, static object
    // Render the gnomon (scene reference marker) to the shadow map
    this.renderer.drawShadowObject(
        this.buffers.gnomonVertex,
        this.buffers.gnomonIndex,
        this.geometries.gnomon.indices.length,
        false,  // isGrass = false
        modelMatrix
    );
}

    
}
