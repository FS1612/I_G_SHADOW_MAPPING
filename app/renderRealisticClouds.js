import { mat4, identity, multiply } from '../utils/math-utils.js';

/**
 * Renders realistic clouds with animation
 */

export function renderRealisticClouds(projectionMatrix, viewMatrix, time) {
    const gl = this.gl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    const driftTime = time * 0.0001;

    this.buffers.clouds.forEach((cloud, index) => {
        const cloudData = this.geometries.clouds[index];

        // Movimento fluido su traiettoria curva
        const driftX = Math.sin(driftTime + index * 0.4) * 5;
        const driftZ = Math.cos(driftTime * 0.8 + index * 0.6) * 4;

        const cloudBaseX = cloud.position[0] + driftX;
        const cloudBaseY = cloud.position[1];
        const cloudBaseZ = cloud.position[2] + driftZ;

        cloud.parts.forEach((partBuffer, partIndex) => {
            const partData = cloudData.parts[partIndex];

            const finalX = cloudBaseX + partData.localPosition[0];
            const finalZ = cloudBaseZ + partData.localPosition[2];

            // Oscillazione verticale morbida
            const wobbleY = Math.sin(time * 0.1 + partIndex * 1.3 + cloudData.wobblePhase) * 0.008;
            const finalY = cloudBaseY + partData.localPosition[1] + wobbleY;

            const partModelMatrix = mat4();
            identity(partModelMatrix);

            const scale = partData.scale * cloud.baseScale;
            partModelMatrix[0] = scale;
            partModelMatrix[5] = scale * 0.8;
            partModelMatrix[10] = scale;

            partModelMatrix[12] = finalX;
            partModelMatrix[13] = finalY;
            partModelMatrix[14] = finalZ;

            const partMvpMatrix = mat4();
            multiply(partMvpMatrix, projectionMatrix, viewMatrix);
            multiply(partMvpMatrix, partMvpMatrix, partModelMatrix);

            this.renderer.setUniforms([0, -1, 0], partMvpMatrix, partModelMatrix, partModelMatrix, false, false);

            const cloudColor = [
                cloudData.grayIntensity * 0.9,
                cloudData.grayIntensity,
                cloudData.grayIntensity * 1.1 + cloudData.warmth
            ];

            const u_isSphereLocation = gl.getUniformLocation(this.program, 'u_isSphere');
            if (u_isSphereLocation) {
                gl.uniform1f(u_isSphereLocation, 1.0);
            }

            const u_opacityLocation = gl.getUniformLocation(this.program, 'u_opacity');
            if (u_opacityLocation) {
                gl.uniform1f(u_opacityLocation, 0.75);
            }

            this.renderer.drawObject(
                partBuffer.vertex,
                partBuffer.index,
                partData.geometry.indices.length,
                cloudColor,
                false, false, false, true, false
            );
        });
    });

    gl.depthMask(true);
    gl.disable(gl.BLEND);
}
