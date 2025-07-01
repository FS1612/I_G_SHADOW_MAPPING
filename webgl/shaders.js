/**
 * Vertex shader (main scene):
 * - Applies model, view, and projection transformations
 * - Computes normals and world positions for lighting
 * - Passes attributes to the fragment shader (normals, texture coords, view direction)
 * - Implements wind-based vertex animation for grass blades
 * - Outputs coordinates for shadow mapping
 */
export const vertexShaderSource = `
    precision mediump float;
    
    // Attributes
    attribute vec3 a_position;
    attribute vec3 a_normal;
    attribute vec2 a_texCoord;
    
    // Transformation matrices
    uniform mat4 u_modelViewProjectionMatrix;
    uniform mat4 u_modelMatrix;
    uniform mat4 u_normalMatrix;
    uniform mat4 u_lightViewProjectionMatrix;
    uniform vec3 u_cameraPosition;
    
    // Lighting
    uniform vec3 u_lightPosition;
    uniform vec3 u_lightDirection;
    
    // Animation
    uniform float u_isGrass;
    uniform float u_windTime;
    uniform float u_realTime;
    
    // Varyings
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec2 v_texCoord;
    varying vec3 v_lightDirection;
    varying vec3 v_worldPos;
    varying vec4 v_shadowCoord;
    varying vec3 v_lightPosition;
    varying vec3 v_viewDirection;
    
    void main() {
        vec3 pos = a_position;
        
        // Wind animation for grass
        if (u_isGrass > 0.5) {
            float heightFactor = (pos.y + 1.0) * 0.5; // 0-1 range
            float windStrength = heightFactor * heightFactor; // Quadratic for more natural bend
            
            // Multi-frequency wind
            float windX = sin(u_windTime + pos.x * 0.3 + pos.z * 0.2) * 0.15;
            float windZ = cos(u_windTime * 0.8 + pos.x * 0.2 + pos.z * 0.3) * 0.1;
            
            // Add subtle random movement
            float randomOffset = sin(pos.x * 12.34 + pos.z * 56.78) * 0.02;
            
            pos.x += (windX + randomOffset) * windStrength;
            pos.z += (windZ + randomOffset * 0.5) * windStrength;
        }
        
        // Calculate world position
        v_worldPos = (u_modelMatrix * vec4(pos, 1.0)).xyz;
        
        // Standard transformations
        gl_Position = u_modelViewProjectionMatrix * vec4(pos, 1.0);
        
        // Pass through attributes
        v_position = a_position;
        v_normal = normalize((u_normalMatrix * vec4(a_normal, 0.0)).xyz);
        v_texCoord = a_texCoord;
        v_lightDirection = normalize(u_lightDirection);
        v_lightPosition = u_lightPosition;
        v_viewDirection = normalize(u_cameraPosition - v_worldPos);
        
        // Shadow mapping coordinates
        v_shadowCoord = u_lightViewProjectionMatrix * vec4(pos, 1.0);
    }
`;

/**
 * Fragment shader (main scene):
 * - Handles per-fragment lighting and shading
 * - Supports various material types: sky, ground, grass, gnomon, hour lines, clouds, light sphere
 * - Uses shadow mapping with Percentage Closer Filtering (PCF)
 * - Implements time-of-day-based color shifts, atmospheric lighting and fake subsurface scattering
 */
