import { createBuffer, createIndexBuffer } from '../webgl/webgl-utils.js';

/**
 * Creates vertex and index buffers for each hour line and its associated marker.
 * 
 * Each hour line is composed of:
 * - a main line (geometry pointing outward from the center)
 * - a marker (optional geometric shape at the end or along the line)
 * 
 * This function prepares GPU buffers for both and stores them in `this.buffers.hourLines`.
 * The data is later used during rendering in `renderHourLines()`.
 * 
 * Assumes that `this.geometries.hourLines` is an array of hour line objects,
 * each containing separate geometry for line and marker plus metadata like angle and hour label.
 */
export function createHourLinesBuffer() {
    const gl = this.gl;

this.buffers.hourLines = this.geometries.hourLines.map(line => ({
                lineVertexBuffer: createBuffer(gl, line.lineVertices),          // Vertex buffer for main line
                lineIndexBuffer: createIndexBuffer(gl, line.lineIndices),       // Index buffer for main line
                markerVertexBuffer: createBuffer(gl, line.markerVertices),      // Vertex buffer for the marker
                markerIndexBuffer: createIndexBuffer(gl, line.markerIndices),   // Index buffer for the marker
                hour: line.hour,                                                // Numerical or string label for the hour (used in overlays/UI)
                angle: line.angle                                               // Angle in radians from center (used for orientation and label placement)
            }));
    }
     