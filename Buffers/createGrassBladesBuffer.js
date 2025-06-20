import { createBuffer, createIndexBuffer } from '../webgl/webgl-utils.js';


export function createGrassBladesBuffer() {
    const gl = this.gl;

this.buffers.grassBlades = this.geometries.grassBlades.map(blade => ({
            vertex: createBuffer(gl, blade.geometry.vertices),
            index: createIndexBuffer(gl, blade.geometry.indices),
            transform: blade
        }));
    }