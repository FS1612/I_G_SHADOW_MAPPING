/**
 * Vertex shader:
 * - Transforms vertex positions into screen space.
 * - Computes normals and world positions for lighting.
 * - Passes texture coordinates and light direction.
 * - Computes coordinates for shadow mapping.
 */
export const vertexShaderSource = `
    precision mediump float;
    attribute vec3 a_position;
    attribute vec3 a_normal;
    attribute vec2 a_texCoord;
    
    uniform mat4 u_modelViewProjectionMatrix;
    uniform mat4 u_modelMatrix;
    uniform mat4 u_normalMatrix;
    uniform mat4 u_lightViewProjectionMatrix;
    uniform vec3 u_lightPosition;  // Posizione della sfera luminosa
    uniform vec3 u_lightDirection; // Manteniamo per compatibilità
    
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec2 v_texCoord;
    varying vec3 v_lightDirection;
    varying vec3 v_worldPos;
    varying vec4 v_shadowCoord;
    varying vec3 v_lightPosition;  // Passa la posizione della luce al fragment shader
    
    void main() {
        gl_Position = u_modelViewProjectionMatrix * vec4(a_position, 1.0);
        v_worldPos = (u_modelMatrix * vec4(a_position, 1.0)).xyz;
        v_position = a_position;
        v_normal = normalize((u_normalMatrix * vec4(a_normal, 0.0)).xyz);
        v_texCoord = a_texCoord;
        v_lightDirection = normalize(u_lightDirection);
        v_lightPosition = u_lightPosition;
        
        // Calcola coordinate shadow map
        v_shadowCoord = u_lightViewProjectionMatrix * vec4(a_position, 1.0);
    }
`;
/**
 * Fragment shader:
 * - Applies lighting and shading based on object type.
 * - Implements shadow mapping using Percentage Closer Filtering (PCF).
 * - Simulates bronze and procedural grass materials.
 */
