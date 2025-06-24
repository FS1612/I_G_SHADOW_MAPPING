/**
 * Executes the shadow map rendering pass.
 * 
 * This function renders the scene from the light's point of view into a dedicated framebuffer,
 * producing a depth texture (shadow map) that will later be used to simulate shadows during main rendering.
 * 
 * @param {Object} values - Configuration values, including the `enableShadows` flag.
 * @param {Float32Array} lightViewProjectionMatrix - The matrix that transforms world space to the light's clip space.
 */
export function renderShadowPass(values, { lightViewProjectionMatrix }) {
    // Skip if shadows are disabled or no shadow framebuffer is defined
    if (!values.enableShadows || !this.shadowFramebuffer) return;
    // === 1. Bind the shadow framebuffer ===
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.shadowFramebuffer);
    // Set a high-resolution viewport for the shadow map
    this.gl.viewport(0, 0, 4096, 4096);
    // Clear previous depth and color from shadow buffer
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    // Activate the shader program used for shadow rendering
    this.gl.useProgram(this.shadowProgram);
    // === 2. Send the light's view-projection matrix to the shader ===
    const lightMvpLocation = this.gl.getUniformLocation(this.shadowProgram, 'u_lightViewProjectionMatrix');
    this.gl.uniformMatrix4fv(lightMvpLocation, false, lightViewProjectionMatrix);
    // === 3. Render the scene into the shadow map ===
    // This renders all relevant objects (e.g., grass, gnomon) from the light's perspective
    this.renderForShadowMap();
    // === 4. Restore default framebuffer and viewport ===
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
}
