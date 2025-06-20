import { mat4, identity, multiply } from '../utils/math-utils.js';

export function renderGnomon(viewMatrix, projectionMatrix, lightDirection, values) {
    const modelMatrix = mat4();
    identity(modelMatrix);
    const mvpMatrix = mat4();
    multiply(mvpMatrix, projectionMatrix, viewMatrix);
    multiply(mvpMatrix, mvpMatrix, modelMatrix);

    this.renderer.setUniforms(lightDirection, mvpMatrix, modelMatrix, modelMatrix, values.enableShadows, values.lowQuality);

    this.renderer.drawObject(
        this.buffers.gnomonVertex,
        this.buffers.gnomonIndex,
        this.geometries.gnomon.indices.length,
        [0.1, 0.0, 0.0],
        false, true, false,false,false
    );
}