// Fragment shader migliorato per erba più realistica
export const fragmentShaderSource = `
    precision mediump float;
    uniform float u_isCloud;
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec2 v_texCoord;
    varying vec3 v_lightDirection;
    varying vec3 v_worldPos;
    varying vec4 v_shadowCoord;
    varying vec3 v_lightPosition;
uniform float u_opacity;
    uniform vec3 u_color;
    uniform float u_isGround;
    uniform float u_isGnomon;
    uniform float u_isHourLine;
    uniform float u_isSphere;        // Nuovo: identifica la sfera
    uniform float u_enableShadows;
    uniform vec3 u_lightDirection;
    uniform vec3 u_lightPosition;
    uniform float u_lightIntensity;   // Intensità della luce
    uniform float u_lightRadius;     // Raggio di influenza della luce
    uniform sampler2D u_shadowMap;

    float sampleShadowMap(vec4 shadowCoord) {
        vec3 shadowCoordNorm = shadowCoord.xyz / shadowCoord.w;
        shadowCoordNorm = shadowCoordNorm * 0.5 + 0.5;
        
        if (shadowCoordNorm.x < 0.0 || shadowCoordNorm.x > 1.0 ||
            shadowCoordNorm.y < 0.0 || shadowCoordNorm.y > 1.0 ||
            shadowCoordNorm.z < 0.0 || shadowCoordNorm.z > 1.0) {
            return 1.0;
        }
        
        float shadowDepth = texture2D(u_shadowMap, shadowCoordNorm.xy).r;
        float currentDepth = shadowCoordNorm.z;
        
        vec3 lightDir = normalize(u_lightPosition - v_worldPos);
        vec3 normal = normalize(v_normal);
        float bias = max(0.005 * (1.0 - dot(normal, lightDir)), 0.001);
        
        float shadow = 0.0;
        vec2 texelSize = 1.0 / vec2(2048.0);
        
        for(int x = -1; x <= 1; ++x) {
            for(int y = -1; y <= 1; ++y) {
                float pcfDepth = texture2D(u_shadowMap, shadowCoordNorm.xy + vec2(x, y) * texelSize).r;
                shadow += currentDepth - bias > pcfDepth ? 0.0 : 1.0;
            }
        }
        shadow /= 9.0;
        
        return mix(0.3, 1.0, shadow);
    }

    // Funzione per generare rumore più dettagliato
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        
        vec2 u = f * f * (3.0 - 2.0 * f);
        
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
        vec3 color = u_color;
        
        // Calcola l'illuminazione da point light (sfera)
        vec3 lightDir = normalize(u_lightPosition - v_worldPos);
        float distance = length(u_lightPosition - v_worldPos);
        
        // Attenuazione basata sulla distanza
        float attenuation = 1.0 / (1.0 + 0.1 * distance + 0.01 * distance * distance);
        attenuation *= u_lightIntensity;
        
        // Se la distanza è maggiore del raggio, nessuna illuminazione
        if (distance > u_lightRadius) {
            attenuation = 0.0;
        }
        
        float light = max(0.0, dot(v_normal, lightDir)) * attenuation;
        
        float shadow = 1.0;
        if (u_enableShadows > 0.5) {
            shadow = sampleShadowMap(v_shadowCoord);
        }
        if (u_isCloud > 0.5) {
    vec3 ambient = vec3(0.1, 0.1, 0.1);
    color = color * light * shadow + color * ambient;
    gl_FragColor = vec4(color, u_opacity);

    return;
}
        // Sfera luminosa: emette luce propria
        if (u_isSphere > 0.5) {
            // La sfera emette luce e non riceve ombre
            vec3 glowColor = vec3(1.0, 0.9, 0.7); // Colore caldo come il sole
            color = glowColor * u_lightIntensity;
            
            // Effetto glow più intenso al centro
            vec3 center = vec3(0.0, 0.0, 0.0); // Centro locale della sfera
            float distFromCenter = length(v_position - center);
            float glow = 1.0 - smoothstep(0.0, 1.0, distFromCenter);
            color += glowColor * glow * 0.5;
            
            gl_FragColor = vec4(color, 1.0);
            return;
        }
        
        if (u_isGround > 0.5) {
            // Migliora la qualità del terreno con rumore stratificato
            vec2 pos = v_worldPos.xz;
            
            float noise1 = noise(pos * 0.5) * 0.6;
            float noise2 = noise(pos * 2.0) * 0.3;
            float noise3 = noise(pos * 8.0) * 0.1;
            float grassVariation = noise1 + noise2 + noise3;
            
            vec3 grassColor1 = vec3(0.15, 0.4, 0.1);
            vec3 grassColor2 = vec3(0.25, 0.6, 0.2);
            vec3 grassColor3 = vec3(0.3, 0.7, 0.25);
            vec3 dirtColor = vec3(0.4, 0.3, 0.2);
            
            color = mix(grassColor1, grassColor2, smoothstep(0.3, 0.7, grassVariation));
            color = mix(color, grassColor3, smoothstep(0.6, 0.9, grassVariation));
            
            float dirtNoise = noise(pos * 1.5 + vec2(100.0, 200.0));
            if (dirtNoise > 0.7) {
                color = mix(color, dirtColor, (dirtNoise - 0.7) * 2.0);
            }
        }
        
        if (u_isGnomon > 0.5) {
            float metallic = sin(v_position.y * 25.0) * 0.15 + 0.85;
            vec3 bronzeBase = vec3(0.8, 0.6, 0.2);
            vec3 bronzeHighlight = vec3(0.9, 0.75, 0.3);
            color = mix(bronzeBase, bronzeHighlight, metallic);
        }
        
        if (u_isHourLine > 0.5) {
            color = vec3(0.9, 0.9, 0.8);
        }
        
        // Illuminazione ambiente ridotta per enfatizzare la point light
        vec3 ambient = vec3(0.1, 0.1, 0.15); // Ambiente più scuro
        color = color * light * shadow + color * ambient;
        
        gl_FragColor = vec4(color, 1.0);
    }
`;
/**
 * Shadow map vertex shader:
 * - Projects geometry into light's view to generate a depth texture.
 */
export const shadowVertexShaderSource = `
    precision mediump float;
    attribute vec3 a_position; // Object vertex position
    uniform mat4 u_lightViewProjectionMatrix; // Light's view-projection matrix
    
    void main() {
        gl_Position = u_lightViewProjectionMatrix * vec4(a_position, 1.0);
    }
`;

/**
 * Shadow map fragment shader:
 * - Outputs depth to red channel (used as a shadow map).
 */
export const shadowFragmentShaderSource = `
    precision mediump float;
    
    void main() {
        gl_FragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0); // Encodes depth only
    }
`;
// Sky dome vertex shader
export const skyVertexShaderSource = `
    precision mediump float;
    attribute vec3 a_position;
    uniform mat4 u_modelViewProjectionMatrix;
    varying vec3 v_position;
    
    void main() {
        v_position = a_position;
        gl_Position = u_modelViewProjectionMatrix * vec4(a_position, 1.0);
    }
`;

