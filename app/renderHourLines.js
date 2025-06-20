import { mat4, identity, multiply } from '../utils/math-utils.js';

export function renderHourLines(viewMatrix, projectionMatrix, lightDirection, values) {
    this.buffers.hourLines.forEach((lineData, index) => {
        const originalLineData = this.geometries.hourLines[index];

        const modelMatrix = mat4();
        identity(modelMatrix);
        modelMatrix[13] = 0.01; // << Solleva le linee visivamente dal piano
        const mvpMatrix = mat4();
        multiply(mvpMatrix, projectionMatrix, viewMatrix);
        multiply(mvpMatrix, mvpMatrix, modelMatrix);
        
        this.renderer.setUniforms(
            lightDirection, 
            mvpMatrix, 
            modelMatrix, 
            modelMatrix, 
            values.enableShadows, 
            values.lowQuality
        );

        // Linea principale
        this.renderer.drawObject(
            lineData.lineVertexBuffer,
            lineData.lineIndexBuffer,
            originalLineData.lineIndices.length,
            [1.0, 0.0, 0.0], // Rosso acceso per test
            false, false, true,false, false
        );

        // Marker
        this.renderer.drawObject(
            lineData.markerVertexBuffer,
            lineData.markerIndexBuffer,
            originalLineData.markerIndices.length,
            [0.0, 1.0, 0.0], // Verde per i marker
            false, false, true,false, false
        );
    });
}
