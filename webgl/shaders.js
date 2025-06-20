/**
 * Vertex shader migliorato:
 * - Transforms vertex positions into screen space
 * - Computes normals and world positions for lighting
 * - Passes texture coordinates and light direction
 * - Computes coordinates for shadow mapping
 * - Implements grass wind animation
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
 * Fragment shader migliorato:
 * - Improved atmospheric lighting system
 * - Better shadow mapping with PCF
 * - Realistic material shading
 * - Time-based color transitions
 * - Optimized noise functions
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
    
    vec2 texelSize = vec2(1.0 / 2048.0, 1.0 / 2048.0);
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
            float terrainNoise = fbm(terrainCoord * 4.0) * 0.3;
            terrainNoise += fbm(terrainCoord * 16.0) * 0.1;
            
            vec3 dirtColor = vec3(0.4, 0.3, 0.2);
            vec3 darkDirt = vec3(0.2, 0.15, 0.1);
            vec3 terrainColor = mix(darkDirt, dirtColor, terrainNoise + 0.5);
            terrainColor *= 0.6 + 0.4 * baseNoise;
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
        
        // GNOMON (Bronze material)
          if (u_isGnomon > 0.5) {
    // Base bronzo scuro e riflessi
    vec3 bronzeBase = vec3(0.25, 0.18, 0.09);
    vec3 bronzeHighlight = vec3(0.5, 0.35, 0.2);

    // Noise per variazione superficiale
    float roughPattern = fbm(v_worldPos.xz * 3.0 + v_worldPos.yz * 2.0);
    vec3 bronzeColor = mix(bronzeBase, bronzeHighlight, roughPattern * 0.6);

    // ===== LINEE INCISIONE (tipo decorazione o giunzione saldata) =====
    float freq = 0.12;        // distanza tra "blocchi"
    float width = 0.006;      // spessore linea
    float hLine = smoothstep(freq - width, freq, fract(v_worldPos.y / freq));
    hLine *= smoothstep(0.0, width, 1.0 - fract(v_worldPos.y / freq));

    float vLine = smoothstep(freq - width, freq, fract(v_worldPos.x / freq));
    vLine *= smoothstep(0.0, width, 1.0 - fract(v_worldPos.x / freq));

    float grid = min(hLine, vLine);  

    vec3 grooveColor = vec3(1.0); // colore delle incisioni (bianco o chiaro)
    bronzeColor = mix(grooveColor, bronzeColor, grid);
    // ====================================================================

    // Normali e luce
    vec3 N = normalize(v_normal);
    vec3 L = normalize(-u_lightDirection);
    vec3 V = normalize(v_viewDirection);
    vec3 R = reflect(-L, N);

    float NdotL = max(dot(N, L), 0.0);
    float spec = pow(max(dot(V, R), 0.0), 24.0);

    vec3 specular = bronzeHighlight * spec * 0.5;
    vec3 ambient = bronzeBase * getAmbientColor(u_timeOfDay) * 0.4;

    float shadow = calculateShadowPCF();
    shadow = mix(0.3, 1.0, shadow);
    
    vec3 finalColor = (ambient + bronzeColor * NdotL + specular) ;
    finalColor = clamp(finalColor, 0.0, 0.95);

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
 * Shadow mapping shaders (unchanged - already optimal)
 */
export const shadowVertexShaderSource = `
    precision mediump float;

// Attributi
attribute vec3 a_position;

// Uniform per proiezione
uniform mat4 u_lightViewProjectionMatrix;

// Uniform per erba animata
uniform float u_isGrass;
uniform float u_windTime;

void main() {
    vec3 pos = a_position;

    // Applica animazione vento solo se è erba
    if (u_isGrass > 0.5) {
        float heightFactor = (pos.y + 1.0) * 0.5; // Range 0–1
        float windStrength = heightFactor * heightFactor;

        float windX = sin(u_windTime + pos.x * 0.3 + pos.z * 0.2) * 0.15;
        float windZ = cos(u_windTime * 0.8 + pos.x * 0.2 + pos.z * 0.3) * 0.1;
        float randomOffset = sin(pos.x * 12.34 + pos.z * 56.78) * 0.02;

        pos.x += (windX + randomOffset) * windStrength;
        pos.z += (windZ + randomOffset * 0.5) * windStrength;
    }

    gl_Position = u_lightViewProjectionMatrix * vec4(pos, 1.0);
}
`;

