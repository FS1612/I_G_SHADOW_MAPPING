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
        uniform float u_isGrass;
uniform float u_windTime;
uniform float u_realTime;
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec2 v_texCoord;
    varying vec3 v_lightDirection;
    varying vec3 v_worldPos;
    varying vec4 v_shadowCoord;
    varying vec3 v_lightPosition;  // Passa la posizione della luce al fragment shader
    
    void main() {


        vec3 pos = a_position;

// Oscillazione solo per l'erba

gl_Position = u_modelViewProjectionMatrix * vec4(pos, 1.0);
        v_worldPos = (u_modelMatrix * vec4(pos, 1.0)).xyz;

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
// Fragment shader semplificato per debug
export const fragmentShaderSource = `
    precision mediump float;
    
    // Uniforms esistenti
    uniform float u_isGrass;
    uniform float u_windTime;
    uniform float u_isCloud;
    uniform float u_opacity;
    uniform vec3 u_color;
    uniform float u_isGround;
    uniform float u_isGnomon;
    uniform float u_isHourLine;
    uniform float u_isSphere;
    uniform float u_enableShadows;
    uniform vec3 u_lightDirection;
    uniform vec3 u_lightPosition;
    uniform float u_lightIntensity;
    uniform float u_lightRadius;
    uniform sampler2D u_shadowMap;
    uniform float u_realTime;
    
    // Nuove uniforms per il sistema atmosferico
    uniform float u_isSky;
    uniform float u_sunElevation;    // Elevazione del sole (0-90 gradi)
    uniform float u_sunAzimuth;      // Azimuth del sole (0-360 gradi)
    uniform float u_timeOfDay;       // 0.0 = mezzanotte, 0.5 = mezzogiorno, 1.0 = mezzanotte
    uniform vec3 u_cameraPosition;
    uniform vec3 u_cameraDirection;
    
    // Varyings
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec2 v_texCoord;
    varying vec3 v_lightDirection;
    varying vec3 v_worldPos;
    varying vec4 v_shadowCoord;
    varying vec3 v_lightPosition;
    varying vec3 v_viewDirection;    // Aggiungere al vertex shader
    
    // Funzioni utili
    float random(vec2 co) {
        return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    // Funzione per calcolare il colore del cielo in base al tempo
    vec3 getSkyColor(vec3 rayDir, vec3 sunDir, float timeOfDay) {
        float sunDot = dot(rayDir, sunDir);
        float elevation = sunDir.y;
        
        // Colori base del cielo per diversi momenti
        vec3 dayColor = vec3(0.4, 0.7, 1.0);        // Blu cielo diurno
        vec3 sunsetColor = vec3(1.0, 0.6, 0.3);     // Arancione tramonto
        vec3 nightColor = vec3(0.05, 0.05, 0.2);    // Blu notte
        vec3 dawnColor = vec3(0.8, 0.5, 0.7);       // Rosa alba
        
        // Calcola il colore base in base al tempo
        vec3 baseColor;
        if (timeOfDay < 0.2) { // Notte -> Alba
            float t = timeOfDay / 0.2;
            baseColor = mix(nightColor, dawnColor, t);
        } else if (timeOfDay < 0.3) { // Alba -> Giorno
            float t = (timeOfDay - 0.2) / 0.1;
            baseColor = mix(dawnColor, dayColor, t);
        } else if (timeOfDay < 0.7) { // Giorno
            baseColor = dayColor;
        } else if (timeOfDay < 0.8) { // Giorno -> Tramonto
            float t = (timeOfDay - 0.7) / 0.1;
            baseColor = mix(dayColor, sunsetColor, t);
        } else { // Tramonto -> Notte
            float t = (timeOfDay - 0.8) / 0.2;
            baseColor = mix(sunsetColor, nightColor, t);
        }
        
        // Effetto alone solare
        float sunGlow = max(0.0, sunDot);
        sunGlow = pow(sunGlow, 8.0);
        
        // Colore del sole
        vec3 sunColor = vec3(1.0, 0.9, 0.7);
        if (timeOfDay > 0.7 || timeOfDay < 0.3) {
            sunColor = vec3(1.0, 0.4, 0.2); // Sole rosso all'alba/tramonto
        }
        
        // Mescola colore base con alone solare
        vec3 finalColor = baseColor + sunColor * sunGlow * 0.5;
        
        // Effetto atmosferico (scattering)
        float horizon = abs(rayDir.y);
        finalColor = mix(finalColor, vec3(0.8, 0.8, 0.6), pow(1.0 - horizon, 2.0) * 0.3);
        
        return finalColor;
    }
    
    // Funzione per i raggi solari (god rays)
    float getGodRays(vec3 rayDir, vec3 sunDir, vec3 worldPos) {
        float sunDot = max(0.0, dot(rayDir, sunDir));
        
        // Crea raggi usando il noise
        vec2 rayCoord = worldPos.xz * 0.01 + u_realTime * 0.1;
        float rayNoise = noise(rayCoord) * 0.5 + noise(rayCoord * 2.0) * 0.25;
        
        // Intensità dei raggi basata sulla vicinanza al sole
        float rayIntensity = pow(sunDot, 16.0);
        
        // Modulazione temporale per movimento
        float timeVar = sin(u_realTime * 0.5) * 0.1 + 0.9;
        
        return rayIntensity * rayNoise * timeVar;
    }
    
    // Funzione per l'illuminazione atmosferica
    vec3 getAtmosphericLight(vec3 baseColor, vec3 normal, vec3 worldPos, float timeOfDay) {
        // Luce direzionale del sole
        vec3 sunDir = normalize(-u_lightDirection);
        float sunLight = max(0.0, dot(normal, sunDir));
        
        // Colore della luce solare varia con il tempo
        vec3 sunLightColor;
        if (timeOfDay < 0.2 || timeOfDay > 0.8) {
            sunLightColor = vec3(0.3, 0.3, 0.6); // Luce notturna (luna)
        } else if (timeOfDay < 0.3 || timeOfDay > 0.7) {
            sunLightColor = vec3(1.0, 0.6, 0.3); // Luce alba/tramonto
        } else {
            sunLightColor = vec3(1.0, 0.95, 0.8); // Luce diurna
        }
        
        // Luce ambiente atmosferica
        vec3 ambientColor;
        if (timeOfDay < 0.2 || timeOfDay > 0.8) {
            ambientColor = vec3(0.05, 0.05, 0.15); // Ambiente notturno
        } else {
            ambientColor = vec3(0.15, 0.15, 0.2); // Ambiente diurno
        }
        
        // Point light esistente
        vec3 pointLightDir = normalize(u_lightPosition - worldPos);
        float distance = length(u_lightPosition - worldPos);
        float attenuation = 1.0;
        if (distance <= u_lightRadius) {
            attenuation = 1.0 / (1.0 + 0.1 * distance + 0.01 * distance * distance);
            attenuation *= u_lightIntensity;
        } else {
            attenuation = 0.0;
        }
        float pointLight = max(0.0, dot(normal, pointLightDir)) * attenuation;
        
        return baseColor * ambientColor + 
               baseColor * sunLight * sunLightColor * 0.8 + 
               baseColor * pointLight * vec3(1.0, 0.9, 0.7);
    }
    
    float calculateShadow() {
        if (u_enableShadows < 0.5) {
            return 1.0;
        }
        
        vec3 projCoords = v_shadowCoord.xyz / v_shadowCoord.w;
        projCoords = projCoords * 0.5 + 0.5;
        
        if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 || 
            projCoords.y < 0.0 || projCoords.y > 1.0) {
            return 1.0;
        }
        
        float closestDepth = texture2D(u_shadowMap, projCoords.xy).r;
        float currentDepth = projCoords.z;
        float bias = 0.005;
        
        return currentDepth - bias > closestDepth ? 0.3 : 1.0;
    }
    
    void main() {
        vec3 normal = normalize(v_normal);
        vec3 sunDir = normalize(-u_lightDirection);
        
        // CIELO
        if (u_isSky > 0.5) {
            vec3 rayDir = normalize(v_worldPos - u_cameraPosition);
            vec3 skyColor = getSkyColor(rayDir, sunDir, u_timeOfDay);
            
            // Aggiungi raggi solari
            float godRays = getGodRays(rayDir, sunDir, v_worldPos);
            skyColor += vec3(1.0, 0.9, 0.7) * godRays * 0.3;
            
            // Aggiungi stelle di notte
            if (u_timeOfDay < 0.2 || u_timeOfDay > 0.8) {
                vec2 starCoord = rayDir.xz * 50.0;
                float stars = 0.0;
                for (int i = 0; i < 3; i++) {
                    float starNoise = random(floor(starCoord + float(i) * 17.0));
                    if (starNoise > 0.99) {
                        stars += (starNoise - 0.99) * 100.0;
                    }
                    starCoord *= 2.0;
                }
                skyColor += vec3(1.0, 1.0, 0.9) * stars * 0.5;
            }
            
            gl_FragColor = vec4(skyColor, 1.0);
            return;
        }
        
        // TERRENO
        if (u_isGround > 0.5) {
            vec2 soilCoord = v_worldPos.xz * 0.5;
            float soilNoise = noise(soilCoord * 8.0) * 0.1;
            float soilDetail = noise(soilCoord * 32.0) * 0.05;
            
            vec3 soilBase = vec3(0.4, 0.3, 0.2);
            vec3 soilDark = vec3(0.3, 0.2, 0.15);
            vec3 soilColor = mix(soilDark, soilBase, soilNoise + soilDetail + 0.5);
            
            float shadow = calculateShadow();
            vec3 finalColor = getAtmosphericLight(soilColor, normal, v_worldPos, u_timeOfDay) * shadow;
            
            gl_FragColor = vec4(finalColor, 1.0);
            return;
        }
        
        // ERBA
        if (u_isGrass > 0.5) {
            vec3 grassBase = vec3(0.2, 0.6, 0.1);
            vec3 grassTip = vec3(0.3, 0.8, 0.2);
            
            float heightFactor = (v_position.y + 1.0) * 0.5;
            vec3 grassColor = mix(grassBase, grassTip, heightFactor);
            
            float windEffect = sin(u_windTime + v_worldPos.x * 0.1 + v_worldPos.z * 0.1) * 0.1 + 0.9;
            grassColor *= windEffect;
            
            // Ombra soft per l'erba
            float shadow = 1.0;
            if (u_enableShadows > 0.5) {
                vec3 projCoords = v_shadowCoord.xyz / v_shadowCoord.w;
                projCoords = projCoords * 0.5 + 0.5;
                
                if (projCoords.z <= 1.0 && projCoords.x >= 0.0 && projCoords.x <= 1.0 && 
                    projCoords.y >= 0.0 && projCoords.y <= 1.0) {
                    float closestDepth = texture2D(u_shadowMap, projCoords.xy).r;
                    float currentDepth = projCoords.z;
                    shadow = currentDepth - 0.003 > closestDepth ? 0.6 : 1.0;
                }
            }
            
            vec3 finalColor = getAtmosphericLight(grassColor, normal, v_worldPos, u_timeOfDay) * shadow;
            
            gl_FragColor = vec4(finalColor, 1.0);
            return;
        }
        
        // NUVOLE
        if (u_isCloud > 0.5) {
            vec3 cloudColor = u_color;
            
            // Colore nuvole varia con il tempo
            if (u_timeOfDay < 0.3 || u_timeOfDay > 0.7) {
                cloudColor *= vec3(1.2, 0.8, 0.6); // Nuvole dorate alba/tramonto
            }
            
            vec3 finalColor = getAtmosphericLight(cloudColor, normal, v_worldPos, u_timeOfDay);
            gl_FragColor = vec4(finalColor, u_opacity);
            return;
        }
        
        // SFERA LUMINOSA (sole)
        if (u_isSphere > 0.5) {
            vec3 glowColor = vec3(1.0, 0.9, 0.7);
            
            // Colore varia con il tempo
            if (u_timeOfDay < 0.3 || u_timeOfDay > 0.7) {
                glowColor = vec3(1.0, 0.6, 0.3); // Sole rosso alba/tramonto
            }
            
            vec3 finalColor = glowColor * u_lightIntensity;
            float distFromCenter = length(v_position);
            float glow = 1.0 - smoothstep(0.0, 1.0, distFromCenter);
            finalColor += glowColor * glow * 0.5;
            
            gl_FragColor = vec4(finalColor, 1.0);
            return;
        }
        
        // GNOMONE
        if (u_isGnomon > 0.5) {
            float metallic = sin(v_position.y * 25.0) * 0.15 + 0.85;
            vec3 bronzeBase = vec3(0.8, 0.6, 0.2);
            vec3 bronzeHighlight = vec3(0.9, 0.75, 0.3);
            vec3 bronzeColor = mix(bronzeBase, bronzeHighlight, metallic);
            
            float shadow = calculateShadow();
            vec3 finalColor = getAtmosphericLight(bronzeColor, normal, v_worldPos, u_timeOfDay) * shadow;
            
            gl_FragColor = vec4(finalColor, 1.0);
            return;
        }
        
        // LINEE ORARIE
        if (u_isHourLine > 0.5) {
            vec3 lineColor = vec3(0.9, 0.9, 0.8);
            float shadow = calculateShadow();
            vec3 finalColor = getAtmosphericLight(lineColor, normal, v_worldPos, u_timeOfDay) * shadow;
            
            gl_FragColor = vec4(finalColor, 1.0);
            return;
        }
        
        // OGGETTI GENERICI
        float shadow = calculateShadow();
        vec3 finalColor = getAtmosphericLight(u_color, normal, v_worldPos, u_timeOfDay) * shadow;
        gl_FragColor = vec4(finalColor, 1.0);
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