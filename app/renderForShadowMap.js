import { mat4, identity, multiply } from '../utils/math-utils.js';
export function renderForShadowMap() {
    const gl = this.gl;
    gl.useProgram(this.shadowProgram);

   
for (const blade of this.buffers.grassBlades) {
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

    this.renderer.drawShadowObject(
        blade.vertex,
        blade.index,
        blade.transform.geometry.indices.length,
        true,
        model
    );
}



    // ERBA (corretto rispetto alla tua struttura dati)
    //if (this.buffers.grassBlades) {
        //this.buffers.grassBlades.forEach((blade, i) => {
            //const geometry = blade.transform.geometry;
            //if (!geometry) return;

            //this.renderer.drawShadowObject(
                //blade.vertex,
                //blade.index,
                //geometry.indices.length,
                //true
            //);
        //});
    //}
}
