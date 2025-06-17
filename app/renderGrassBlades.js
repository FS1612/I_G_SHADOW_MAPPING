import { mat4, identity, multiply } from '../utils/math-utils.js';
export function renderGrassBlades(projectionMatrix, viewMatrix, lightDirection, values) {
    if (!this.buffers.grassBlades) {
        console.log('No grass blades buffer found');
        return;
    }

    //console.log(`Rendering ${this.buffers.grassBlades.length} grass blades`);
    
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Ottieni tutte le uniform locations
    const u_isGrassLocation = gl.getUniformLocation(this.program, 'u_isGrass');
    const u_windTimeLocation = gl.getUniformLocation(this.program, 'u_windTime');
    const u_colorLocation = gl.getUniformLocation(this.program, 'u_color');
    
    // DEBUG: Verifica lo stato corrente di OpenGL
   // console.log('Current program:', this.program);
    //console.log('u_isGrass location:', u_isGrassLocation);
    
    // Verifica che il programma shader sia quello giusto
    if (gl.getParameter(gl.CURRENT_PROGRAM) !== this.program) {
        //console.error('Wrong shader program is active!');
    }
    
    if (u_windTimeLocation) gl.uniform1f(u_windTimeLocation, this.animationTime);

    this.buffers.grassBlades.forEach((blade, index) => {
        // Solo per i primi 3 blade per evitare spam
        const shouldLog = index < 3;
        
        if (shouldLog) {
            //console.log(`--- Rendering blade ${index} ---`);
        }
        
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

        // Chiama setUniforms PRIMA di settare u_isGrass
        this.renderer.setUniforms(lightDirection, mvp, model, model, values.enableShadows, values.lowQuality);

        // FORZA u_isGrass DOPO setUniforms
        if (u_isGrassLocation !== -1 && u_isGrassLocation !== null) {
            gl.uniform1f(u_isGrassLocation, 1.0);
            
            if (shouldLog) {
                // Verifica che il valore sia stato settato
                //console.log('Set u_isGrass to 1.0');
                
                // Test: prova a leggere il valore (questo potrebbe non funzionare su tutti i browser)
                try {
                    const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);
                    //console.log('Active program during uniform set:', currentProgram);
                } catch(e) {
                    //console.log('Cannot read current program');
                }
            }
        } else {
            //console.error('u_isGrass location is invalid:', u_isGrassLocation);
        }
        
        // Forza anche il colore verde tramite u_color
        if (u_colorLocation !== -1 && u_colorLocation !== null) {
            gl.uniform3f(u_colorLocation, 0.0, 1.0, 0.0); // Verde puro per debug
            if (shouldLog) {
                //console.log('Set u_color to pure green');
            }
        }

        const grassColor = [0.0, 1.0, 0.0]; // Verde puro per debug
        
        // DEBUG: Verifica i parametri prima del draw
        if (shouldLog) {
            //console.log('About to draw with:');
            //console.log('- Vertex buffer:', blade.vertex);
            //console.log('- Index buffer:', blade.index);
            //console.log('- Index count:', transform.geometry.indices.length);
            //console.log('- Color:', grassColor);
        }
        
        this.renderer.drawObject(
            blade.vertex,
            blade.index,
            transform.geometry.indices.length,
            grassColor,
            false, false, false, false
        );
        
        if (shouldLog) {
            //console.log('Draw call completed');
        }
    });

    // Resetta u_isGrass alla fine
    if (u_isGrassLocation !== -1 && u_isGrassLocation !== null) {
        gl.uniform1f(u_isGrassLocation, 0.0);
        //console.log('Reset u_isGrass to 0.0');
    }

    gl.disable(gl.BLEND);
    //console.log('Grass rendering completed');
}

// Funzione aggiuntiva per verificare lo stato degli shader
export function debugShaderState(gl, program) {
    console.log('=== SHADER DEBUG ===');
    console.log('Program:', program);
    console.log('Current program:', gl.getParameter(gl.CURRENT_PROGRAM));
    console.log('Program valid:', gl.isProgram(program));
    console.log('Program linked:', gl.getProgramParameter(program, gl.LINK_STATUS));
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
       // console.error('Program link error:', gl.getProgramInfoLog(program));
    }
    
    // Lista tutte le uniform attive
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    console.log('Active uniforms:', numUniforms);
    
    for (let i = 0; i < numUniforms; i++) {
        const info = gl.getActiveUniform(program, i);
        console.log(`Uniform ${i}: ${info.name} (${info.type})`);
    }
}