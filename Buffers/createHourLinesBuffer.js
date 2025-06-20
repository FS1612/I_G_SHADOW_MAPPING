import { createBuffer, createIndexBuffer } from '../webgl/webgl-utils.js';


export function createHourLinesBuffer() {
    const gl = this.gl;

this.buffers.hourLines = this.geometries.hourLines.map(line => ({
                lineVertexBuffer: createBuffer(gl, line.lineVertices),
                lineIndexBuffer: createIndexBuffer(gl, line.lineIndices),
                markerVertexBuffer: createBuffer(gl, line.markerVertices),
                markerIndexBuffer: createIndexBuffer(gl, line.markerIndices),
                hour: line.hour,
                angle: line.angle
            }));
    }
     