export const shadowFragmentShaderSource = `
    precision mediump float;
    
    void main() {
        gl_FragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0);
    }
`;

/**
 * Sky dome shaders migliorati
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

export const skyFragmentShaderSource = `
    precision mediump float;
    
    varying vec3 v_position;
    varying vec3 v_worldPos;
    varying vec3 v_viewDirection;
    
    uniform vec3 u_lightDirection;
    uniform float u_time;
    uniform float u_timeOfDay;
    
    // Optimized noise functions
    float hash21(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
    }
    
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
    
    vec3 getSkyGradient(float elevation, float timeOfDay) {
        vec3 zenith, horizon;
        
        // Time-based sky colors
        if (timeOfDay < 0.2) {
            zenith = vec3(0.02, 0.03, 0.15);
            horizon = vec3(0.1, 0.1, 0.2);
        } else if (timeOfDay < 0.3) {
            zenith = vec3(0.6, 0.4, 0.8);
            horizon = vec3(1.0, 0.6, 0.3);
        } else if (timeOfDay < 0.7) {
            zenith = vec3(0.3, 0.6, 1.0);
            horizon = vec3(0.7, 0.9, 1.0);
        } else if (timeOfDay < 0.8) {
            zenith = vec3(0.8, 0.4, 0.6);
            horizon = vec3(1.0, 0.5, 0.2);
        } else {
            zenith = vec3(0.02, 0.03, 0.15);
            horizon = vec3(0.1, 0.1, 0.2);
        }
        
        float t = pow(max(0.0, elevation), 0.7);
        return mix(horizon, zenith, t);
    }
    
    void main() {
        vec3 viewDir = normalize(v_viewDirection);
        vec3 lightDir = normalize(-u_lightDirection);
        
        float elevation = max(0.0, viewDir.y);
        vec3 skyColor = getSkyGradient(elevation, u_timeOfDay);
        
        // Enhanced sun rendering
        float sunDistance = length(viewDir - lightDir);
        
        if (lightDir.y > -0.1) {
            // Sun disc
            if (sunDistance < 0.025) {
                vec3 sunColor = vec3(1.0, 0.9, 0.7);
                if (u_timeOfDay < 0.3 || u_timeOfDay > 0.7) {
                    sunColor = vec3(1.0, 0.6, 0.3);
                }
                
                float sunIntensity = 1.0 - smoothstep(0.0, 0.025, sunDistance);
                skyColor = mix(skyColor, sunColor * 3.0, sunIntensity);
            }
            // Sun halo
            else if (sunDistance < 0.15) {
                vec3 haloColor = vec3(1.0, 0.8, 0.6);
                float haloIntensity = pow(1.0 - (sunDistance / 0.15), 2.0) * 0.6;
                skyColor = mix(skyColor, haloColor, haloIntensity);
            }
        }
        
        // Improved cloud system
        if (elevation > 0.05) {
            vec2 cloudUV = vec2(
                atan(viewDir.x, viewDir.z) / 6.28318,
                acos(elevation) / 3.14159
            ) * 3.0;
            
            cloudUV += u_time * 0.002;
            
            float cloudDensity = fbm(cloudUV, 4);
            cloudDensity = smoothstep(0.35, 0.75, cloudDensity);
            
            // Cloud colors based on time
            vec3 cloudColor;
            if (u_timeOfDay < 0.3 || u_timeOfDay > 0.7) {
                cloudColor = vec3(0.8, 0.4, 0.3); // Dawn/dusk
            } else {
                cloudColor = vec3(0.95, 0.95, 1.0); // Day
            }
            
            // Cloud lighting
            float cloudLight = max(0.3, dot(viewDir, lightDir));
            cloudColor *= cloudLight;
            
            skyColor = mix(skyColor, cloudColor, cloudDensity * 0.8);
        }
        
        gl_FragColor = vec4(skyColor, 1.0);
    }
`;