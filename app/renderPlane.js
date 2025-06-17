export function renderPlane(mvpMatrix, modelMatrix, lightDirection, values) {
    const gl = this.gl;

    const u_isSphereLocation = gl.getUniformLocation(this.program, 'u_isSphere');
    if (u_isSphereLocation) gl.uniform1f(u_isSphereLocation, 0.0);

    // IMPORTANTE: Non settare u_isGrass per il piano!
    const u_isGrassLocation = gl.getUniformLocation(this.program, 'u_isGrass');
    if (u_isGrassLocation) gl.uniform1f(u_isGrassLocation, 0.0);

    // Usa u_isGround per identificare il terreno
    const u_isGroundLocation = gl.getUniformLocation(this.program, 'u_isGround');
    if (u_isGroundLocation) gl.uniform1f(u_isGroundLocation, 1.0);

    // Simulated time for shaders
    const timeStr = this.uiControls.currentTime || "12:00";
    const [hours, minutes] = timeStr.split(':').map(Number);
    const simulatedTimeHours = hours + (minutes / 60.0);
    const u_realTime = gl.getUniformLocation(this.program, 'u_realTime');
    if (u_realTime) gl.uniform1f(u_realTime, simulatedTimeHours);

    this.renderer.setUniforms(lightDirection, mvpMatrix, modelMatrix, modelMatrix, values.enableShadows, values.lowQuality);

    // COLORE TERRENO - marrone/terra invece di verde
    const soilColor = [
        0.4,  // Rosso - colore terra
        0.3,  // Verde - un po' di verde per terreno fertile  
        0.2   // Blu - molto poco per dare calore
    ];

    this.renderer.drawObject(
        this.buffers.planeVertex,
        this.buffers.planeIndex,
        this.geometries.plane.indices.length,
        soilColor,  // Usa colore terra invece di verde
        true
    );
    
    // Resetta u_isGround
    if (u_isGroundLocation) gl.uniform1f(u_isGroundLocation, 0.0);
}