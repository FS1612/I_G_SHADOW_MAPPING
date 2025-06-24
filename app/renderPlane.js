/**
 * Renders the ground plane with a soil-like color and associated shader flags.
 * 
 * The function sets several uniforms to inform the shader that the current object is the ground,
 * including a real-time value (in fractional hours) to support time-dependent shading (e.g., shadows or highlights).
 * It avoids interfering with sphere or grass-specific rendering logic by explicitly clearing those flags.
 * 
 * @param {Float32Array} mvpMatrix - Combined projection * view * model matrix.
 * @param {Float32Array} modelMatrix - The model transformation matrix.
 * @param {Float32Array} lightDirection - Direction vector of the light (e.g., sun).
 * @param {Object} values - Configuration flags, including shadow and quality settings.
 */
export function renderPlane(mvpMatrix, modelMatrix, lightDirection, values) {
    const gl = this.gl;
    // Tell the shader this is NOT a sphere
    const u_isSphereLocation = gl.getUniformLocation(this.program, 'u_isSphere');
    if (u_isSphereLocation) gl.uniform1f(u_isSphereLocation, 0.0);

    // Tell the shader this is NOT grass (important to avoid grass-specific shading)
    const u_isGrassLocation = gl.getUniformLocation(this.program, 'u_isGrass');
    if (u_isGrassLocation) gl.uniform1f(u_isGrassLocation, 0.0);

    // Indicate this IS the ground (so the shader can apply appropriate logic)
    const u_isGroundLocation = gl.getUniformLocation(this.program, 'u_isGround');
    if (u_isGroundLocation) gl.uniform1f(u_isGroundLocation, 1.0);

     // Pass simulated time to the shader (in decimal hours, e.g., 14.5 = 14:30)
    const timeStr = this.uiControls.currentTime || "12:00";
    const [hours, minutes] = timeStr.split(':').map(Number);
    const simulatedTimeHours = hours + (minutes / 60.0);
    const u_realTime = gl.getUniformLocation(this.program, 'u_realTime');
    if (u_realTime) gl.uniform1f(u_realTime, simulatedTimeHours);

    // Set core lighting and transform uniforms
    this.renderer.setUniforms(
        lightDirection,
        mvpMatrix,
        modelMatrix,
        modelMatrix, // normalMatrix (same here as model)
        values.enableShadows,
        values.lowQuality
    );
    // Define a soil-like color (brown tone)
    const soilColor = [
        0.4, // Red component
        0.3, // Green component
        0.2  // Blue component
    ];

     // Draw the ground plane geometry with soil color
    this.renderer.drawObject(
        this.buffers.planeVertex,
        this.buffers.planeIndex,
        this.geometries.plane.indices.length,
        soilColor,
        true,  // isOpaque
        false, // isGrass
        false, // isInstanced
        false, // isBillboard
        false  // isWireframe
    );
    
    // Reset ground flag after rendering to avoid affecting subsequent objects
    if (u_isGroundLocation) gl.uniform1f(u_isGroundLocation, 0.0);
}