
import { calculateSundialHourAngles } from '../utils/astronomy.js';

/**
 * Creates a flat square ground plane made of triangle tiles.
 * @param {number} size - The total width/length of the plane.
 * @returns {{vertices: Float32Array, indices: Uint16Array}} WebGL-ready geometry data.
 */
export function createPlane(size, segments = 60) {
    
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
export function createSphere(radius = 1.0, segments = 16) {
    const vertices = [];
    const indices = [];

    // Genera vertici
    for (let lat = 0; lat <= segments; lat++) {
        const theta = lat * Math.PI / segments;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= segments; lon++) {
            const phi = lon * 2 * Math.PI / segments;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;

            // Position
            vertices.push(x * radius, y * radius, z * radius);
            // Normal (same as position for sphere)
            vertices.push(x, y, z);
            // Texture coordinates
            vertices.push(lon / segments, lat / segments);
        }
    }

    // Genera indici
    for (let lat = 0; lat < segments; lat++) {
        for (let lon = 0; lon < segments; lon++) {
            const first = (lat * (segments + 1)) + lon;
            const second = first + segments + 1;

            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
    };
}
export function createGrassBladeGeometry(segments = 4, height = 1.0) {
    const vertices = [];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
        const y = (i / segments) * height;
        const width = (1 - Math.pow(i / segments, 1.5)) * 0.05;
        const bend = 0.2 * Math.pow(i / segments, 2); // leggera curvatura

        // Vertice sinistro e destro con piega verso una direzione
        vertices.push(-width + bend, y, 0, 0, 1, 0, i / segments, 0); // sinistra
        vertices.push(+width + bend, y, 0, 0, 1, 0, i / segments, 1); // destra

        if (i < segments) {
            const base = i * 2;
            indices.push(base, base + 1, base + 2);
            indices.push(base + 1, base + 3, base + 2);
        }
    }

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
    };
}

export function scatterGrassField(count = 600, areaSize = 23) {
    const blades = [];

    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * areaSize;
        const z = (Math.random() - 0.5) * areaSize;
        const angle = Math.random() * Math.PI * 2;
        
        const scale = 0.4 + Math.random() * 0.4;
        const height = 0.5 + Math.random(); // 👈 altezza casuale

        blades.push({
            position: [x, 0, z],
            rotation: angle,
            scale: scale,
            height: height, // 👈 utile per animazioni nel vento
            geometry: createGrassBladeGeometry(4, height)
        });
    }

    return blades;
}

export function createStructuredCloudGeometry() {
    const cloudParts = [];

    const baseY = 0;
    const zOffset = 0.02; // quasi piatte


    // Centro grande
    cloudParts.push({
        geometry: createSphere(1.2, 24),
        localPosition: [0, baseY, 0],
        scale: 1.0,
    });

    // Lati (grandi lobi)
    cloudParts.push({
        geometry: createSphere(1.0, 24),
        localPosition: [-1.4, baseY - 0.1, zOffset],
        scale: 0.8,
    });
    cloudParts.push({
        geometry: createSphere(1.0, 24),
        localPosition: [1.4, baseY - 0.1, -zOffset],
        scale: 0.8,
    });

    // Lobi esterni piccoli
    cloudParts.push({
        geometry: createSphere(0.8, 24),
        localPosition: [-2.3, baseY - 0.25, 0],
        scale: 0.65,
    });
    cloudParts.push({
        geometry: createSphere(0.8, 24),
        localPosition: [2.3, baseY - 0.25, 0],
        scale: 0.65,
    });

    // Gobba superiore
    cloudParts.push({
        geometry: createSphere(0.7, 24),
        localPosition: [0, baseY + 0.9, 0],
        scale: 0.6,
    });

    return cloudParts;
}

export function createCloudsGeometry() {
    const clouds = [];

    // Crea 3-4 nuvole sparse in posizioni diverse
    for (let i = 0; i < 4; i++) {
        const position = [
            -10 + i * 7, // X distribuito
            8 + Math.random(), // Y (altezza cielo)
            -4 + Math.random() * 8 // Z
        ];

        clouds.push({
            parts: createStructuredCloudGeometry(), // ✅ chiamata corretta
            position: position,
            baseScale: 1.0 + Math.random() * 0.4,
            speed: 0.2 + Math.random() * 0.5,
            grayIntensity: 0.8 + Math.random() * 0.2,
            warmth: 0.1 + Math.random() * 0.1,
            wobblePhase: Math.random() * 6.28
        });
    }

    return clouds;
}


