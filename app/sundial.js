/**
 * Main class for the WebGL-based 3D Sundial application.
 * Initializes shaders, geometry, controls, and manages the render loop.
 */
import { skyVertexShaderSource, skyFragmentShaderSource } from '../webgl/shaders.js';
import { createSkyProgram, createSkyDome } from '../webgl/webgl-utils.js';
import { vertexShaderSource, fragmentShaderSource } from '../webgl/shaders.js';
import { createShader, createProgram, createBuffer, createIndexBuffer, initializeWebGL, resizeCanvas, setupWebGLState, initShadowMap } from '../webgl/webgl-utils.js';
import { mat4, identity, perspective, lookAt, multiply, createOrthographicMatrix } from '../utils/math-utils.js';
import { calculateTimeFromSun, calculateShadowTime, calculateSundialHourAngles } from '../utils/astronomy.js';
import { createPlane } from '../geometry/geometry.js';
import { Renderer } from '../renderer/renderer.js';
import { CameraControls, UIControls } from '../controls/controls.js';
import { createCloudsGeometry, createStructuredCloudGeometry, createHourLines,createSphere,scatterGrassField } from '../geometry/geometry.js';

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
        /** @type {WebGLProgram} */
        this.skyProgram = null;
        /** Container for sky geometry */
        this.skyGeometry = null;
        /** Container for sky buffers */
        this.skyBuffers = {};
        /** Shadow mapping resources */
        this.shadowFramebuffer = null;
        this.shadowTexture = null;
        this.shadowProgram = null;
        /** Quality state tracking */
        this.isLowQualityLoaded = false;
        /** FPS tracking */
        this.frameCount = 0;
        this.lastFpsUpdate = 0;

        this.init();
    }

    /**
     * Initializes WebGL context, shaders, geometry, controls, and starts rendering.
     */
    init() {
        try {
            // Initialize WebGL
            this.gl = initializeWebGL(this.canvas);
            if (!this.gl) {
                console.error('Failed to initialize WebGL');
                return;
            }

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

            // Initialize shadow mapping
            const shadowResources = initShadowMap(this.gl);
            if (shadowResources) {
                this.shadowFramebuffer = shadowResources.shadowFramebuffer;
                this.shadowTexture = shadowResources.shadowTexture;
                this.shadowProgram = shadowResources.shadowProgram;

                // Set shadow program in renderer
                this.renderer.setShadowProgram(this.shadowProgram);
            }

            // Initialize user controls
            this.cameraControls = new CameraControls(this.canvas);
            this.uiControls = new UIControls();
            // Load grass texture

            // Start rendering loop
            this.render();
        } catch (error) {
            console.error('Initialization error:', error);
        }
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

        // Create sky program
        this.skyProgram = createSkyProgram(this.gl, skyVertexShaderSource, skyFragmentShaderSource);

        if (!this.program || !this.skyProgram) {
            throw new Error('Failed to create shader programs');
        }
    }

    // Aggiorna il metodo createCloudBuffers
    createCloudBuffers() {
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
    // Aggiorna il rendering per la nuova geometria
    renderRealisticClouds(projectionMatrix, viewMatrix, time) {
    const gl = this.gl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    const driftTime = time * 0.0001;

    this.buffers.clouds.forEach((cloud, index) => {
        const cloudData = this.geometries.clouds[index];

        // Movimento fluido su traiettoria curva
        const driftX = Math.sin(driftTime + index * 0.4) * 5;
        const driftZ = Math.cos(driftTime * 0.8 + index * 0.6) * 4;

        const cloudBaseX = cloud.position[0] + driftX;
        const cloudBaseY = cloud.position[1];
        const cloudBaseZ = cloud.position[2] + driftZ;

        cloud.parts.forEach((partBuffer, partIndex) => {
            const partData = cloudData.parts[partIndex];

            const finalX = cloudBaseX + partData.localPosition[0];
            const finalZ = cloudBaseZ + partData.localPosition[2];

            // Oscillazione verticale morbida
            const wobbleY = Math.sin(time * 0.1 + partIndex * 1.3 + cloudData.wobblePhase) * 0.008;
            const finalY = cloudBaseY + partData.localPosition[1] + wobbleY;

            const partModelMatrix = mat4();
            identity(partModelMatrix);

            const scale = partData.scale * cloud.baseScale;
            partModelMatrix[0] = scale;
            partModelMatrix[5] = scale * 0.8;
            partModelMatrix[10] = scale;

            partModelMatrix[12] = finalX;
            partModelMatrix[13] = finalY;
            partModelMatrix[14] = finalZ;

            const partMvpMatrix = mat4();
            multiply(partMvpMatrix, projectionMatrix, viewMatrix);
            multiply(partMvpMatrix, partMvpMatrix, partModelMatrix);

            this.renderer.setUniforms([0, -1, 0], partMvpMatrix, partModelMatrix, partModelMatrix, false, false);

            const cloudColor = [
                cloudData.grayIntensity * 0.9,
                cloudData.grayIntensity,
                cloudData.grayIntensity * 1.1 + cloudData.warmth
            ];

            const u_isSphereLocation = gl.getUniformLocation(this.program, 'u_isSphere');
            if (u_isSphereLocation) {
                gl.uniform1f(u_isSphereLocation, 1.0);
            }

            const u_opacityLocation = gl.getUniformLocation(this.program, 'u_opacity');
            if (u_opacityLocation) {
                gl.uniform1f(u_opacityLocation, 0.75);
            }

            this.renderer.drawObject(
                partBuffer.vertex,
                partBuffer.index,
                partData.geometry.indices.length,
                cloudColor,
                false, false, false, true
            );
        });
    });

    gl.depthMask(true);
    gl.disable(gl.BLEND);
}





    /**
     * Updated createBuffers method to handle realistic clouds
     */
    createBuffers() {
        const gl = this.gl;

        // Plane buffers
        this.buffers.planeVertex = createBuffer(gl, this.geometries.plane.vertices);
        this.buffers.planeIndex = createIndexBuffer(gl, this.geometries.plane.indices);

        // Gnomon buffers
        this.buffers.gnomonVertex = createBuffer(gl, this.geometries.gnomon.vertices);
        this.buffers.gnomonIndex = createIndexBuffer(gl, this.geometries.gnomon.indices);

        // Sun buffers
        this.buffers.sunVertex = createBuffer(gl, this.geometries.sun.vertices);
        this.buffers.sunIndex = createIndexBuffer(gl, this.geometries.sun.indices);

        // Hour line buffers
        this.buffers.hourLines = this.geometries.hourLines.map(line => ({
            lineVertexBuffer: createBuffer(gl, line.lineVertices),
            lineIndexBuffer: createIndexBuffer(gl, line.lineIndices),
            markerVertexBuffer: createBuffer(gl, line.markerVertices),
            markerIndexBuffer: createIndexBuffer(gl, line.markerIndices),
            hour: line.hour,
            angle: line.angle
        }));
        this.buffers.grassBlades = this.geometries.grassBlades.map(blade => ({
    vertex: createBuffer(gl, blade.geometry.vertices),
    index: createIndexBuffer(gl, blade.geometry.indices),
    transform: blade
}));

        // Sky buffers
        this.skyBuffers.vertex = createBuffer(gl, this.skyGeometry.vertices);
        this.skyBuffers.index = createIndexBuffer(gl, this.skyGeometry.indices);

        // Realistic cloud buffers
        this.createCloudBuffers();
        this.buffers.grassBlades = this.geometries.grassBlades.map(blade => ({
    vertex: createBuffer(gl, blade.geometry.vertices),
    index: createIndexBuffer(gl, blade.geometry.indices),
    transform: blade
}));
    }

    /**
     * Updates quality settings by recreating plane geometry if needed.
     */
    updateQualitySettings(lowQuality) {
        if (lowQuality && !this.isLowQualityLoaded) {
            this.geometries.plane = createPlane(12, 10);
            this.buffers.planeVertex = createBuffer(this.gl, this.geometries.plane.vertices);
            this.buffers.planeIndex = createIndexBuffer(this.gl, this.geometries.plane.indices);
            this.isLowQualityLoaded = true;
        } else if (!lowQuality && this.isLowQualityLoaded) {
            this.geometries.plane = createPlane(12, 60);
            this.buffers.planeVertex = createBuffer(this.gl, this.geometries.plane.vertices);
            this.buffers.planeIndex = createIndexBuffer(this.gl, this.geometries.plane.indices);
            this.isLowQualityLoaded = false;
        }
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

            // Transform to screen coordinates using MVP matrix
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

                // Create HTML element for markers
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
     * Updates and displays FPS counter.
     */
    updateFPS() {
        this.frameCount++;
        const now = performance.now();

        if (now - this.lastFpsUpdate >= 1000) {
            const fps = this.frameCount;
            const fpsElement = document.getElementById('fpsCounter');
            if (fpsElement) {
                fpsElement.textContent = `FPS: ${fps}`;
            }
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }
    }

    /**
     * Renders depth-only geometry into the shadow map framebuffer.
     */
    renderForShadowMap() {
        const gl = this.gl;

        // Use the shadow program
        gl.useProgram(this.shadowProgram);

        // Render gnomon (casts shadows)
        this.renderer.drawShadowObject(
            this.buffers.gnomonVertex,
            this.buffers.gnomonIndex,
            this.geometries.gnomon.indices.length
        );

        // Render hour lines (can cast shadows too)
        this.buffers.hourLines.forEach((lineData, index) => {
            const originalLineData = this.geometries.hourLines[index];

            // Render line geometry
            this.renderer.drawShadowObject(
                lineData.lineVertexBuffer,
                lineData.lineIndexBuffer,
                originalLineData.lineIndices.length
            );

            // Render marker geometry
            this.renderer.drawShadowObject(
                lineData.markerVertexBuffer,
                lineData.markerIndexBuffer,
                originalLineData.markerIndices.length
            );
        });
    }

    /**
     * Renders the animated sky dome with sun position.
     */
    renderSky(lightDirection, projectionMatrix, viewMatrix, time) {
        const gl = this.gl;

        if (!this.skyProgram) {
            console.error('Sky program not created');
            return;
        }

        // Save current program
        const previousProgram = this.program;

        // Use sky program
        gl.useProgram(this.skyProgram);

        // Disable depth writing for sky
        gl.depthMask(false);
        gl.disable(gl.DEPTH_TEST);

        // Sky MVP matrix (large scale)
        const skyModelMatrix = mat4();
        const skyMvpMatrix = mat4();
        identity(skyModelMatrix);

        // Scale sky to be very large
        skyModelMatrix[0] = 50;  // Scale X
        skyModelMatrix[5] = 50;  // Scale Y
        skyModelMatrix[10] = 50; // Scale Z

        multiply(skyMvpMatrix, projectionMatrix, viewMatrix);
        multiply(skyMvpMatrix, skyMvpMatrix, skyModelMatrix);

        // Set sky uniforms
        const skyMvpLocation = gl.getUniformLocation(this.skyProgram, 'u_modelViewProjectionMatrix');
        const skyLightLocation = gl.getUniformLocation(this.skyProgram, 'u_lightDirection');
        const skyTimeLocation = gl.getUniformLocation(this.skyProgram, 'u_time');

        if (skyMvpLocation) gl.uniformMatrix4fv(skyMvpLocation, false, skyMvpMatrix);
        if (skyLightLocation) gl.uniform3fv(skyLightLocation, lightDirection);
        if (skyTimeLocation) gl.uniform1f(skyTimeLocation, time * 0.001);

        // Bind and draw sky geometry
        if (this.skyBuffers.vertex && this.skyBuffers.index) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffers.vertex);
            const skyPositionLocation = gl.getAttribLocation(this.skyProgram, 'a_position');
            if (skyPositionLocation >= 0) {
                gl.enableVertexAttribArray(skyPositionLocation);
                gl.vertexAttribPointer(skyPositionLocation, 3, gl.FLOAT, false, 0, 0);
            }

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.skyBuffers.index);
            gl.drawElements(gl.TRIANGLES, this.skyGeometry.indices.length, gl.UNSIGNED_SHORT, 0);
        }

        // Re-enable depth test and writing
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);

        // Restore previous program
        gl.useProgram(previousProgram);
    }

    

    /**
     * Main rendering loop: updates solar animation, controls, WebGL, and UI.
     * Uses `requestAnimationFrame` to draw each frame.
     */
    render = () => {
        try {
            // Verify initialization
            if (!this.renderer || !this.uiControls || !this.cameraControls) {
                console.error('App not fully initialized');
                requestAnimationFrame(this.render);
                return;
            }

            const values = this.uiControls.getValues();

            // Handle quality settings
            this.updateQualitySettings(values.lowQuality);

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

            // Calculate sun position for point light
            const sunDistance = 5;
            const sunPosition = [
                -lightDirection[0] * sunDistance,
                Math.max(2, -lightDirection[1] * sunDistance + 8),
                -lightDirection[2] * sunDistance
            ];

            // Update time displays
            const currentTime = calculateTimeFromSun(values.sunAngle, values.sunHeight, values.dayOfYear);
            const shadowTimeStr = calculateShadowTime(lightDirection, values.dayOfYear);
            this.uiControls.updateTimeDisplay(currentTime, shadowTimeStr);

            // Calculate light matrices for shadows
            const lightViewMatrix = mat4();
            const lightViewProjectionMatrix = mat4();

            const lightDistance = 30;
            const lightPos = [
                -lightDirection[0] * lightDistance,
                Math.max(5, Math.abs(lightDirection[1]) * lightDistance + 5),
                -lightDirection[2] * lightDistance
            ];

            lookAt(lightViewMatrix, lightPos, [0, 0, 0], [0, 1, 0]);
            const lightProjectionMatrix = createOrthographicMatrix(-25, 25, -25, 25, 1, 100);
            multiply(lightViewProjectionMatrix, lightProjectionMatrix, lightViewMatrix);

            // 1. RENDER SHADOW MAP
            if (values.enableShadows && this.shadowFramebuffer) {
                this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.shadowFramebuffer);
                this.gl.viewport(0, 0, 2048, 2048);
                this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
                this.gl.useProgram(this.shadowProgram);

                const lightMvpLocation = this.gl.getUniformLocation(this.shadowProgram, 'u_lightViewProjectionMatrix');
                this.gl.uniformMatrix4fv(lightMvpLocation, false, lightViewProjectionMatrix);

                this.renderForShadowMap();

                this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
                this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            }

            // 2. NORMAL SCENE RENDER
            setupWebGLState(this.gl);
            this.gl.useProgram(this.program);

            // Set up view and projection matrices
            const projectionMatrix = mat4();
            const viewMatrix = mat4();
            const modelMatrix = mat4();
            const mvpMatrix = mat4();

            perspective(projectionMatrix, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100);

            // Camera position
            const cameraPos = this.cameraControls.getCameraPosition();
            lookAt(viewMatrix, cameraPos, [0, 0, 0], [0, 5, 0]);

            // Render sky first
            this.renderSky(lightDirection, projectionMatrix, viewMatrix, this.animationTime * 1000);

            // Set up matrices for scene objects
            identity(modelMatrix);
            multiply(mvpMatrix, projectionMatrix, viewMatrix);
            multiply(mvpMatrix, mvpMatrix, modelMatrix);

            // Set shadow map texture and uniforms
            if (values.enableShadows && this.shadowTexture) {
                this.gl.activeTexture(this.gl.TEXTURE0);
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.shadowTexture);
                this.gl.uniform1i(this.gl.getUniformLocation(this.program, "u_shadowMap"), 0);
                this.gl.uniformMatrix4fv(
                    this.gl.getUniformLocation(this.program, "u_lightViewProjectionMatrix"),
                    false,
                    lightViewProjectionMatrix
                );
            }

            // Calculate simulated time for shader uniform
            let simulatedTimeHours = 12.0; // Default noon
            if (currentTime && currentTime !== 'N/A') {
                const timeParts = currentTime.split(':');
                if (timeParts.length >= 2) {
                    const hours = parseInt(timeParts[0]);
                    const minutes = parseInt(timeParts[1]);
                    simulatedTimeHours = hours + (minutes / 60.0);
                }
            }

            const realTimeLocation = this.gl.getUniformLocation(this.program, 'u_realTime');
            this.gl.uniform1f(realTimeLocation, simulatedTimeHours);
            const u_isGrassLocation = this.gl.getUniformLocation(this.program, 'u_isGrass');