export const fragmentShaderSource = `
    precision mediump float;
    
    // Material flags
    uniform float u_isGrass;
    uniform float u_isCloud;
    uniform float u_isGround;
    uniform float u_isGnomon;
    uniform float u_isHourLine;
    uniform float u_isSphere;
    uniform float u_isSky;
    
    // Material properties
    uniform vec3 u_color;
    uniform float u_opacity;
    
    // Lighting
    uniform vec3 u_lightDirection;
    uniform vec3 u_lightPosition;
    uniform float u_lightIntensity;
    uniform float u_lightRadius;
    uniform sampler2D u_shadowMap;
    uniform float u_enableShadows;
    
    // Atmosphere and time
    uniform float u_sunElevation;
    uniform float u_sunAzimuth;
    uniform float u_timeOfDay;
    uniform vec3 u_cameraPosition;
    uniform vec3 u_cameraDirection;
    
    // Animation
    uniform float u_windTime;
    uniform float u_realTime;
    
    // Varyings
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec2 v_texCoord;
    varying vec3 v_lightDirection;
    varying vec3 v_worldPos;
    varying vec4 v_shadowCoord;
    varying vec3 v_lightPosition;
    varying vec3 v_viewDirection;
    
    // ===== UTILITY FUNCTIONS =====
    
    float hash(float n) {
        return fract(sin(n) * 43758.5453);
    }
    
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float n = i.x + i.y * 57.0;
        return mix(
            mix(hash(n), hash(n + 1.0), f.x),
            mix(hash(n + 57.0), hash(n + 58.0), f.x),
            f.y
        );
    }
    
    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }
    
    // ===== LIGHTING FUNCTIONS =====
    
    vec3 getSunColor(float timeOfDay) {
        if (timeOfDay < 0.15 || timeOfDay > 0.85) {
            return vec3(0.2, 0.3, 0.6); // Night (moonlight)
        } else if (timeOfDay < 0.25 || timeOfDay > 0.75) {
            return vec3(1.0, 0.6, 0.3); // Dawn/Dusk
        } else {
            return vec3(1.0, 0.95, 0.8); // Day
        }
    }
    
    vec3 getAmbientColor(float timeOfDay) {
        if (timeOfDay < 0.15 || timeOfDay > 0.85) {
            return vec3(0.03, 0.04, 0.12); // Night
        } else if (timeOfDay < 0.25 || timeOfDay > 0.75) {
            return vec3(0.3, 0.2, 0.15); // Dawn/Dusk
        } else {
            return vec3(0.15, 0.18, 0.25); // Day
        }
    }
    float random(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

    float calculateShadowPCF() {
     if (u_enableShadows < 0.5) return 1.0;
    
    vec3 projCoords = v_shadowCoord.xyz / v_shadowCoord.w;
    projCoords = projCoords * 0.5 + 0.5;
    
    if (projCoords.z > 1.0 || 
        projCoords.x < 0.01 || projCoords.x > 0.99 ||
        projCoords.y < 0.01 || projCoords.y > 0.99) {
        return 1.0;
    }
    
    float currentDepth = projCoords.z;
    
    // Bias semplificato ma efficace
    vec3 normal = normalize(v_normal);
    vec3 lightDir = normalize(-u_lightDirection);
    float bias = 0.001 / max(dot(normal, lightDir), 0.1);
    
    vec2 texelSize = vec2(1.0 / 4096.0, 1.0 / 4096.0);
    float shadow = 0.0;
    
    // Pattern ottimizzato 3x3 con soft comparison
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            vec2 sampleCoord = projCoords.xy + offset;
            
            float pcfDepth = texture2D(u_shadowMap, sampleCoord).r;
            
            // Soft shadow transition
            float depthDiff = currentDepth - pcfDepth - bias;
            shadow += 1.0 - smoothstep(-0.0005, 0.0005, depthDiff);
        }
    }
    
    shadow /= 9.0;
    return mix(0.25, 1.0, shadow);
}
    vec3 calculateLighting(vec3 baseColor, vec3 normal, vec3 worldPos) {
        vec3 sunDir = normalize(-u_lightDirection);
        vec3 viewDir = normalize(v_viewDirection);
        
        // Sun lighting
        float NdotL = max(0.0, dot(normal, sunDir));
        vec3 sunColor = getSunColor(u_timeOfDay);
        vec3 diffuse = baseColor * sunColor * NdotL;
        
        // Point light
        vec3 pointLightDir = normalize(u_lightPosition - worldPos);
        float distance = length(u_lightPosition - worldPos);
        float attenuation = 0.0;
        
        if (distance <= u_lightRadius) {
            attenuation = u_lightIntensity / (1.0 + 0.1 * distance + 0.01 * distance * distance);
            float pointNdotL = max(0.0, dot(normal, pointLightDir));
            diffuse += baseColor * vec3(1.0, 0.9, 0.7) * pointNdotL * attenuation;
        }
        
        // Ambient
        vec3 ambient = baseColor * getAmbientColor(u_timeOfDay);
        
        // Simple specular for metallic materials
        vec3 specular = vec3(0.0);
        if (u_isGnomon > 0.5) {
            vec3 reflectDir = reflect(-sunDir, normal);
            float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
            specular = sunColor * spec * 0.3;
        }
        
        return ambient + diffuse + specular;
    }
    
    // ===== SKY FUNCTIONS =====
    
    vec3 getSkyColor(vec3 rayDir, vec3 sunDir, float timeOfDay) {
        float sunDot = dot(rayDir, sunDir);
        float elevation = rayDir.y;
        
        // Base sky colors
        vec3 zenithColor, horizonColor;
        
        if (timeOfDay < 0.15) {
            zenithColor = vec3(0.05, 0.05, 0.2);
            horizonColor = vec3(0.1, 0.1, 0.3);
        } else if (timeOfDay < 0.25) {
            zenithColor = vec3(0.6, 0.4, 0.8);
            horizonColor = vec3(1.0, 0.6, 0.3);
        } else if (timeOfDay < 0.75) {
            zenithColor = vec3(0.3, 0.6, 1.0);
            horizonColor = vec3(0.7, 0.9, 1.0);
        } else if (timeOfDay < 0.85) {
            zenithColor = vec3(0.8, 0.4, 0.6);
            horizonColor = vec3(1.0, 0.5, 0.2);
        } else {
            zenithColor = vec3(0.05, 0.05, 0.2);
            horizonColor = vec3(0.1, 0.1, 0.3);
        }
        
        // Gradient from horizon to zenith
        float t = max(0.0, elevation);
        t = 1.0 - pow(1.0 - t, 2.0); // Non-linear gradient
        vec3 skyColor = mix(horizonColor, zenithColor, t);
        
        // Sun halo
        if (sunDir.y > -0.2) {
            float sunHalo = max(0.0, sunDot);
            sunHalo = pow(sunHalo, 8.0);
            vec3 sunHaloColor = getSunColor(timeOfDay);
            skyColor += sunHaloColor * sunHalo * 0.5;
        }
        
        return skyColor;
    }
    
    // ===== MAIN SHADER =====
    
    void main() {
        vec3 normal = normalize(v_normal);
        
        // SKY DOME
        if (u_isSky > 0.5) {
            vec3 rayDir = normalize(v_worldPos - u_cameraPosition);
            vec3 sunDir = normalize(-u_lightDirection);
            vec3 skyColor = getSkyColor(rayDir, sunDir, u_timeOfDay);
            
            // Add procedural clouds
            vec2 cloudCoord = rayDir.xz / max(rayDir.y, 0.1) * 0.5;
            cloudCoord += u_realTime * 0.001;
            
            float cloudCoverage = fbm(cloudCoord * 2.0);
            cloudCoverage = smoothstep(0.4, 0.8, cloudCoverage);
            
            vec3 cloudColor = vec3(0.9, 0.9, 1.0);
            if (u_timeOfDay < 0.25 || u_timeOfDay > 0.75) {
                cloudColor = vec3(1.0, 0.7, 0.5); // Sunset clouds
            }
            
            skyColor = mix(skyColor, cloudColor, cloudCoverage * 0.7);
            
            gl_FragColor = vec4(skyColor, 1.0);
            return;
        }
        
        // TERRAIN
        if (u_isGround > 0.5) {
            vec2 terrainCoord = v_worldPos.xz * 0.3;
            float baseNoise = fbm(v_worldPos.xz * 0.5 + u_realTime * 0.02);
            // Multi-octave terrain texture
            float terrainNoise = fbm(terrainCoord * 4.0) * 0.1;
            terrainNoise += fbm(terrainCoord * 16.0) * 0.05;
            
            vec3 dirtColor = vec3(0.4, 0.3, 0.2);
            vec3 darkDirt = vec3(0.0, 0.0, 0.0);
            vec3 terrainColor = mix(darkDirt, dirtColor, terrainNoise + 0.5);
            terrainColor *= 0.8 + 0.9 * baseNoise;
            float shadow = calculateShadowPCF();
            
            vec3 finalColor = calculateLighting(terrainColor, normal, v_worldPos) * shadow;
            
            gl_FragColor = vec4(finalColor, 1.0);
            return;
        }
        
        // GRASS
        if (u_isGrass > 0.5) {
            float heightFactor = clamp((v_position.y + 1.0) * 0.5, 0.0, 1.0);
            
            vec3 grassBase = vec3(0.2, 0.5, 0.1);
            vec3 grassTip = vec3(0.4, 0.8, 0.2);
            vec3 grassColor = mix(grassBase, grassTip, heightFactor);
            
            // Wind variation
            float windVariation = sin(u_windTime + v_worldPos.x * 0.2) * 0.1 + 0.9;
            grassColor *= windVariation;
            
            // Subsurface scattering approximation
            vec3 sunDir = normalize(-u_lightDirection);
            vec3 viewDir = normalize(v_viewDirection);
            float facingBack = pow(1.0 - dot(normal, viewDir), 2.0);
            float backLight = max(0.0, dot(-normal, sunDir)) * 0.3;
            grassColor += vec3(0.3, 0.8, 0.1) * backLight * facingBack;
            
            float shadow = calculateShadowPCF();
            vec3 shadowTint = mix(vec3(0.6, 0.65, 0.7), vec3(1.0), shadow);
            // AO: attenua in base alla distanza dal suolo (altezza) + noise
            float groundProximity = clamp((v_worldPos.y + 1.0) * 0.5, 0.0, 1.0); // 0 in basso, 1 in alto
            float noiseAO = fbm(v_worldPos.xz * 1.5); // leggero pattern organico
            float ao = mix(0.7, 1.0, groundProximity); // più scuro in basso
            ao *= mix(0.85, 1.0, noiseAO); // variazioni pseudo-random

            vec3 finalColor = calculateLighting(grassColor, normal, v_worldPos) * shadow;

            finalColor *= shadowTint;
            finalColor *= ao; //
            gl_FragColor = vec4(finalColor, 1.0);
            return;
        }
        
        // CLOUDS
        if (u_isCloud > 0.5) {
            vec3 cloudColor = u_color;
            
            // Time-based cloud coloring
            if (u_timeOfDay < 0.25 || u_timeOfDay > 0.75) {
                cloudColor *= vec3(1.2, 0.8, 0.6);
            }
            
            vec3 finalColor = calculateLighting(cloudColor, normal, v_worldPos);
            gl_FragColor = vec4(finalColor, u_opacity);
            return;
        }
        
        // LIGHT SPHERE (Sun)
        if (u_isSphere > 0.5) {
            vec3 sunColor = getSunColor(u_timeOfDay);
            vec3 finalColor = sunColor * u_lightIntensity * 2.0;
            
            // Add corona effect
            float distFromCenter = length(v_position);
            float corona = 1.0 - smoothstep(0.8, 1.2, distFromCenter);
            finalColor += sunColor * corona * 0.5;
            
            gl_FragColor = vec4(finalColor, 1.0);
            return;
        }
        

        
        // GNOMON 
        if (u_isGnomon > 0.5) {

            vec3 bronzeBase = vec3(0.72, 0.45, 0.2);      // normal bronze
            vec3 bronzePolished = vec3(0.85, 0.65, 0.4);  // polished bronze
            vec3 bronzeOxidized = vec3(0.6, 0.35, 0.25);  // oxidation
            vec3 bronzeDark = vec3(0.3, 0.5, 0.6);        // cavity
            vec3 specularColor = vec3(0.5, 0.95, 0.8);    // solar ray reflection effects

            // Multi-layer noise 
            vec2 surfaceCoord = v_worldPos.xz * 3.0 + vec2(v_worldPos.y * 1.5);
            vec2 detailCoord = v_worldPos.xz * 12.0 + vec2(v_worldPos.y * 8.0);
            vec2 microCoord = v_worldPos.xz * 25.0;

    
            float oxidationPattern = fbm(surfaceCoord);
            oxidationPattern = smoothstep(0.35, 0.75, oxidationPattern);

            // Surface details (scratches, wear)
            float surfaceDetail = fbm(detailCoord);
            surfaceDetail = smoothstep(0.4, 0.6, surfaceDetail);

            // Micro-variations 
            float microTexture = fbm(microCoord);
            microTexture = smoothstep(0.45, 0.55, microTexture);

            // Wear simulation based on orientation (exposed parts more polished)
            vec3 N = normalize(v_normal);
            float exposureFactor = max(0.0, N.y); // Horizontal surfaces more exposed
            exposureFactor = pow(exposureFactor, 1.5);

            // Layered base color construction
            vec3 bronzeColor = bronzeBase;
    
            // Add oxidation 
            float oxidationMask = oxidationPattern * (1.0 - exposureFactor * 0.7);
            bronzeColor = mix(bronzeColor, bronzeOxidized, oxidationMask * 0.6);
    
            // Polished areas due to exposure and wear
            float polishMask = exposureFactor * surfaceDetail;
            bronzeColor = mix(bronzeColor, bronzePolished, polishMask * 0.8);
    
            // Darkening in recesses
            float cavityMask = (1.0 - exposureFactor) * (1.0 - microTexture);
            bronzeColor = mix(bronzeColor, bronzeDark, cavityMask * 0.4);

            // =====LIGHTING =====
            vec3 L = normalize(-u_lightDirection);
            vec3 V = normalize(v_viewDirection);
            vec3 R = reflect(-L, N);
            vec3 H = normalize(L + V); // Half vector for Blinn-Phong

            float NdotL = max(dot(N, L), 0.0);
            float NdotV = max(dot(N, V), 0.0);
            float NdotH = max(dot(N, H), 0.0);

            // Variable roughness based on oxidation and details
            float roughness = 0.15 + oxidationMask * 0.4 - polishMask * 0.3;
            roughness = clamp(roughness, 0.05, 0.8);

            // Specular with roughness control
            float shininess = mix(128.0, 8.0, roughness);
            float spec = pow(NdotH, shininess);

            // More accurate Fresnel (Schlick approximation)
            float F0 = 0.04; // Base reflectivity for metals
            float fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);

            // Rim lighting to give volume
            float rimLight = pow(1.0 - NdotV, 3.0) * max(0.0, dot(N, L));

            // Lighting components
            vec3 ambient = bronzeColor * getAmbientColor(u_timeOfDay) * 0.4;
            vec3 diffuse = bronzeColor * NdotL * 0.8;
            vec3 specular = specularColor * spec * fresnel * (1.0 - roughness);
            vec3 rim = specularColor * rimLight * 0.3;

            // Point light contribution
            vec3 pointLightDir = normalize(u_lightPosition - v_worldPos);
            float pointDistance = length(u_lightPosition - v_worldPos);
    
            if (pointDistance <= u_lightRadius) {
                float pointAttenuation = u_lightIntensity / (1.0 + 0.1 * pointDistance + 0.01 * pointDistance * pointDistance);
                float pointNdotL = max(0.0, dot(N, pointLightDir));
        
                // Warm point light contribution
                diffuse += bronzeColor * vec3(1.0, 0.85, 0.6) * pointNdotL * pointAttenuation * 0.5;
        
                // Point light specular
                vec3 pointReflect = reflect(-pointLightDir, N);
                float pointSpec = pow(max(dot(V, pointReflect), 0.0), shininess * 0.5);
                specular += vec3(1.0, 0.9, 0.7) * pointSpec * pointAttenuation * fresnel * 0.3;
            }

            float shadow = calculateShadowPCF();
    
            // Final combination with improved tone mapping
            vec3 finalColor = ambient + (diffuse + specular + rim) * shadow;
    
            // Subtle color grading for more convincing bronze
            finalColor *= vec3(1.02, 0.98, 0.95); // Slight warm tint
    
            // Soft gamma correction
            finalColor = pow(finalColor, vec3(1.0/2.1));
            finalColor = clamp(finalColor, 0.0, 1.0);

            gl_FragColor = vec4(finalColor, 1.0);
            return;
        }

        
        // HOUR LINES
        if (u_isHourLine > 0.5) {
            vec3 lineColor = vec3(0.95, 0.95, 0.9);     // Slightly warmer white
    
            // Add subtle time-based tinting
        if (u_timeOfDay < 0.25 || u_timeOfDay > 0.75) {
            lineColor *= vec3(1.0, 0.9, 0.8);       // Warmer during dawn/dusk
        }
    
        float shadow = calculateShadowPCF();
        shadow=mix(0.2, 1.0, shadow);
        vec3 finalColor = calculateLighting(lineColor, normal, v_worldPos) * shadow;
    
        gl_FragColor = vec4(finalColor, 1.0);
        return;
    }
        
        // DEFAULT MATERIAL
        float shadow = calculateShadowPCF();
        vec3 finalColor = calculateLighting(u_color, normal, v_worldPos) * shadow;
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

/**
 * Vertex shader for shadow mapping:
 * - Transforms vertex position into light's projection space
 * - Animates grass blades based on wind time if `u_isGrass` is enabled
 */
export const shadowVertexShaderSource = `
    precision mediump float;

    // Vertex attributes
    attribute vec3 a_position;

    // Uniform matrix for transforming world coordinates to light's clip space
    uniform mat4 u_lightViewProjectionMatrix;

    // Grass animation controls
    uniform float u_isGrass;    // Flag indicating whether current object is grass
    uniform float u_windTime;   // Global time value for wind animation

    void main() {
        vec3 pos = a_position;

        // Apply wind animation only to grass
        if (u_isGrass > 0.5) {
            // Normalize the height of the vertex to [0, 1]
            float heightFactor = (pos.y + 1.0) * 0.5;

            // Wind effect increases with height (top of blade bends more)
            float windStrength = heightFactor * heightFactor;

            // Simulate wind displacement using sine and cosine waves
            float windX = sin(u_windTime + pos.x * 0.3 + pos.z * 0.2) * 0.15;
            float windZ = cos(u_windTime * 0.8 + pos.x * 0.2 + pos.z * 0.3) * 0.1;

            // Add some randomness per blade using a fixed function
            float randomOffset = sin(pos.x * 12.34 + pos.z * 56.78) * 0.02;

            // Apply horizontal displacement to simulate bending
            pos.x += (windX + randomOffset) * windStrength;
            pos.z += (windZ + randomOffset * 0.5) * windStrength;
        }

        // Transform the vertex to shadow map space (light's POV)
        gl_Position = u_lightViewProjectionMatrix * vec4(pos, 1.0);
    }
