import { createBuffer, createIndexBuffer } from '../webgl/webgl-utils.js';

/**
 * Creates cloud buffers from cloud geometries
 */

export function createCloudBuffers() {
    const gl = this.gl;

    this.buffers.clouds = this.geometries.clouds.map(cloud => ({
        parts: cloud.parts.map(part => ({
            vertex: createBuffer(gl, part.geometry.vertices),
            index: createIndexBuffer(gl, part.geometry.indices),
            localPosition: part.localPosition,
            scale: part.scale,
            geometry: part.geometry
        })),
        position: cloud.position,
        baseScale: cloud.baseScale,
        speed: cloud.speed,
    }));
}