this.gl.uniform1f(u_isGrassLocation, 1.0); // per l’erba
if (u_isGrassLocation) this.gl.uniform1f(u_isGrassLocation, 0.0);

            // SET POINT LIGHT UNIFORMS
            const gl = this.gl;
            const u_lightPositionLocation = gl.getUniformLocation(this.program, 'u_lightPosition');
            const u_lightIntensityLocation = gl.getUniformLocation(this.program, 'u_lightIntensity');
            const u_lightRadiusLocation = gl.getUniformLocation(this.program, 'u_lightRadius');

            if (u_lightPositionLocation) {
                gl.uniform3fv(u_lightPositionLocation, sunPosition);
            }
            if (u_lightIntensityLocation) {
                gl.uniform1f(u_lightIntensityLocation, 2.0);
            }
            if (u_lightRadiusLocation) {
                gl.uniform1f(u_lightRadiusLocation, 50.0);
            }

            this.renderer.setUniforms(lightDirection, mvpMatrix, modelMatrix, modelMatrix, values.enableShadows, values.lowQuality);

            // ERBA ANIMATA MIGLIORATA
            const grassTime = this.animationTime * 1.5;
            const windWave1 = Math.sin(grassTime) * 0.15;
            const windWave2 = Math.sin(grassTime * 1.3 + 0.5) * 0.1;
            const windWave3 = Math.cos(grassTime * 0.8) * 0.05;

            // Colore base più naturale con variazioni più evidenti
            const grassColor = [
                0.15 + Math.abs(windWave1),           // Rosso variabile
                0.4 + windWave1 + windWave2 * 2,      // Verde dominante con variazioni
                0.1 + Math.abs(windWave3)             // Blu minimo
            ];

            // Draw the ground with animated grass color
            const u_isSphereLocation = gl.getUniformLocation(this.program, 'u_isSphere');
            if (u_isSphereLocation) {
                gl.uniform1f(u_isSphereLocation, 0.0);
            }

           

            this.renderer.drawObject(
                this.buffers.planeVertex,
                this.buffers.planeIndex,
                this.geometries.plane.indices.length,
                grassColor,
                true
            );

            // Draw hour lines
            this.buffers.hourLines.forEach((lineData, index) => {
                const originalLineData = this.geometries.hourLines[index];

                // Draw line
                this.renderer.drawObject(
                    lineData.lineVertexBuffer,
                    lineData.lineIndexBuffer,
                    originalLineData.lineIndices.length,
                    [0.9, 0.9, 0.8],
                    false, false, true
                );

                // Draw hour markers
                this.renderer.drawObject(
                    lineData.markerVertexBuffer,
                    lineData.markerIndexBuffer,
                    originalLineData.markerIndices.length,
                    [0.7, 0.7, 0.6],
                    false, false, true
                );
            });

            // Draw the gnomon
            this.renderer.drawObject(
                this.buffers.gnomonVertex,
                this.buffers.gnomonIndex,
                this.geometries.gnomon.indices.length,
                [0.4, 0.3, 0.2],
                false, false, true
            );

            // Draw the sun as a sphere
            if (u_isSphereLocation) {
                gl.uniform1f(u_isSphereLocation, 1.0);
            }

            // Create sun model matrix
            const sunModelMatrix = mat4();
            identity(sunModelMatrix);

            // Position sun based on light direction
            sunModelMatrix[12] = sunPosition[0];
            sunModelMatrix[13] = sunPosition[1];
            sunModelMatrix[14] = sunPosition[2];

            // Scale sun
            const sunScale = 0.8;
            sunModelMatrix[0] = sunScale;
            sunModelMatrix[5] = sunScale;
            sunModelMatrix[10] = sunScale;

            const sunMvpMatrix = mat4();
            multiply(sunMvpMatrix, projectionMatrix, viewMatrix);
            multiply(sunMvpMatrix, sunMvpMatrix, sunModelMatrix);

            this.renderer.setUniforms(lightDirection, sunMvpMatrix, sunModelMatrix, sunModelMatrix, values.enableShadows, values.lowQuality);

            // Sun color with warm glow
            const sunColor = [1.0, 0.9, 0.6];
            this.renderer.drawObject(
                this.buffers.sunVertex,
                this.buffers.sunIndex,
                this.geometries.sun.indices.length,
                sunColor,
                false, false, false
            );
            // Render grass blades