`;

/**
 * Fragment shader for shadow mapping:
 * - Outputs only depth information encoded in red channel
 * - Used to compare depths during shadow calculation
 */
export const shadowFragmentShaderSource = `
    precision mediump float;
    
    void main() {
        gl_FragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0);
    }
`;

/**
 * Fragment shader for shadow mapping:
 * - Outputs only depth information encoded in red channel
 * - Used to compare depths during shadow calculation
 */
export const skyVertexShaderSource = `
    precision mediump float;
    attribute vec3 a_position;
    uniform mat4 u_modelViewProjectionMatrix;
    uniform mat4 u_modelMatrix;
    uniform vec3 u_cameraPosition;
    
    varying vec3 v_position;
    varying vec3 v_worldPos;
    varying vec3 v_viewDirection;
    
    void main() {
        v_position = a_position;
        v_worldPos = (u_modelMatrix * vec4(a_position, 1.0)).xyz;
        v_viewDirection = normalize(v_worldPos - u_cameraPosition);
        
        gl_Position = u_modelViewProjectionMatrix * vec4(a_position, 1.0);
    }
`;
/**
 * Fragment shader for sky dome:
 * - Computes sky color based on time of day and viewing angle
 * - Renders the sun with halo and disc effects
 * - Adds dynamic procedural clouds with noise and FBM
 */
export const skyFragmentShaderSource = `
    precision mediump float;

    // Inputs from the vertex shader
    varying vec3 v_position;
    varying vec3 v_worldPos;
    varying vec3 v_viewDirection;

    // Uniforms for lighting and time
    uniform vec3 u_lightDirection; // Direction of the sun
    uniform float u_time;          // Time (used for cloud movement)
    uniform float u_timeOfDay;     // Normalized time of day [0.0–1.0]

    // === Utility noise functions ===

    // Hash function used for pseudo-random generation
    float hash21(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
    }

    // 2D value noise
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        return mix(
            mix(hash21(i + vec2(0,0)), hash21(i + vec2(1,0)), f.x),
            mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x),
            f.y
        );
    }

    // Fractal Brownian Motion: layered noise for more natural patterns
    float fbm(vec2 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;

        for (int i = 0; i < 6; i++) {
            if (i >= octaves) break;
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
        }

        return value;
    }

    // Computes a vertical gradient based on elevation and time of day
    vec3 getSkyGradient(float elevation, float timeOfDay) {
        vec3 zenith, horizon;

        // Adjust sky colors based on time of day
        if (timeOfDay < 0.2) {
            // Night
            zenith = vec3(0.02, 0.03, 0.15);
            horizon = vec3(0.1, 0.1, 0.2);
        } else if (timeOfDay < 0.3) {
            // Dawn
            zenith = vec3(0.6, 0.4, 0.8);
            horizon = vec3(1.0, 0.6, 0.3);
        } else if (timeOfDay < 0.7) {
            // Daytime
            zenith = vec3(0.3, 0.6, 1.0);
            horizon = vec3(0.7, 0.9, 1.0);
        } else if (timeOfDay < 0.8) {
            // Dusk
            zenith = vec3(0.8, 0.4, 0.6);
            horizon = vec3(1.0, 0.5, 0.2);
        } else {
            // Night again
            zenith = vec3(0.02, 0.03, 0.15);
            horizon = vec3(0.1, 0.1, 0.2);
        }

        float t = pow(max(0.0, elevation), 0.7);
        return mix(horizon, zenith, t); // Interpolate based on elevation
    }

    void main() {
        vec3 viewDir = normalize(v_viewDirection);     // Direction camera is facing
        vec3 lightDir = normalize(-u_lightDirection);  // Sunlight direction (reversed)

        float elevation = max(0.0, viewDir.y);         // Vertical component of view direction
        vec3 skyColor = getSkyGradient(elevation, u_timeOfDay); // Initial gradient background

        // === SUN RENDERING ===
        float sunDistance = length(viewDir - lightDir); // Angular distance between sun and view

        if (lightDir.y > -0.1) {
            // Render sun disc
            if (sunDistance < 0.025) {
                vec3 sunColor = vec3(1.0, 0.9, 0.7); // Default bright sun
                if (u_timeOfDay < 0.3 || u_timeOfDay > 0.7) {
                    sunColor = vec3(1.0, 0.6, 0.3); // Warmer color at dawn/dusk
                }

                float sunIntensity = 1.0 - smoothstep(0.0, 0.025, sunDistance);
                skyColor = mix(skyColor, sunColor * 3.0, sunIntensity); // Blend sun into sky
            }
            // Sun halo
            else if (sunDistance < 0.15) {
                vec3 haloColor = vec3(1.0, 0.8, 0.6);
                float haloIntensity = pow(1.0 - (sunDistance / 0.15), 2.0) * 0.6;
                skyColor = mix(skyColor, haloColor, haloIntensity);
            }
        }

        // === CLOUDS ===
        if (elevation > 0.05) {
            // Project direction into 2D space for cloud sampling
            vec2 cloudUV = vec2(
                atan(viewDir.x, viewDir.z) / 6.28318,   // Azimuth (normalized)
                acos(elevation) / 3.14159               // Altitude (normalized)
            ) * 3.0;

            // Move clouds over time
            cloudUV += u_time * 0.002;

            float cloudDensity = fbm(cloudUV, 4); // Generate FBM noise
            cloudDensity = smoothstep(0.35, 0.75, cloudDensity); // Threshold to enhance contrast

            // Select cloud color based on time of day
            vec3 cloudColor;
            if (u_timeOfDay < 0.3 || u_timeOfDay > 0.7) {
                cloudColor = vec3(0.8, 0.4, 0.3); // Warmer clouds for dawn/dusk
            } else {
                cloudColor = vec3(0.95, 0.95, 1.0); // Bright clouds during the day
            }

            // Clouds are brighter when facing the sun
            float cloudLight = max(0.3, dot(viewDir, lightDir));
            cloudColor *= cloudLight;

            // Mix cloud color into the sky
            skyColor = mix(skyColor, cloudColor, cloudDensity * 0.8);
        }

        // Final output color
        gl_FragColor = vec4(skyColor, 1.0);
    }
`;
