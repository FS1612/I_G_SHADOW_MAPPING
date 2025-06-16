/**
 * Creates a new 4x4 matrix initialized with zeros.
 * @returns {Float32Array} A new 4x4 matrix.
 */
export function mat4() {
  return new Float32Array(16);
}
/**
 * Sets a 4x4 matrix to the identity matrix.
 * @param {Float32Array} out - The output matrix.
 * @returns {Float32Array} The identity matrix.
 */
export function identity(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
/**
 * Generates a perspective projection matrix.
 * @param {Float32Array} out - The output matrix.
 * @param {number} fovy - Field of view in the y direction, in radians.
 * @param {number} aspect - Aspect ratio (width / height).
 * @param {number} near - Distance to the near clipping plane.
 * @param {number} far - Distance to the far clipping plane.
 * @returns {Float32Array} The perspective projection matrix.
 */
export function perspective(out, fovy, aspect, near, far) {
  const f = 1.0 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[14] = 2 * far * near * nf;
  out[15] = 0;
  return out;
}
/**
 * Creates a view matrix using the eye position, target, and up vector.
 * @param {Float32Array} out - The output matrix.
 * @param {number[]} eye - The position of the camera.
 * @param {number[]} center - The point the camera is looking at.
 * @param {number[]} up - The up direction vector.
 * @returns {Float32Array} The view matrix.
 */
export function lookAt(out, eye, center, up) {
  const z0 = eye[0] - center[0],
    z1 = eye[1] - center[1],
    z2 = eye[2] - center[2];
  let len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
  const zx = z0 * len,
    zy = z1 * len,
    zz = z2 * len;

  const x0 = up[1] * zz - up[2] * zy;
  const x1 = up[2] * zx - up[0] * zz;
  const x2 = up[0] * zy - up[1] * zx;
  len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
  const xx = len ? x0 / len : 0,
    xy = len ? x1 / len : 0,
    xz = len ? x2 / len : 0;

  const y0 = zy * xz - zz * xy;
  const y1 = zz * xx - zx * xz;
  const y2 = zx * xy - zy * xx;

  out[0] = xx;
  out[1] = y0;
  out[2] = zx;
  out[3] = 0;
  out[4] = xy;
  out[5] = y1;
  out[6] = zy;
  out[7] = 0;
  out[8] = xz;
  out[9] = y2;
  out[10] = zz;
  out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}
/**
 * Multiplies two 4x4 matrices (a × b) and stores the result in out.
 * @param {Float32Array} out - The output matrix.
 * @param {Float32Array} a - The first matrix operand.
 * @param {Float32Array} b - The second matrix operand.
 * @returns {Float32Array} The resulting matrix.
 */
export function multiply(out, a, b) {
  const a00 = a[0],
    a01 = a[1],
    a02 = a[2],
    a03 = a[3];
  const a10 = a[4],
    a11 = a[5],
    a12 = a[6],
    a13 = a[7];
  const a20 = a[8],
    a21 = a[9],
    a22 = a[10],
    a23 = a[11];
  const a30 = a[12],
    a31 = a[13],
    a32 = a[14],
    a33 = a[15];

  let b0 = b[0],
    b1 = b[1],
    b2 = b[2],
    b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}
/**
 * Creates an orthographic projection matrix.
 * Used for shadow map rendering from light's point of view.
 *
 * @param {number} left - Left plane of the orthographic volume.
 * @param {number} right - Right plane.
 * @param {number} bottom - Bottom plane.
 * @param {number} top - Top plane.
 * @param {number} near - Near clipping plane.
 * @param {number} far - Far clipping plane.
 * @returns {Float32Array} A 4x4 orthographic projection matrix.
 */
export function createOrthographicMatrix(left, right, bottom, top, near, far) {
    const matrix = new Float32Array(16);

    matrix[0] = 2 / (right - left);
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;

    matrix[4] = 0;
    matrix[5] = 2 / (top - bottom);
    matrix[6] = 0;
    matrix[7] = 0;

    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = -2 / (far - near);
    matrix[11] = 0;

    matrix[12] = -(right + left) / (right - left);
    matrix[13] = -(top + bottom) / (top - bottom);
    matrix[14] = -(far + near) / (far - near);
    matrix[15] = 1;

    return matrix;
}
