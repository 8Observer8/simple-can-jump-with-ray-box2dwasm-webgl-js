import { mat4, vec3 } from "gl-matrix";
import { gl } from "./webgl-context.js";

export default class RayCaster {
    constructor(program) {
        this.program = program;
        gl.useProgram(program);
        this.uMvpMatrixLocation = gl.getUniformLocation(program, "uMvpMatrix");
        this.uColorLocation = gl.getUniformLocation(program, "uColor");
        this.mvpMatrix = mat4.create();
        this.modelMatrix = mat4.create();
        this.projViewMatrix = null;
    }

    drawLine(from, to, color, thickness = 1) {
        const centerPoint = vec3.fromValues(from[0] + (to[0] - from[0]) / 2,
            from[1] + (to[1] - from[1]) / 2, 0);
        const a = from[1] - to[1];
        const b = from[0] - to[0];
        const tan = a / b;
        const rad = Math.atan(tan);
        const v = vec3.fromValues(b, a, 0);
        const length = vec3.length(v);
        mat4.fromTranslation(this.modelMatrix, centerPoint);
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, rad);
        mat4.scale(this.modelMatrix, this.modelMatrix, [length, thickness, 1]);
        mat4.mul(this.mvpMatrix, this.projViewMatrix, this.modelMatrix);
        gl.uniformMatrix4fv(this.uMvpMatrixLocation, false, this.mvpMatrix);
        gl.uniform3fv(this.uColorLocation, color);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
