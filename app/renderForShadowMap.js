export function renderForShadowMap() {
    const gl = this.gl;

    gl.useProgram(this.shadowProgram);

    this.renderer.drawShadowObject(
        this.buffers.gnomonVertex,
        this.buffers.gnomonIndex,
        this.geometries.gnomon.indices.length
    );

    this.buffers.hourLines.forEach((lineData, index) => {
        const originalLineData = this.geometries.hourLines[index];

        this.renderer.drawShadowObject(
            lineData.lineVertexBuffer,
            lineData.lineIndexBuffer,
            originalLineData.lineIndices.length
        );

        this.renderer.drawShadowObject(
            lineData.markerVertexBuffer,
            lineData.markerIndexBuffer,
            originalLineData.markerIndices.length
        );
    });
}
