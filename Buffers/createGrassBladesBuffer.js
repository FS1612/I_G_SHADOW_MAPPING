import { createBuffer, createIndexBuffer } from '../webgl/webgl-utils.js';

/**
 * Generates vertex and index buffers for each individual grass blade.
 * 
 * For every grass blade in `this.geometries.grassBlades`, this function:
 * - creates a vertex buffer from its geometry
 * - creates an index buffer
 * - attaches the full transform (position, scale, rotation, windPhase, etc.)
 * 
 * The result is stored in `this.buffers.grassBlades` and is used during
 * both the main render pass and the shadow pass to animate and draw grass blades.
 * 
 * Assumes that `this.geometries.grassBlades` has been previously populated
 * by a function like `scatterGrassField()`.
 */
export function createGrassBladesBuffer() {
    const gl = this.gl;

this.buffers.grassBlades = this.geometries.grassBlades.map(blade => ({
            vertex: createBuffer(gl, blade.geometry.vertices),      // Vertex buffer for blade geometry
            index: createIndexBuffer(gl, blade.geometry.indices),   // Index buffer for drawing
            transform: blade                                        // Contains position, rotation, scale, windPhase
        }));
    }