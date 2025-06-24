/**
 * Main class for the WebGL-based 3D Sundial application.
 * Initializes shaders, geometry, controls, and manages the render loop.
 */
import { skyVertexShaderSource, skyFragmentShaderSource } from '../webgl/shaders.js';
import { createSkyProgram, createSkyDome } from '../webgl/webgl-utils.js';
import { vertexShaderSource, fragmentShaderSource } from '../webgl/shaders.js';
import { createShader, createProgram, createBuffer, createIndexBuffer, initializeWebGL, resizeCanvas, initShadowMap } from '../webgl/webgl-utils.js';
import { mat4, identity, perspective, lookAt, multiply, createOrthographicMatrix } from '../utils/math-utils.js';
import { calculateTimeFromSun, calculateShadowTime, calculateSundialHourAngles } from '../utils/astronomy.js';
import { createPlane } from '../geometry/geometry.js';
import { Renderer } from '../renderer/renderer.js';
import { CameraControls, UIControls } from '../controls/controls.js';
import { createCloudsGeometry, createStructuredCloudGeometry, createHourLines,createSphere,scatterGrassField,createGnomon } from '../geometry/geometry.js';
import { renderMainScene } from './renderMainScene.js';
import { renderShadowPass } from './renderShadowPass.js';
import { renderForShadowMap } from './renderForShadowMap.js';
import { createCloudBuffers } from '../Buffers/createCloudBuffers.js';
import { createGrassBladesBuffer } from '../Buffers/createGrassBladesBuffer.js';
import { createHourLinesBuffer } from '../Buffers/createHourLinesBuffer.js';
/**
 * Main class for the WebGL-based 3D Sundial application.
 * 
 * This application simulates a dynamic sundial with realistic lighting,
 * animated shadows, grass, clouds, sky dome, and hour markers.
 * It manages scene initialization, rendering loop, user controls,
 * shadow mapping, and UI overlays.
 */
export class SundialApp {
    /**
     * Initializes the main app instance, binding internal methods and starting the setup process.
     * Binds render and shadow methods to `this` for reuse and calls the `init()` method.
     */
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
        this.renderShadowPass = renderShadowPass.bind(this);
    this.renderForShadowMap = renderForShadowMap.bind(this);
        this.renderMainScene = renderMainScene.bind(this);
        /**
     * Initializes WebGL context, shaders, geometry, buffers, controls, and starts the render loop.
     * Also handles error logging during startup.
     */
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
     * Creates WebGL buffers for all geometries including structured cloud rendering.
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
           createHourLinesBuffer.call(this);
            createGrassBladesBuffer.call(this);
            // Grass blade buffers
            
    
            // Sky buffers
            this.skyBuffers.vertex = createBuffer(gl, this.skyGeometry.vertices);
            this.skyBuffers.index = createIndexBuffer(gl, this.skyGeometry.indices);
    
