export function renderShadowPass(values, { lightViewProjectionMatrix }) {
    if (!values.enableShadows || !this.shadowFramebuffer) return;

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.shadowFramebuffer);
    this.gl.viewport(0, 0, 2048, 2048);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    this.gl.useProgram(this.shadowProgram);

    const lightMvpLocation = this.gl.getUniformLocation(this.shadowProgram, 'u_lightViewProjectionMatrix');
    this.gl.uniformMatrix4fv(lightMvpLocation, false, lightViewProjectionMatrix);

    this.renderForShadowMap();

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
}