if (this.buffers.grassBlades) {
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    
    const u_isGrassLocation = this.gl.getUniformLocation(this.program, 'u_isGrass');
    const u_windTimeLocation = this.gl.getUniformLocation(this.program, 'u_windTime');
    
    if (u_isGrassLocation) this.gl.uniform1f(u_isGrassLocation, 1.0);
    if (u_windTimeLocation) this.gl.uniform1f(u_windTimeLocation, this.animationTime);
    
    this.buffers.grassBlades.forEach((blade, index) => {
        const transform = blade.transform;
        
        // Calculate wind effect
        const windTime = this.animationTime * 2.0 + (transform.windPhase || 0);
        const windStrength = 0.15;
        const windOffsetX = Math.sin(windTime) * windStrength * (transform.height || 1);
        const windOffsetZ = Math.cos(windTime * 1.3) * windStrength * (transform.height || 1) * 0.5;
        
        // Create model matrix with wind
        const model = mat4();
        identity(model);
        
        const cos = Math.cos(transform.rotation);
        const sin = Math.sin(transform.rotation);
        model[0] = transform.scale * cos;
        model[2] = -transform.scale * sin;
        model[8] = transform.scale * sin;
        model[10] = transform.scale * cos;
        model[5] = transform.scale;
        
        model[12] = transform.position[0] + windOffsetX;
        model[13] = transform.position[1];
        model[14] = transform.position[2] + windOffsetZ;
        
        const mvp = mat4();
        multiply(mvp, projectionMatrix, viewMatrix);
        multiply(mvp, mvp, model);
        
        this.renderer.setUniforms(lightDirection, mvp, model, model, values.enableShadows, values.lowQuality);
        
        // Grass color with variations
        const grassVariation = Math.sin(index * 0.1) * 0.1;
        const grassColor = [
            0.1 + grassVariation,
            0.4 + grassVariation * 2,
            0.05 + Math.abs(grassVariation)
        ];
        
        this.renderer.drawObject(
            blade.vertex,
            blade.index,
            transform.geometry.indices.length,
            grassColor,
            false, false, false, false
        );
    });
    
    // Reset uniforms
    if (u_isGrassLocation) this.gl.uniform1f(u_isGrassLocation, 0.0);
    this.gl.disable(this.gl.BLEND);
}

            // Render clouds

            this.renderRealisticClouds(projectionMatrix, viewMatrix, this.animationTime * 1000);

            // Update HTML hour markers
            this.updateHourMarkers();

            // Update FPS counter
            this.updateFPS();

        } catch (error) {
            console.error('Render error:', error);
        }

        requestAnimationFrame(this.render);
    };
    
    renderGrass(projectionMatrix, viewMatrix, lightDirection, values) {
    const gl = this.gl;
    const grassTime = this.animationTime * 1.5;
    const u_isGrassLocation = gl.getUniformLocation(this.program, 'u_isGrass');
    const u_windTimeLocation = gl.getUniformLocation(this.program, 'u_windTime');

    if (u_isGrassLocation) gl.uniform1f(u_isGrassLocation, 1.0);
    if (u_windTimeLocation) gl.uniform1f(u_windTimeLocation, this.animationTime);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.buffers.grassBlades.forEach((blade, index) => {
        const transform = blade.transform;

        const windTime = this.animationTime * 2.0 + (transform.windPhase || 0);
        const windStrength = 0.15;
        const windOffsetX = Math.sin(windTime) * windStrength * (transform.height || 1);
        const windOffsetZ = Math.cos(windTime * 1.3) * windStrength * (transform.height || 1) * 0.5;

        const model = mat4();
        identity(model);

        const cos = Math.cos(transform.rotation);
        const sin = Math.sin(transform.rotation);
        model[0] = transform.scale * cos;
        model[2] = -transform.scale * sin;
        model[8] = transform.scale * sin;
        model[10] = transform.scale * cos;
        model[5] = transform.scale;

        model[12] = transform.position[0] + windOffsetX;
        model[13] = transform.position[1];
        model[14] = transform.position[2] + windOffsetZ;

        const mvp = mat4();
        multiply(mvp, projectionMatrix, viewMatrix);
        multiply(mvp, mvp, model);

        this.renderer.setUniforms(lightDirection, mvp, model, model, values.enableShadows, values.lowQuality);

        const grassVariation = Math.sin(index * 0.1) * 0.1;
        const grassColor = [
            0.1 + grassVariation,
            0.4 + grassVariation * 2,
            0.05 + Math.abs(grassVariation)
        ];

        this.renderer.drawObject(
            blade.vertex,
            blade.index,
            transform.geometry.indices.length,
            grassColor,
            false, false, false, false
        );
    });

    if (u_isGrassLocation) gl.uniform1f(u_isGrassLocation, 0.0);
    gl.disable(gl.BLEND);
}

  /**
 * Generates the 3D geometry: plane, gnomon, hour lines, sun, sky, and clouds.
 */

 createGeometries() {
    this.geometries.plane = createPlane(12);
    this.geometries.gnomon = this.createGnomon();
    this.geometries.hourLines = createHourLines();
    // Create a larger, more detailed sun sphere
    this.geometries.sun = createSphere(1.5, 20);

    // Create sky geometry
    this.skyGeometry = createSkyDome(this.gl);

    // Create clouds geometry
    this.geometries.clouds = createCloudsGeometry();

    this.geometries.grassBlades = scatterGrassField(5000);
    
}
/**
 * Creates the 3D geometry of the gnomon (shadow-casting rod).
 * @returns {{vertices: Float32Array, indices: Uint16Array}} WebGL-ready gnomon mesh.
 */
 createGnomon() {
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

}