            // Realistic cloud buffers
            createCloudBuffers.call(this);
        }

    /**
     * Updates quality settings by recreating plane geometry if needed.
     */
    updateQualitySettings(lowQuality) {
        if (lowQuality && !this.isLowQualityLoaded) {
                // Geometria a bassa qualità
                this.geometries.plane = createPlane(12, 240);
                this.buffers.planeVertex = createBuffer(this.gl, this.geometries.plane.vertices);
                this.buffers.planeIndex = createIndexBuffer(this.gl, this.geometries.plane.indices);
                
                // Aggiorna i grass blades per bassa qualità (20 blades)
                this.geometries.grassBlades = scatterGrassField(200);
                createGrassBladesBuffer.call(this);
                
                this.isLowQualityLoaded = true;
            } else if (!lowQuality && this.isLowQualityLoaded) {
                // Geometria ad alta qualità
                this.geometries.plane = createPlane(12, 240);
                this.buffers.planeVertex = createBuffer(this.gl, this.geometries.plane.vertices);
                this.buffers.planeIndex = createIndexBuffer(this.gl, this.geometries.plane.indices);
                
        
                this.geometries.grassBlades = scatterGrassField(2000);
                createGrassBladesBuffer.call(this);
                
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
    

    render = () => {
    try {
        if (!this.renderer || !this.uiControls || !this.cameraControls) {
            console.error('App not fully initialized');
            requestAnimationFrame(this.render);
            return;
        }

        const values = this.uiControls.getValues();
        
        this.updateQualitySettings(values.lowQuality);

        if (values.autoRotate) {
            this.updateAutoRotate(values);
        }

        const lightData = this.calculateLighting(values);
        this.updateTimeDisplays(values, lightData.lightDirection);
        this.updateHourMarkers();
        this.renderShadowPass(values, lightData);
        this.renderMainScene(values, lightData);

    } catch (error) {
        console.error('Render error:', error);
    }

    requestAnimationFrame(this.render);
};

updateAutoRotate(values) {
    this.animationTime += 0.01;
    const sunAngle = 90 + ((this.animationTime * 15) % 180);
    this.uiControls.setSunAngle(sunAngle);
    values.sunAngle = sunAngle;
}

  calculateLighting(values) {
    
    const azimuthRad = values.sunAngle * Math.PI / 180;
    const elevationRad = values.sunHeight * Math.PI / 180;

    const lightDirection = [
        Math.sin(azimuthRad) * Math.cos(elevationRad),
        -Math.sin(elevationRad),
        Math.cos(azimuthRad) * Math.cos(elevationRad)
    ];

    const sunDistance = 5;
    const sunPosition = [
        -lightDirection[0] * sunDistance,
        Math.max(2, -lightDirection[1] * sunDistance + 8),
        -lightDirection[2] * sunDistance
    ];

    const lightDistance = 30;
    const lightPos = [
        -lightDirection[0] * lightDistance,
        Math.max(5, Math.abs(lightDirection[1]) * lightDistance + 5),
        -lightDirection[2] * lightDistance
    ];

    const lightViewMatrix = mat4();
    const lightViewProjectionMatrix = mat4();
    lookAt(lightViewMatrix, lightPos, [0, 0, 0], [0, 1, 0]);
    const lightProjectionMatrix = createOrthographicMatrix(-30, 30, -25, 25, 0.1, 85);

    multiply(lightViewProjectionMatrix, lightProjectionMatrix, lightViewMatrix);

    return { lightDirection, sunPosition, lightViewProjectionMatrix };
}
  updateTimeDisplays(values, lightDirection) {
    const currentTime = calculateTimeFromSun(values.sunAngle, values.sunHeight, values.dayOfYear);
    const shadowTimeStr = calculateShadowTime(lightDirection, values.dayOfYear);
    this.uiControls.updateTimeDisplay(currentTime, shadowTimeStr);
}
setLightingUniforms(sunPosition, lightViewProjectionMatrix, values) {
    const gl = this.gl;

    if (values.enableShadows && this.shadowTexture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);
        gl.uniform1i(gl.getUniformLocation(this.program, "u_shadowMap"), 0);
        gl.uniformMatrix4fv(
            gl.getUniformLocation(this.program, "u_lightViewProjectionMatrix"),
            false,
            lightViewProjectionMatrix
        );
    }

    const u_lightPositionLocation = gl.getUniformLocation(this.program, 'u_lightPosition');
    const u_lightIntensityLocation = gl.getUniformLocation(this.program, 'u_lightIntensity');
    const u_lightRadiusLocation = gl.getUniformLocation(this.program, 'u_lightRadius');

    if (u_lightPositionLocation) gl.uniform3fv(u_lightPositionLocation, sunPosition);
    if (u_lightIntensityLocation) gl.uniform1f(u_lightIntensityLocation, 5.0);
    if (u_lightRadiusLocation) gl.uniform1f(u_lightRadiusLocation, 50.0);
}
  /**
 * Generates the 3D geometry: plane, gnomon, hour lines, sun, sky, and clouds.
 */

 createGeometries() {
         this.geometries.plane = createPlane(12);
         this.geometries.gnomon = createGnomon();
         this.geometries.hourLines = createHourLines();
         this.geometries.sun = createSphere(1.5, 20);
         this.skyGeometry = createSkyDome(this.gl);
         this.geometries.clouds = createCloudsGeometry();
         this.geometries.grassBlades = scatterGrassField(2000);
 
     }

}

