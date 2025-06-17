import { mat4, perspective, lookAt, identity, multiply } from '../utils/math-utils.js';
import { setupWebGLState } from '../webgl/webgl-utils.js';

import { renderSun } from './renderSun.js';
import { renderSky } from './renderSky.js';
import { renderPlane } from './renderPlane.js';
import { renderHourLines } from './renderHourLines.js';
import { renderGrassBlades } from './renderGrassBlades.js';
import { renderGnomon } from './renderGnomon.js';

export function renderMainScene(values, { lightDirection, sunPosition, lightViewProjectionMatrix }) {
    const gl = this.gl;

    setupWebGLState(gl);
    gl.useProgram(this.program);

    const projectionMatrix = mat4();
    const viewMatrix = mat4();
    const modelMatrix = mat4();
    const mvpMatrix = mat4();

    perspective(projectionMatrix, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100);
    const cameraPos = this.cameraControls.getCameraPosition();
    lookAt(viewMatrix, cameraPos, [0, 0, 0], [0, 5, 0]);

    // Usa call(this, ...) se usano this.gl all'interno
    renderSky.call(this, lightDirection, projectionMatrix, viewMatrix, this.animationTime * 1000);

    identity(modelMatrix);
    multiply(mvpMatrix, projectionMatrix, viewMatrix);
    multiply(mvpMatrix, mvpMatrix, modelMatrix);

    // Metodi della classe: usa this.
    this.setLightingUniforms(sunPosition, lightViewProjectionMatrix, values);

    renderPlane.call(this, mvpMatrix, modelMatrix, lightDirection, values);
    
    renderGnomon.call(this, viewMatrix, projectionMatrix, lightDirection, values);
    renderSun.call(this, viewMatrix, projectionMatrix, sunPosition, lightDirection, values);
    renderGrassBlades.call(this, projectionMatrix, viewMatrix, lightDirection, values);
    renderHourLines.call(this, viewMatrix, projectionMatrix, lightDirection, values);
    // Altri metodi della classe
    this.renderRealisticClouds(projectionMatrix, viewMatrix, this.animationTime * 1000);
    this.updateHourMarkers();
    this.updateFPS();
}
