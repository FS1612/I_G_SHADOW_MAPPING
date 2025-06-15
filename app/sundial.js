/**
 * Main class for the WebGL-based 3D Sundial application.
 * Initializes shaders, geometry, controls, and manages the render loop.
 */
import { vertexShaderSource, fragmentShaderSource } from '../webgl/shaders.js';
import { createShader, createProgram, createBuffer, createIndexBuffer, initializeWebGL, resizeCanvas, setupWebGLState } from '../webgl/webgl-utils.js';
import { mat4, identity, perspective, lookAt, multiply } from '../utils/math-utils.js';
import { calculateTimeFromSun, calculateShadowTime, calculateSundialHourAngles } from '../utils/astronomy.js';
import { createPlane, createGnomon, createHourLines } from '../geometry/geometry.js';
import { Renderer } from '../renderer/renderer.js';
import { CameraControls, UIControls } from '../controls/controls.js';

export class SundialApp {
    constructor() {
        /** @type {HTMLCanvasElement} */
        this.canvas = document.getElementById('canvas');
        /** @type {WebGLRenderingContext} */
        this.gl = null;
        /** @type {WebGLProgram} */
        this.program = null;
        /** @type {Renderer} */
        this.renderer = null;
        /** @type {CameraControls} */
        this.cameraControls = null;
        /** @type {UIControls} */
        this.uiControls = null;
        /** Container for generated geometry */
        this.geometries = {};
        /** Container for WebGL-created buffers */
        this.buffers = {};
        /** Time accumulator for solar animation */
        this.animationTime = 0;

        this.isLowQualityLoaded = false;
        this.init();
    }
    /**
     * Initializes WebGL context, shaders, geometry, controls, and starts rendering.
     */
    init() {
        // Initialize WebGL
        this.gl = initializeWebGL(this.canvas);
        if (!this.gl) return;

        // Canvas setup
        this.setupCanvas();

        // Compile shaders and link program
        this.setupShaders();

        // Create 3D geometry
        this.createGeometries();

        // Create WebGL buffers
        this.createBuffers();

        // Initialize renderer
        this.renderer = new Renderer(this.gl, this.program);

        // Initialize user controls
        this.cameraControls = new CameraControls(this.canvas);
        this.uiControls = new UIControls();

        // Start rendering loop
        this.render();
    }
    /**
     * Configures canvas size and handles dynamic window resizing.
     */
    setupCanvas() {
        resizeCanvas(this.canvas, this.gl);
        window.addEventListener('resize', () => resizeCanvas(this.canvas, this.gl));
    }
    /**
     * Compiles shaders and creates the WebGL rendering program.
     */
    setupShaders() {
        const vertexShader = createShader(this.gl, this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = createShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.program = createProgram(this.gl, vertexShader, fragmentShader);
    }
    /**
     * Generates the 3D geometry: plane, gnomon, and hour lines.
     */

    createGeometries() {
        this.geometries.plane = createPlane(12);
        this.geometries.gnomon = createGnomon();
        this.geometries.hourLines = createHourLines();
    }
    /**
     * Generates the 3D geometry: plane, gnomon, and hour lines.
     */
    createBuffers() {
        const gl = this.gl;

        // Plane buffers
        this.buffers.planeVertex = createBuffer(gl, this.geometries.plane.vertices);
        this.buffers.planeIndex = createIndexBuffer(gl, this.geometries.plane.indices);

        // Gnomon buffers
        this.buffers.gnomonVertex = createBuffer(gl, this.geometries.gnomon.vertices);
        this.buffers.gnomonIndex = createIndexBuffer(gl, this.geometries.gnomon.indices);

        // Hour line buffers
        this.buffers.hourLines = this.geometries.hourLines.map(line => ({
            lineVertexBuffer: createBuffer(gl, line.lineVertices),
            lineIndexBuffer: createIndexBuffer(gl, line.lineIndices),
            markerVertexBuffer: createBuffer(gl, line.markerVertices),
            markerIndexBuffer: createIndexBuffer(gl, line.markerIndices),
            hour: line.hour,
            angle: line.angle
        }));
    }
    /**
     * Computes and renders HTML hour markers at their corresponding 3D positions.
     */
    updateHourMarkers() {
        // Remove existing markers
        document.querySelectorAll('.hour-markers').forEach(el => el.remove());

        const ROME_LATITUDE = 41.9 * Math.PI / 180;
        const hourAngles = calculateSundialHourAngles(ROME_LATITUDE);

        // Use the same matrices as in 3D rendering
        const projectionMatrix = mat4();
        const viewMatrix = mat4();
        const mvpMatrix = mat4();

        perspective(projectionMatrix, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100);

        // Camera position (same as render)
        const cameraPos = this.cameraControls.getCameraPosition();
        lookAt(viewMatrix, cameraPos, [0, 0, 0], [0, 1, 0]);
        multiply(mvpMatrix, projectionMatrix, viewMatrix);

        hourAngles.forEach(hourData => {
            const angle = hourData.angle;
            const length = 8; // distance from center

            // 3D position of the hour marker
            const x3d = Math.sin(angle) * length;
            const y3d = 0.5; // height from plane
            const z3d = Math.cos(angle) * length;

            // Trasforma in coordinate schermo usando la matrice MVP
            const worldPos = [x3d, y3d, z3d, 1];

            // Project to clip space using mvp
            const clipX = worldPos[0] * mvpMatrix[0] + worldPos[1] * mvpMatrix[4] + worldPos[2] * mvpMatrix[8] + worldPos[3] * mvpMatrix[12];
            const clipY = worldPos[0] * mvpMatrix[1] + worldPos[1] * mvpMatrix[5] + worldPos[2] * mvpMatrix[9] + worldPos[3] * mvpMatrix[13];
            const clipW = worldPos[0] * mvpMatrix[3] + worldPos[1] * mvpMatrix[7] + worldPos[2] * mvpMatrix[11] + worldPos[3] * mvpMatrix[15];

            // Convert to screen coordinates
            if (clipW > 0) {
                const ndcX = clipX / clipW;
                const ndcY = clipY / clipW;

                const screenX = (ndcX + 1) * 0.5 * this.canvas.width;
                const screenY = (1 - ndcY) * 0.5 * this.canvas.height;

                //HTML element for markers
                const marker = document.createElement('div');
                marker.className = 'hour-markers';
                marker.textContent = hourData.hour;
                marker.style.left = screenX + 'px';
                marker.style.top = screenY + 'px';
                marker.style.transform = 'translate(-50%, -50%)';
                document.body.appendChild(marker);
            }
        });
    }
    /**
     * Main rendering loop: updates solar animation, controls, WebGL, and UI.
     * Uses `requestAnimationFrame` to draw each frame.
     */
    render = () => {
        try {
            const values = this.uiControls.getValues();
            //to check if the user want the terrain to be fully detailed or not
            if (values.lowQuality && !this.isLowQualityLoaded) {
                this.geometries.plane = createPlane(12, 10); 
                this.buffers.planeVertex = createBuffer(this.gl, this.geometries.plane.vertices);
                this.buffers.planeIndex = createIndexBuffer(this.gl, this.geometries.plane.indices);
                this.isLowQualityLoaded = true;
            } else if (!values.lowQuality && this.isLowQualityLoaded) {
                this.geometries.plane = createPlane(12, 60); 
                this.buffers.planeVertex = createBuffer(this.gl, this.geometries.plane.vertices);
                this.buffers.planeIndex = createIndexBuffer(this.gl, this.geometries.plane.indices);
                this.isLowQualityLoaded = false;
            }
            // Update sun position if auto-rotation is enabled
            if (values.autoRotate) {
                this.animationTime += 0.01;
                const sunAngle = 90 + ((this.animationTime * 15) % 180);
                this.uiControls.setSunAngle(sunAngle);
                values.sunAngle = sunAngle;
            }

            // Calculate light direction vector
            const azimuthRad = values.sunAngle * Math.PI / 180;
            const elevationRad = values.sunHeight * Math.PI / 180;

            const lightDirection = [
                Math.sin(azimuthRad) * Math.cos(elevationRad),
                -Math.sin(elevationRad),
                Math.cos(azimuthRad) * Math.cos(elevationRad)
            ];

            // Update time displays
            const currentTime = calculateTimeFromSun(values.sunAngle, values.sunHeight, values.dayOfYear);
            const shadowTimeStr = calculateShadowTime(lightDirection, values.dayOfYear);
            this.uiControls.updateTimeDisplay(currentTime, shadowTimeStr);

            //  WebGL setup
            setupWebGLState(this.gl);
            this.gl.useProgram(this.program);

            // View and projection matrices
            const projectionMatrix = mat4();
            const viewMatrix = mat4();
            const modelMatrix = mat4();
            const mvpMatrix = mat4();
            const normalMatrix = mat4();

            perspective(projectionMatrix, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100);

            // Camera position
            const cameraPos = this.cameraControls.getCameraPosition();
            lookAt(viewMatrix, cameraPos, [0, 0, 0], [0, 1, 0]);

            // Matrces setup 
            identity(modelMatrix);
            multiply(mvpMatrix, projectionMatrix, viewMatrix);
            multiply(mvpMatrix, mvpMatrix, modelMatrix);

            this.renderer.setUniforms(lightDirection, mvpMatrix, modelMatrix, modelMatrix, values.enableShadows, values.lowQuality);


            // Draw the ground
            this.renderer.drawObject(
                this.buffers.planeVertex,
                this.buffers.planeIndex,
                this.geometries.plane.indices.length,
                [0.3, 0.7, 0.3],
                true
            );

            // Draw hour lines
            this.buffers.hourLines.forEach(lineData => {
                // line
                this.renderer.drawObject(
                    lineData.lineVertexBuffer,
                    lineData.lineIndexBuffer,
                    lineData.lineIndexBuffer.length || this.geometries.hourLines.find(h => h.hour === lineData.hour)?.lineIndices.length || 0,
                    [0.9, 0.9, 0.8],
                    false, false, true
                );

                // hour markers
                this.renderer.drawObject(
                    lineData.markerVertexBuffer,
                    lineData.markerIndexBuffer,
                    lineData.markerIndexBuffer.length || this.geometries.hourLines.find(h => h.hour === lineData.hour)?.markerIndices.length || 0,
                    [0.7, 0.7, 0.6],
                    false, false, true
                );
            });

            // Draw the gnomon
            this.renderer.drawObject(
                this.buffers.gnomonVertex,
                this.buffers.gnomonIndex,
                this.geometries.gnomon.indices.length,
                [0.8, 0.6, 0.2],
                false, true
            );

            // Update HTML hour markers
            this.updateHourMarkers();

        } catch (error) {
            console.error('Rendering error:', error);
        }
        // FPS Counter
        this.frameCount = (this.frameCount || 0) + 1;
        const now = performance.now();
        this.lastFpsUpdate = this.lastFpsUpdate || now;
        if (now - this.lastFpsUpdate >= 1000) {
            const fps = this.frameCount;
            const fpsElement = document.getElementById('fpsCounter');
            if (fpsElement) {
                fpsElement.textContent = `FPS: ${fps}`;
            }
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }
        requestAnimationFrame(this.render);
    }
}