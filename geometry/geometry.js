
import { calculateSundialHourAngles } from '../utils/astronomy.js';

/**
 * Creates a flat square plane made of triangle tiles, centered at the origin.
 *
 * @param {number} size - Half-length of the plane; total width is size * 2.
 * @param {number} [segments=60] - Number of subdivisions along each axis.
 * @returns {{vertices: Float32Array, indices: Uint16Array}} WebGL-ready vertex and index data.
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
 * Generates radial hour lines and optional marker blocks based on sundial hour angles.
 * Each hour line is a thin ribbon extending outward from the gnomon, and optionally includes a 3D marker block.
 *
 * @returns {Array<{
 *   lineVertices: Float32Array,
 *   lineIndices: Uint16Array,
 *   markerVertices: Float32Array,
 *   markerIndices: Uint16Array,
 *   hour: number,
 *   angle: number
 * }>} Array of hour line geometry data.
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
/**
 * Creates a UV-mapped sphere geometry with normals for shading.
 *
 * @param {number} [radius=1.0] - Radius of the sphere.
 * @param {number} [segments=16] - Number of vertical and horizontal subdivisions.
 * @returns {{vertices: Float32Array, indices: Uint16Array}} WebGL-ready geometry.
 */
export function createSphere(radius = 1.0, segments = 16) {
    const vertices = [];
    const indices = [];

    // Generate vertices
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

    // Generate indices
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
/**
 * Generates the geometry for a single curved grass blade.
 *
 * @param {number} [segments=4] - Number of vertical segments in the blade.
 * @param {number} [height=1.0] - Height of the blade.
 * @returns {{vertices: Float32Array, indices: Uint16Array}} Geometry of a blade mesh.
 */
export function createGrassBladeGeometry(segments = 4, height = 1.0) {
    const vertices = [];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
        const y = (i / segments) * height;
        const width = (1 - Math.pow(i / segments, 1.5)) * 0.05;
        const bend = 0.2 * Math.pow(i / segments, 2); // slight curvature

        // Left and right vertex with curvature
        vertices.push(-width + bend, y, 0, 0, 1, 0, i / segments, 0); // sx
        vertices.push(+width + bend, y, 0, 0, 1, 0, i / segments, 1); // dx

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
/**
 * Randomly distributes individual grass blades across a square field.
 *
 * @param {number} [count=600] - Number of grass blades.
 * @param {number} [areaSize=23] - Side length of the field (centered at origin).
 * @returns {Array<{
 *   position: [number, number, number],
 *   rotation: number,
 *   scale: number,
 *   height: number,
 *   geometry: { vertices: Float32Array, indices: Uint16Array }
 * }>} Array of grass blade transforms and geometry.
 */
export function scatterGrassField(count = 600, areaSize = 23) {
    const blades = [];

    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * areaSize;
        const z = (Math.random() - 0.5) * areaSize;
        const angle = Math.random() * Math.PI * 2;
        
        const scale = 0.4 + Math.random() * 0.4;
        const height = 0.5 + Math.random(); // random height

        blades.push({
            position: [x, 0, z],
            rotation: angle,
            scale: scale,
            height: height, 
            geometry: createGrassBladeGeometry(4, height)
        });
    }

    return blades;
}
/**
 * Constructs a cloud from multiple scaled and positioned sphere parts.
 * Returns the component parts that make up one volumetric cloud.
 *
 * @returns {Array<{
 *   geometry: { vertices: Float32Array, indices: Uint16Array },
 *   localPosition: [number, number, number],
 *   scale: number
 * }>} Array of cloud parts used for rendering.
 */

export function createStructuredCloudGeometry() {
    const cloudParts = [];

    const baseY = 0;
    const zOffset = 0.02; // nearly flat


    // Central lobe
    cloudParts.push({
        geometry: createSphere(1.2, 24),
        localPosition: [0, baseY, 0],
        scale: 1.0,
    });

    // Side lobes
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

    // Small outer lobes
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

    // Top bulge
    cloudParts.push({
        geometry: createSphere(0.7, 24),
        localPosition: [0, baseY + 0.9, 0],
        scale: 0.6,
    });

    return cloudParts;
}
/**
 * Generates multiple cloud objects with randomized positions, shading, and scale.
 * Each cloud is composed of several spherical parts (from `createStructuredCloudGeometry`).
 *
 * @returns {Array<{
 *   parts: ReturnType<typeof createStructuredCloudGeometry>,
 *   position: [number, number, number],
 *   baseScale: number,
 *   speed: number,
 *   grayIntensity: number,
 *   warmth: number,
 *   wobblePhase: number
 * }>} Array of full cloud objects with metadata for animation and shading.
 */

export function createCloudsGeometry() {
    const clouds = [];

     // Create 3-4 clouds scattered in the sky
    for (let i = 0; i < 4; i++) {
        const position = [
            -10 + i * 7, // X distributed
            8 + Math.random(), // Y random
            -4 + Math.random() * 8 // Z
        ];

        clouds.push({
            parts: createStructuredCloudGeometry(), 
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
/**
 * Creates a vertical rectangular prism (gnomon) to cast the shadow in the sundial.
 *
 * @returns {{vertices: Float32Array, indices: Uint16Array}} Geometry of the gnomon.
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



