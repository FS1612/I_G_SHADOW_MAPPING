import { mat4, identity, multiply } from '../utils/math-utils.js';

/**
 * Renders individual grass blades with per-instance transformations and wind animation.
 * Applies MVP transformations, dynamic wind offsets, and sets shader uniforms for lighting and quality.
 * Each blade is rendered separately with unique model transformations and animated wind effects.
 * 
 * @param {Float32Array} projectionMatrix - The projection matrix (perspective or orthographic).
 * @param {Float32Array} viewMatrix - The view matrix representing the camera position/orientation.
 * @param {Float32Array} lightDirection - Direction vector of the light source.
 * @param {Object} values - Rendering configuration (shadows, low quality flag).
 */
export function renderGrassBlades(projectionMatrix, viewMatrix, lightDirection, values) {
    if (!this.buffers.grassBlades) {
        console.log('No grass blades buffer found');
        return;
    }

    const gl = this.gl;

    // Enable alpha blending for transparent rendering (important for semi-transparent blades)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Get uniform locations used in the shader
    const u_isGrassLocation = gl.getUniformLocation(this.program, 'u_isGrass');
    const u_windTimeLocation = gl.getUniformLocation(this.program, 'u_windTime');
    const u_colorLocation = gl.getUniformLocation(this.program, 'u_color');

    // Pass current animation time to shader (for wind animation)
    if (u_windTimeLocation) {
        gl.uniform1f(u_windTimeLocation, this.animationTime);
    }

    this.buffers.grassBlades.forEach((blade, index) => {
        const transform = blade.transform;

        // Compute wind offset based on animation time and unique wind phase
        const windTime = this.animationTime * 2.0 + (transform.windPhase || 0);
        const windStrength = 0.15;
        const windOffsetX = Math.sin(windTime) * windStrength * (transform.height || 1);
        const windOffsetZ = Math.cos(windTime * 1.3) * windStrength * (transform.height || 1) * 0.5;

        // Build model matrix (starting from identity, then applying rotation, scale, translation)
        const model = mat4();
        identity(model);
        const cos = Math.cos(transform.rotation);
        const sin = Math.sin(transform.rotation);
        model[0] = transform.scale * cos;
        model[2] = -transform.scale * sin;
        model[8] = transform.scale * sin;
        model[10] = transform.scale * cos;
        model[5] = transform.scale;
        model[12] = transform.position[0] + windOffsetX;
        model[13] = transform.position[1];
        model[14] = transform.position[2] + windOffsetZ;

        // Build MVP matrix = projection * view * model
        const mvp = mat4();
        multiply(mvp, projectionMatrix, viewMatrix);
        multiply(mvp, mvp, model);

        // Set core uniforms: light, MVP, model, normal matrix, shadows, quality
        this.renderer.setUniforms(lightDirection, mvp, model, model, values.enableShadows, values.lowQuality);

        // Manually set grass flag (after setUniforms, which may reset uniforms)
        if (u_isGrassLocation !== -1 && u_isGrassLocation !== null) {
            gl.uniform1f(u_isGrassLocation, 1.0);
        }

        // Optionally force a debug color for the grass (pure green)
        if (u_colorLocation !== -1 && u_colorLocation !== null) {
            gl.uniform3f(u_colorLocation, 0.0, 1.0, 0.0);
        }

        const grassColor = [0.0, 1.0, 0.0]; // Pure green (debug color)

        // Issue the draw call for this blade
        this.renderer.drawObject(
            blade.vertex,
            blade.index,
            transform.geometry.indices.length,
            grassColor,
            false, false, false, false, true // Final flags (e.g., isGrass=true)
        );
    });

    // Reset grass flag after all rendering is done
    if (u_isGrassLocation !== -1 && u_isGrassLocation !== null) {
        gl.uniform1f(u_isGrassLocation, 0.0);
    }

    // Disable blending after rendering grass
    gl.disable(gl.BLEND);
}



/**
 * Prints diagnostic information about the currently active WebGL shader program.
 * Useful for debugging shader compilation, linking, and uniform bindings.
 * 
 * @param {WebGLRenderingContext} gl - WebGL rendering context.
 * @param {WebGLProgram} program - Shader program to inspect.
 */
export function debugShaderState(gl, program) {
    console.log('=== SHADER DEBUG ===');
    console.log('Program:', program);
    console.log('Current program:', gl.getParameter(gl.CURRENT_PROGRAM));
    console.log('Program valid:', gl.isProgram(program));
    console.log('Program linked:', gl.getProgramParameter(program, gl.LINK_STATUS));

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
    }

    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    console.log('Active uniforms:', numUniforms);

    for (let i = 0; i < numUniforms; i++) {
        const info = gl.getActiveUniform(program, i);
        console.log(`Uniform ${i}: ${info.name} (${info.type})`);
    }
}