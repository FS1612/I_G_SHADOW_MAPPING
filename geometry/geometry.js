
import { calculateSundialHourAngles } from '../utils/astronomy.js';
/**
 * Creates a flat square ground plane made of triangle tiles.
 * @param {number} size - The total width/length of the plane.
 * @returns {{vertices: Float32Array, indices: Uint16Array}} WebGL-ready geometry data.
 */
export function createPlane(size) {
    const segments = 60;
    const vertices = [];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
        for (let j = 0; j <= segments; j++) {
            const x = (i / segments - 0.5) * size * 2;
            const z = (j / segments - 0.5) * size * 2;
            const y = 0;
            // Position (x,y,z), Normal (0,1,0), UV (i/segments, j/segments)
            vertices.push(x, y, z, 0, 1, 0, i / segments, j / segments);
        }
    }

    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < segments; j++) {
            const a = i * (segments + 1) + j;
            const b = a + 1;
            const c = (i + 1) * (segments + 1) + j;
            const d = c + 1;
            // Two triangles per square
            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
    };
}
/**
 * Creates the 3D geometry of the gnomon (shadow-casting rod).
 * @returns {{vertices: Float32Array, indices: Uint16Array}} WebGL-ready gnomon mesh.
 */
export function createGnomon() {
    const height = 2;
    const width = 0.05;

    const vertices = [
        // Base (4 points)
        -width, 0, -width, 0, 1, 0, 0, 0,
        width, 0, -width, 0, 1, 0, 1, 0,
        width, 0, width, 0, 1, 0, 1, 1,
        -width, 0, width, 0, 1, 0, 0, 1,
        // Top (4 points)
        -width, height, -width, 0, 1, 0, 0, 0,
        width, height, -width, 0, 1, 0, 1, 0,
        width, height, width, 0, 1, 0, 1, 1,
        -width, height, width, 0, 1, 0, 0, 1
    ];

    const indices = [
        // Sides
        0, 1, 5, 0, 5, 4,
        1, 2, 6, 1, 6, 5,
        2, 3, 7, 2, 7, 6,
        3, 0, 4, 3, 4, 7,
        // Top
        4, 5, 6, 4, 6, 7
    ];

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
    };
}
/**
 * Creates radial hour lines and optional marker blocks for each solar hour.
 * Based on sundial hour angles calculated from a fixed latitude.
 * @returns {Array<{
 *   lineVertices: Float32Array,
 *   lineIndices: Uint16Array,
 *   markerVertices: Float32Array,
 *   markerIndices: Uint16Array,
 *   hour: number,
 *   angle: number
 * }>} Array of geometry data for each hour line.
 */
export function createHourLines() {
    const ROME_LATITUDE = 41.9 * Math.PI / 180;
    const hourAngles = calculateSundialHourAngles(ROME_LATITUDE);
    const lines = [];

    hourAngles.forEach((hourData) => {
        const angle = hourData.angle;
        const hour = hourData.hour;

        // Creates a line from gnomn to number
        const length = 8;
        const width = 0.02;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // main line
        const vertices = [];
        const indices = [];

        // Hour line as a thin ribbon
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const x = sin * t * length;
            const z = cos * t * length;

            
            const perpX = -cos * width;
            const perpZ = sin * width;

            vertices.push(
                x + perpX, 0.01, z + perpZ, 0, 1, 0, 0, t,
                x - perpX, 0.01, z - perpZ, 0, 1, 0, 1, t
            );

            if (i < 20) {
                const base = i * 2;
                indices.push(base, base + 1, base + 2);
                indices.push(base + 1, base + 3, base + 2);
            }
        }

        // Hour marker block (not rendered by default)
        const markerSize = 0.8;
        const markerX = sin * (length - 1);
        const markerZ = cos * (length - 1);

        const markerVertices = [
            // bottom square
            markerX - markerSize, 0.1, markerZ - markerSize, 0, 1, 0, 0, 0,
            markerX + markerSize, 0.1, markerZ - markerSize, 0, 1, 0, 1, 0,
            markerX + markerSize, 0.1, markerZ + markerSize, 0, 1, 0, 1, 1,
            markerX - markerSize, 0.1, markerZ + markerSize, 0, 1, 0, 0, 1,
            // top square
            markerX - markerSize, 1.0, markerZ - markerSize, 0, 1, 0, 0, 0,
            markerX + markerSize, 1.0, markerZ - markerSize, 0, 1, 0, 1, 0,
            markerX + markerSize, 1.0, markerZ + markerSize, 0, 1, 0, 1, 1,
            markerX - markerSize, 1.0, markerZ + markerSize, 0, 1, 0, 0, 1
        ];

        const markerIndices = [
            0, 1, 2, 0, 2, 3, // bottom
            4, 7, 6, 4, 6, 5, // top 
            0, 4, 5, 0, 5, 1, // sides 
            1, 5, 6, 1, 6, 2,
            2, 6, 7, 2, 7, 3,
            3, 7, 4, 3, 4, 0
        ];
        /* per aggiungere i blocchi di posizionamento della numerazione occorre solo fare       markerVertices: new Float32Array(markerVertices), markerIndices: new Uint16Array(markerIndices),*/ 
        lines.push({
            lineVertices: new Float32Array(vertices),
            lineIndices: new Uint16Array(indices),
            markerVertices: new Float32Array(),
            markerIndices: new Uint16Array(),
            hour: hour,
            angle: angle
        });
    });

    return lines;
}