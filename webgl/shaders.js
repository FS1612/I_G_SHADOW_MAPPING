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
    uniform vec3 u_lightDirection;
    
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec2 v_texCoord;
    varying vec3 v_lightDirection;
    varying vec3 v_worldPos;
    
    void main() {
        gl_Position = u_modelViewProjectionMatrix * vec4(a_position, 1.0);
        v_worldPos = (u_modelMatrix * vec4(a_position, 1.0)).xyz;
        v_position = a_position;
        v_normal = normalize((u_normalMatrix * vec4(a_normal, 0.0)).xyz);
        v_texCoord = a_texCoord;
        v_lightDirection = normalize(u_lightDirection);
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
uniform float u_enableShadows;
uniform vec3 u_color;
uniform float u_isGround;
uniform float u_isGnomon;
uniform float u_isHourLine;
uniform vec3 u_lightDirection;
uniform vec3 u_gnomonPosition;
uniform float u_lowQuality;


// Function to calculate if a point is in the shadow of the gnomon
float calculateGnomonShadow(vec3 worldPos, vec3 lightDir, vec3 gnomonBase) {
    if (lightDir.y >= 0.0) return 1.0; // Sun below the horizon
    
    // Gnomon dimensions
    float gnomonHeight = 2.0;
    float gnomonWidth = 0.05;
    
    vec3 gnomonTop = gnomonBase + vec3(0.0, gnomonHeight, 0.0);
    
    // Normalize the light direction
    vec3 normalizedLightDir = normalize(lightDir);
    
    float shadowIntensity = 1.0;
    
    // Check shadow for different points along the gnomon
    for (float t = 0.0; t <= 1.0; t += 0.99) {
        vec3 gnomonPoint = mix(gnomonBase, gnomonTop, t);
        
        // For each gnomon point, check the 4 corners of the rectangular section
        for (float i = -1.0; i <= 1.0; i += 2.0) {
            for (float j = -1.0; j <= 1.0; j += 2.0) {
                vec3 cornerPoint = gnomonPoint + vec3(i * gnomonWidth, 0.0, j * gnomonWidth);
                
                // Calculate where this point projects shadow on the ground
                float rayParam = -cornerPoint.y / normalizedLightDir.y;
                if (rayParam > 0.0) {
                    vec3 shadowPoint = cornerPoint + normalizedLightDir * rayParam;
                    
                    // Distance from current point to projected shadow
                    float distToShadow = length(worldPos.xz - shadowPoint.xz);
                    
                    // Apply gradual shadow
                    if (distToShadow < 0.2) {
                        float localShadow = 0.7 + 0.9 * smoothstep(0.0, 0.2, distToShadow);
                        shadowIntensity = min(shadowIntensity, localShadow);
                    }
                }
            }
        }
    }
    
    // Additional shadow for the main body of the gnomon
    // Project the entire rectangular shape
    vec3 gnomonCenter = gnomonBase + vec3(0.0, gnomonHeight * 0.5, 0.0);
    float centerRayParam = -gnomonCenter.y / normalizedLightDir.y;
    
    if (centerRayParam > 0.0) {
        vec3 centerShadowPoint = gnomonCenter + normalizedLightDir * centerRayParam;
        
        // Calculate shadow orientation based on light direction
        vec3 lightDirXZ = normalize(vec3(normalizedLightDir.x, 0.0, normalizedLightDir.z));
        vec3 perpDir = vec3(-lightDirXZ.z, 0.0, lightDirXZ.x);
        
        // Project the rectangular shape of the gnomon
        vec3 toPoint = worldPos - centerShadowPoint;
        float alongLight = dot(toPoint.xz, lightDirXZ.xz);
        float perpToLight = dot(toPoint.xz, perpDir.xz);
        
        // Projected shadow dimensions (scaled by light angle)
        float shadowLength = gnomonHeight / abs(normalizedLightDir.y);
        float shadowWidth = gnomonWidth * 2.0;
        
        if (alongLight > 0.0 && alongLight < shadowLength && abs(perpToLight) < shadowWidth) {
            float edgeFadeAlong = smoothstep(shadowLength * 0.8, shadowLength, abs(alongLight));
            float edgeFadePerp = smoothstep(shadowWidth * 0.6, shadowWidth, abs(perpToLight));
            float coreShadow = 0.15 + 0.4 * max(edgeFadeAlong, edgeFadePerp);
            shadowIntensity = min(shadowIntensity, coreShadow);
        }
    }
    
    return shadowIntensity;
}

void main() {
    vec3 color = u_color;
    
    vec3 lightDir = normalize(-u_lightDirection);
    float light = max(0.4, dot(v_normal, lightDir));
    
    if (u_isGround > 0.5) {
        // More realistic grass effect
        float scaleFactor = mix(1.0, 0.4, u_lowQuality);
        float noise1 = sin(v_worldPos.x * 12.0 * scaleFactor) * sin(v_worldPos.z * 12.0 * scaleFactor);
        float noise2 = sin(v_worldPos.x * 20.0 * scaleFactor + v_worldPos.z * 20.0 * scaleFactor);
        float grass = (noise1 + noise2 * 0.3) * 0.1 + 0.9;
        
        vec3 grassColor1 = vec3(0.2, 0.6, 0.2);
        vec3 grassColor2 = vec3(0.3, 0.7, 0.3);
        color = mix(grassColor1, grassColor2, grass);
        
        // Apply complete gnomon shadow
        float shadowFactor = u_enableShadows > 0.5 ? calculateGnomonShadow(v_worldPos, u_lightDirection, u_gnomonPosition) : 1.0; //to address the fact that the user may does not wanta shadows
        color = color * shadowFactor;
    }
    
    if (u_isGnomon > 0.5) {
        // Bronze material for the gnomon
        float metallic = sin(v_position.y * 25.0) * 0.1 + 0.9;
        color = vec3(0.8, 0.6, 0.2) * metallic;
        
        float selfShadow = dot(v_normal, lightDir);
        if (selfShadow < 0.4) {
            float shadowFactor = smoothstep(0.0, 0.4, selfShadow);
            color = mix(color * 0.2, color, shadowFactor);
        }
    }
    
    if (u_isHourLine > 0.5) {
        // Hour lines in light stone
        color = vec3(0.9, 0.9, 0.8);
    }
    
    // Final lighting
    vec3 ambient = vec3(0.3, 0.35, 0.4);
    color = color * light + color * ambient * 0.2;
    
    gl_FragColor = vec4(color, 1.0);
}
`;