import { mat4, perspective, lookAt, identity, multiply } from '../utils/math-utils.js';
import { setupWebGLState } from '../webgl/webgl-utils.js';

import { renderSun } from './renderSun.js';
import { renderSky } from './renderSky.js';
import { renderPlane } from './renderPlane.js';
import { renderHourLines } from './renderHourLines.js';
import { renderGrassBlades } from './renderGrassBlades.js';
import { renderGnomon } from './renderGnomon.js';
/**
 * Main render function for the scene. Sets up camera and projection, configures WebGL state,
 * and calls all rendering subsystems (sky, ground, grass, gnomon, hour lines, sun, clouds).
 * 
 * @param {Object} values - Rendering configuration, includes shadow toggle, quality, etc.
 * @param {Object} context - Scene-wide dynamic inputs.
 * @param {Float32Array} context.lightDirection - Directional vector of the sunlight.
 * @param {Float32Array} context.sunPosition - 3D position of the sun in world space.
 * @param {Float32Array} context.lightViewProjectionMatrix - Matrix used for shadow mapping.
 */
export function renderMainScene(values, { lightDirection, sunPosition, lightViewProjectionMatrix }) {
    const gl = this.gl;
    // Setup depth testing, blending, culling, etc.
    setupWebGLState(gl);
    gl.useProgram(this.program);
    // === Matrix Initialization ===
    const projectionMatrix = mat4();
    const viewMatrix = mat4();
    const modelMatrix = mat4();
    const mvpMatrix = mat4();
    // === Set Perspective Projection ===
     perspective(
        projectionMatrix,
        Math.PI / 4,                         // 45° FOV
        this.canvas.width / this.canvas.height, // Aspect ratio
        0.1, 100                             // Near/far planes
    );
    // === Setup Camera View Matrix ===
    const cameraPos = this.cameraControls.getCameraPosition();
    lookAt(
        viewMatrix,
        cameraPos,         // Camera position
        [0, 0, 0],         // Look at origin
        [0, 5, 0]          // Up vector
    );
    

    // === Render Sky Dome ===
    renderSky.call(this, lightDirection, projectionMatrix, viewMatrix, this.animationTime * 1000);
    // === Identity Model Matrix for Plane ===
    identity(modelMatrix);
    multiply(mvpMatrix, projectionMatrix, viewMatrix);
    multiply(mvpMatrix, mvpMatrix, modelMatrix);

    // === Set Lighting Info in Shaders ===
    this.setLightingUniforms(sunPosition, lightViewProjectionMatrix, values);
    // === Render Scene Elements ===
    renderPlane.call(this, mvpMatrix, modelMatrix, lightDirection, values);
    renderGrassBlades.call(this, projectionMatrix, viewMatrix, lightDirection, values);
    renderGnomon.call(this, viewMatrix, projectionMatrix, lightDirection, values);
    renderSun.call(this, viewMatrix, projectionMatrix, sunPosition, lightDirection, values);
    
    renderHourLines.call(this, viewMatrix, projectionMatrix, lightDirection, values);
    // === Optional / dynamic elements ===
    this.renderRealisticClouds(projectionMatrix, viewMatrix, this.animationTime * 1000);
    this.updateHourMarkers();// UI or 3D markers showing hour values
    this.updateFPS();// Debug/statistics overlay
}
