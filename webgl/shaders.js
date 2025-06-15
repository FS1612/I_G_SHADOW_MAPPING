/**
 * Vertex shader:
 * - Transforms vertex positions into screen space.
 * - Calculates lighting-relevant vectors (normal, world position).
 * - Forwards light direction and texture coordinates.
 */
export const vertexShaderSource = `
    precision mediump float;
    attribute vec3 a_position;
    attribute vec3 a_normal;
    attribute vec2 a_texCoord;
    
    uniform mat4 u_modelViewProjectionMatrix;
    uniform mat4 u_modelMatrix;
    uniform mat4 u_normalMatrix;
    uniform mat4 u_lightViewProjectionMatrix;  // NUOVO
    uniform vec3 u_lightDirection;
    
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec2 v_texCoord;
    varying vec3 v_lightDirection;
    varying vec3 v_worldPos;
    varying vec4 v_shadowCoord;  // NUOVO
    
    void main() {
        gl_Position = u_modelViewProjectionMatrix * vec4(a_position, 1.0);
        v_worldPos = (u_modelMatrix * vec4(a_position, 1.0)).xyz;
        v_position = a_position;
        v_normal = normalize((u_normalMatrix * vec4(a_normal, 0.0)).xyz);
        v_texCoord = a_texCoord;
        v_lightDirection = normalize(u_lightDirection);
        
        // Calcola coordinate shadow map
        v_shadowCoord = u_lightViewProjectionMatrix * vec4(a_position, 1.0);
    }
`;

/**
 * Fragment shader:
 * - Computes material color based on object type (ground, gnomon, hour line).
 * - Generates realistic shadow under gnomon using ray projection.
 * - Includes ambient and directional lighting.
 * - Supports bronze-like material and procedural grass effect.
 */
export const fragmentShaderSource = `
    precision mediump float;

    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec2 v_texCoord;
    varying vec3 v_lightDirection;
    varying vec3 v_worldPos;
    varying vec4 v_shadowCoord;

    uniform vec3 u_color;
    uniform float u_isGround;
    uniform float u_isGnomon;
    uniform float u_isHourLine;
    uniform float u_enableShadows;
    uniform vec3 u_lightDirection;
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
    
    // Improved bias calculation
    vec3 lightDir = normalize(-u_lightDirection);
    vec3 normal = normalize(v_normal);
    float bias = max(0.005 * (1.0 - dot(normal, lightDir)), 0.001);
    
    // PCF (Percentage Closer Filtering) for smoother shadows
    float shadow = 0.0;
    vec2 texelSize = 1.0 / vec2(2048.0);
    
    for(int x = -1; x <= 1; ++x) {
        for(int y = -1; y <= 1; ++y) {
            float pcfDepth = texture2D(u_shadowMap, shadowCoordNorm.xy + vec2(x, y) * texelSize).r;
            shadow += currentDepth - bias > pcfDepth ? 0.0 : 1.0;
        }
    }
    shadow /= 9.0;
    
    return mix(0.3, 1.0, shadow); // 0.3 = shadow darkness, 1.0 = full light
}

    void main() {
        vec3 color = u_color;
        vec3 lightDir = normalize(-u_lightDirection);
        float light = max(0.4, dot(v_normal, lightDir));
        
        float shadow = 1.0;
        if (u_enableShadows > 0.5) {
            shadow = sampleShadowMap(v_shadowCoord);
        }
        
        if (u_isGround > 0.5) {
            float noise1 = sin(v_worldPos.x * 12.0) * sin(v_worldPos.z * 12.0);
            float noise2 = sin(v_worldPos.x * 20.0 + v_worldPos.z * 20.0);
            float grass = (noise1 + noise2 * 0.3) * 0.1 + 0.9;
            
            vec3 grassColor1 = vec3(0.2, 0.6, 0.2);
            vec3 grassColor2 = vec3(0.3, 0.7, 0.3);
            color = mix(grassColor1, grassColor2, grass);
        }
        
        if (u_isGnomon > 0.5) {
            float metallic = sin(v_position.y * 25.0) * 0.1 + 0.9;
            color = vec3(0.8, 0.6, 0.2) * metallic;
        }
        
        if (u_isHourLine > 0.5) {
            color = vec3(0.9, 0.9, 0.8);
        }
        
        vec3 ambient = vec3(0.3, 0.35, 0.4);
        color = color * light * shadow + color * ambient * 0.2;
        
        gl_FragColor = vec4(color, 1.0);
    }
`;
// Shadow map vertex shader
export const shadowVertexShaderSource = `
    precision mediump float;
    attribute vec3 a_position;
    uniform mat4 u_lightViewProjectionMatrix;
    
    void main() {
        gl_Position = u_lightViewProjectionMatrix * vec4(a_position, 1.0);
    }
`;

// Shadow map fragment shader
export const shadowFragmentShaderSource = `
    precision mediump float;
    
    void main() {
        gl_FragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0);
    }
`;