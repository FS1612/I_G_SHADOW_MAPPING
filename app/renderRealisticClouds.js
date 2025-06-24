import { mat4, identity, multiply } from '../utils/math-utils.js';

/**
 * Renders animated, realistic volumetric cloud formations using billboarded soft spheres.
 * 
 * Each cloud is composed of multiple soft, semi-transparent parts, animated over time.
 * Movement includes:
 * - horizontal drifting based on index and time
 * - vertical wobble for organic motion
 * 
 * Alpha blending is enabled for proper transparency.
 * 
 * @param {Float32Array} projectionMatrix - Projection matrix for 3D-to-2D conversion.
 * @param {Float32Array} viewMatrix - View matrix representing the camera's position and direction.
 * @param {number} time - Animation time in milliseconds, used for movement and wobble.
 */

export function renderRealisticClouds(projectionMatrix, viewMatrix, time) {
    const gl = this.gl;
    // Enable alpha blending for soft, translucent rendering
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);// Prevent clouds from writing to depth buffer

    const driftTime = time * 0.0001;

    this.buffers.clouds.forEach((cloud, index) => {
        const cloudData = this.geometries.clouds[index];

        // Cloud drift (horizontal movement along X and Z)
        const driftX = Math.sin(driftTime + index * 0.4) * 5;
        const driftZ = Math.cos(driftTime * 0.8 + index * 0.6) * 4;

        const cloudBaseX = cloud.position[0] + driftX;
        const cloudBaseY = cloud.position[1];
        const cloudBaseZ = cloud.position[2] + driftZ;
        // Render all cloud parts (e.g. spherical puff clusters)
        cloud.parts.forEach((partBuffer, partIndex) => {
            const partData = cloudData.parts[partIndex];
            // Final position with local offset
            const finalX = cloudBaseX + partData.localPosition[0];
            const finalZ = cloudBaseZ + partData.localPosition[2];

            // Soft up-down wobble (adds organic motion)
            const wobbleY = Math.sin(time * 0.1 + partIndex * 1.3 + cloudData.wobblePhase) * 0.008;
            const finalY = cloudBaseY + partData.localPosition[1] + wobbleY;
            // Model matrix for this cloud part
            const partModelMatrix = mat4();
            identity(partModelMatrix);

            const scale = partData.scale * cloud.baseScale;
            partModelMatrix[0] = scale;
            partModelMatrix[5] = scale * 0.8; // Flatten Y for fluffiness
            partModelMatrix[10] = scale;

            partModelMatrix[12] = finalX;
            partModelMatrix[13] = finalY;
            partModelMatrix[14] = finalZ;
             // Build MVP = projection * view * model
            const partMvpMatrix = mat4();
            multiply(partMvpMatrix, projectionMatrix, viewMatrix);
            multiply(partMvpMatrix, partMvpMatrix, partModelMatrix);

            // Set shader uniforms (light direction irrelevant for soft clouds)
            this.renderer.setUniforms(
                [0, -1, 0],            // Downward light for soft shading
                partMvpMatrix,
                partModelMatrix,
                partModelMatrix,
                false, false           // No shadows, no low-quality mode
            );
            // Calculate subtle variation in cloud color
            const cloudColor = [
                cloudData.grayIntensity * 0.9,
                cloudData.grayIntensity,
                cloudData.grayIntensity * 1.1 + cloudData.warmth
            ];
            // Enable sphere shading logic in shader (for soft billboard rendering)
            const u_isSphereLocation = gl.getUniformLocation(this.program, 'u_isSphere');
            if (u_isSphereLocation) {
                gl.uniform1f(u_isSphereLocation, 1.0);
            }
            // Set opacity for the translucent cloud puff
            const u_opacityLocation = gl.getUniformLocation(this.program, 'u_opacity');
            if (u_opacityLocation) {
                gl.uniform1f(u_opacityLocation, 0.75);
            }
            // Draw this cloud part as a soft sphere
            this.renderer.drawObject(
                partBuffer.vertex,
                partBuffer.index,
                partData.geometry.indices.length,
                cloudColor,
                false, false, false, true, false// flags: isCloud = true
            );
        });
    });
    // Restore default state
    gl.depthMask(true);
    gl.disable(gl.BLEND);
}