// Sky dome fragment shader
// Sky dome fragment shader migliorato per nuvole più visibili
export const skyFragmentShaderSource = `
    precision mediump float;
    varying vec3 v_position;
    uniform vec3 u_lightDirection;
    uniform float u_time;
    
    // Funzione di noise per le nuvole
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        
        vec2 u = f * f * (3.0 - 2.0 * f);
        
        return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    
    void main() {
        vec3 viewDir = normalize(v_position);
        vec3 lightDir = normalize(-u_lightDirection);
        
        float skyHeight = max(0.0, viewDir.y);
        float timeOfDay = clamp((lightDir.y + 0.3) * 1.2, 0.0, 1.0);
        
        // Colori del cielo più dinamici
        vec3 nightSky = vec3(0.02, 0.03, 0.15);
        vec3 dawnSky = vec3(1.0, 0.6, 0.3);
        vec3 daySky = vec3(0.4, 0.7, 1.0);
        vec3 sunsetSky = vec3(1.0, 0.4, 0.2);
        
        vec3 skyColor;
        if (timeOfDay < 0.2) {
            skyColor = mix(nightSky, dawnSky, timeOfDay / 0.2);
        } else if (timeOfDay < 0.8) {
            skyColor = mix(dawnSky, daySky, (timeOfDay - 0.2) / 0.6);
        } else {
            skyColor = mix(daySky, sunsetSky, (timeOfDay - 0.8) / 0.2);
        }
        
        // Gradiente verticale più naturale
        skyColor = mix(skyColor * 0.6, skyColor, pow(skyHeight, 0.7));
        
        // SOLE COME SORGENTE LUMINOSA (NON ILLUMINATO)
        float sunDistance = distance(viewDir, lightDir);
        float sunSize = 0.03; // Dimensione del sole
        float sunGlow = 0.15;  // Alone del sole
        
        // Disco solare - EMISSIVO, non illuminato
        if (sunDistance < sunSize && lightDir.y > -0.1) {
            // Il sole emette luce propria, colore più intenso
            vec3 sunColor = vec3(1.0, 0.9, 0.7) * 2.0; // Intensità aumentata
            float sunIntensity = 1.0 - (sunDistance / sunSize);
            sunIntensity = pow(sunIntensity, 0.5); // Bordi più morbidi
            skyColor = mix(skyColor, sunColor, sunIntensity);
        }
        
        // Alone del sole più pronunciato
        else if (sunDistance < sunGlow && lightDir.y > -0.1) {
            vec3 glowColor = vec3(1.0, 0.8, 0.6) * 1.5;
            float glowIntensity = pow(1.0 - (sunDistance / sunGlow), 2.0) * 0.8;
            skyColor = mix(skyColor, glowColor, glowIntensity);
        }
        
        // NUVOLE PROCEDURALI MIGLIORATE
        // Usa coordinate sferiche più stabili invece di divisione per viewDir.y
        vec2 cloudCoord = vec2(
            atan(viewDir.x, viewDir.z) / 6.28318, // angolo orizzontale normalizzato
            acos(max(viewDir.y, 0.0)) / 3.14159   // angolo verticale normalizzato
        );
        
        // Scala le coordinate e aggiungi movimento più visibile
        cloudCoord = cloudCoord * 4.0 + u_time * 0.0001; // Movimento più veloce
        
        float cloudNoise = 0.0;
        
        // Nuvole multistrato con pesi ottimizzati
        cloudNoise += noise(cloudCoord * 1.5) * 0.5;    // Layer principale
        cloudNoise += noise(cloudCoord * 3.0) * 0.3;    // Dettagli medi
        cloudNoise += noise(cloudCoord * 8.0) * 0.2;    // Dettagli fini
        
        // Soglia ancora più bassa per nuvole più visibili
        cloudNoise = smoothstep(0.15, 0.55, cloudNoise); // Soglia ridotta ulteriormente
        
        // Colore delle nuvole con MAGGIORE CONTRASTO
        vec3 cloudColorBase, cloudColorHigh;
        
        if (timeOfDay < 0.3) {
            // Notte/Alba - nuvole più scure per contrasto
            cloudColorBase = vec3(0.2, 0.2, 0.3);
            cloudColorHigh = vec3(0.4, 0.4, 0.5);
        } else if (timeOfDay < 0.7) {
            // Giorno - nuvole bianche brillanti
            cloudColorBase = vec3(0.9, 0.9, 0.95);
            cloudColorHigh = vec3(1.2, 1.2, 1.2); // Sovra-esposto per contrasto
        } else {
            // Tramonto - nuvole colorate
            cloudColorBase = vec3(0.8, 0.4, 0.3);
            cloudColorHigh = vec3(1.0, 0.7, 0.5);
        }
        
        vec3 cloudColor = mix(cloudColorBase, cloudColorHigh, cloudNoise);

        
        // Ombreggiatura meno aggressiva per mantenere visibilità
        float cloudShadow = mix(0.6, 1.0, timeOfDay); // Era 0.3, ora 0.6
        cloudColor *= cloudShadow;
        
        // Maschera per l'altezza meno restrittiva
        float heightMask = smoothstep(-0.1, 0.6, skyHeight); // Permette nuvole anche verso l'orizzonte
        cloudNoise = smoothstep(0.12, 0.5, cloudNoise);

        
        // Applica le nuvole con intensità aumentata
        skyColor = mix(skyColor, cloudColor, cloudNoise * 0.9); // Intensità aumentata
        
        gl_FragColor = vec4(skyColor, 1.0);
    }
`;