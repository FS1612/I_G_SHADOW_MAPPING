import { createBuffer, createIndexBuffer } from '../webgl/webgl-utils.js';

/**
 * Generates WebGL buffers for all structured cloud geometries in the scene.
 * 
 * Each cloud is composed of multiple "parts" (soft blobs or billboards), and for each part:
 * - a vertex buffer is created from the part's geometry
 * - an index buffer is created for drawing
 * 
 * These buffers are stored in `this.buffers.clouds`, alongside metadata such as position,
 * base scale, and speed, which are used during the rendering phase to animate and place clouds.
 * 
 * Assumes that `this.geometries.clouds` has already been populated with valid cloud geometry.
 */

export function createCloudBuffers() {
    const gl = this.gl;
    // Create structured buffer data for each cloud
    this.buffers.clouds = this.geometries.clouds.map(cloud => ({
        parts: cloud.parts.map(part => ({
            vertex: createBuffer(gl, part.geometry.vertices),   // Vertex buffer for the part
            index: createIndexBuffer(gl, part.geometry.indices),// Index buffer for the part
            localPosition: part.localPosition,                  // Offset from cloud base position
            scale: part.scale,                                  // Local scale of this part
            geometry: part.geometry                             // Reference to the original geometry
        })),
        position: cloud.position,                               // Base world-space position of the cloud
        baseScale: cloud.baseScale,                             // Global scale multiplier for the cloud
        speed: cloud.speed,                                     // Drift speed or animation multiplier
    }));
}
