import { mat4, vec3 } from "gl-matrix";
import { box2d, initBox2D } from "./init-box2d.js";
import { gl, initWebGLContext } from "./webgl-context.js";
import createShaderProgram from "./shader-program.js";
import RayCaster from "./ray-caster.js";
import DebugDrawer from "./debug-drawer.js";
import Keyboard from "./keyboard.js";

let debugDrawer, raycaster, downRayCallback, world, playerFixture;
const pixelsPerMeter = 30;
const keyboard = new Keyboard();

const metaData = {};

const groundColor = vec3.fromValues(0.77, 0.37, 0.06);
const groundPosition = vec3.fromValues(100, 15, 0);
const groundSize = vec3.fromValues(190, 19, 1);

const playerColor = vec3.fromValues(0.1, 0.3, 0.9);
const playerPosition = vec3.fromValues(20, 50, 0);
const playerSize = vec3.fromValues(20, 20, 1);
let playerBody;

const fixtures = [];

const platforms = [];
platforms.push({ pos: vec3.fromValues(50, 70, 0), size: vec3.fromValues(20, 20, 1) });
platforms.push({ pos: vec3.fromValues(100, 100, 0), size: vec3.fromValues(20, 20, 1) });
platforms.push({ pos: vec3.fromValues(150, 150, 0), size: vec3.fromValues(20, 20, 1) });

let program, uColorLocation, uMvpMatrixLocation;

const projMatrix = mat4.create();
mat4.ortho(projMatrix, 0, 200, 0, 200, 1, -1);

const viewMatrix = mat4.create();
mat4.lookAt(viewMatrix, [0, 0, 1], [0, 0, 0], [0, 1, 0]);

const projViewMatrix = mat4.create();
mat4.mul(projViewMatrix, projMatrix, viewMatrix);

const modelMatrix = mat4.create();
const mvpMatrix = mat4.create();

let grounded = false;

let showColliders = true;
const showCollidersCheckbox = document.getElementById("colliderCheckBox");
showCollidersCheckbox.onchange = () => {
    showColliders = showCollidersCheckbox.checked;
};

async function init() {
    if (!initWebGLContext("renderCanvas")) return;
    await initBox2D();
    const {
        b2_dynamicBody,
        b2BodyDef,
        b2Fixture,
        b2PolygonShape,
        b2Vec2,
        getPointer,
        JSRayCastCallback,
        wrapPointer,
        b2World
    } = box2d;

    gl.clearColor(0.2, 0.2, 0.2, 1);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    program = await createShaderProgram("assets/shaders/",
        "default.vert", "default.frag");

    uMvpMatrixLocation = gl.getUniformLocation(program, "uMvpMatrix");
    uColorLocation = gl.getUniformLocation(program, "uColor");

    const vertPositions = [
        -0.5, -0.5,
        0.5, -0.5,
        -0.5, 0.5,
        0.5, 0.5
    ];
    const vertPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPositions),
        gl.STATIC_DRAW);

    const aPositionLocation = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPositionLocation);

    world = new b2World();
    const gravity = new b2Vec2(0, -9.8);
    world.SetGravity(gravity);

    debugDrawer = new DebugDrawer(program, pixelsPerMeter);
    debugDrawer.projViewMatrix = projViewMatrix;
    world.SetDebugDraw(debugDrawer.instance);

    raycaster = new RayCaster(program);
    raycaster.projViewMatrix = projViewMatrix;

    // Ground
    const groundBodyDef = new b2BodyDef();
    groundBodyDef.set_position(new b2Vec2(groundPosition[0] / pixelsPerMeter,
        groundPosition[1] / pixelsPerMeter));
    const groundBody = world.CreateBody(groundBodyDef);
    const groundShape = new b2PolygonShape();
    groundShape.SetAsBox(groundSize[0] / 2 / pixelsPerMeter,
        groundSize[1] / 2 / pixelsPerMeter);
    const groundFixture = groundBody.CreateFixture(groundShape, 0);
    groundFixture.SetFriction(1);
    metaData[getPointer(groundFixture)] = {
        name: "ground"
    };
    fixtures.push(groundFixture);

    for (var i = 0; i < platforms.length; i++) {
        const bodyDef = new b2BodyDef();
        bodyDef.set_position(new b2Vec2(platforms[i].pos[0] / pixelsPerMeter,
            platforms[i].pos[1] / pixelsPerMeter));
        const body = world.CreateBody(bodyDef);
        const shape = new b2PolygonShape();
        shape.SetAsBox(platforms[i].size[0] / 2 / pixelsPerMeter,
            platforms[i].size[1] / 2 / pixelsPerMeter);
        const fixture = body.CreateFixture(shape, 0);
        fixture.SetFriction(1);
        metaData[getPointer(fixture)] = {
            name: `platform_${i}`
        };
        fixtures.push(fixture);
    }

    // Box
    const playerBodyDef = new b2BodyDef();
    playerBodyDef.set_position(new b2Vec2(playerPosition[0] / pixelsPerMeter,
        playerPosition[1] / pixelsPerMeter));
    playerBodyDef.type = b2_dynamicBody;
    playerBodyDef.fixedRotation = true;
    playerBody = world.CreateBody(playerBodyDef);
    const playerShape = new b2PolygonShape();
    playerShape.SetAsBox(playerSize[0] / 2 / pixelsPerMeter,
        playerSize[1] / 2 / pixelsPerMeter);
    playerFixture = playerBody.CreateFixture(playerShape, 1);
    playerFixture.SetFriction(1);

    // let counter = 1;
    // callback = Object.assign(new JSRayCastCallback(), {
    //     ReportFixture: (fixture_p, point_p, normal_p, fraction) => {
    //         const fixture = wrapPointer(fixture_p, b2Fixture);
    //         const name = metaData[getPointer(fixture)].name;
    //         if (name !== "ground") {
    //             console.log(name);
    //         } else if (counter > 0) {
    //             console.log(name);
    //             counter = 0;
    //         }
    //         return 0;
    //     }
    // });

    // downRayCallback = Object.assign(new JSRayCastCallback(), {
    //     ReportFixture: (fixture_p, point_p, normal_p, fraction) => {
    //         const fixture = wrapPointer(fixture_p, b2Fixture);
    //         const name = metaData[getPointer(fixture)].name;
    //         if (name === "ground") {
    //             // grounded = true;
    //             console.log("downRayCallback");
    //         }
    //         return 0;
    //     }
    // });

    function keyboardHandler() {
        if (keyboard.pressed("KeyW") || keyboard.pressed("ArrowUp")) {
            const vel = playerBody.GetLinearVelocity();
            vel.y = 5;
            playerBody.SetLinearVelocity(vel);
        } else if (keyboard.pressed("KeyA") || keyboard.pressed("ArrowLeft")) {
            const vel = playerBody.GetLinearVelocity();
            vel.x = -2;
            playerBody.SetLinearVelocity(vel);
        } else if (keyboard.pressed("KeyD") || keyboard.pressed("ArrowRight")) {
            const vel = playerBody.GetLinearVelocity();
            vel.x = 2;
            playerBody.SetLinearVelocity(vel);
        }
    }

    const maxTimeStepMs = 1 / 60 * 1000;

    function step(deltaMs) {
        const clampedDeltaMs = Math.min(deltaMs, maxTimeStepMs);
        world.Step(clampedDeltaMs / 1000, 3, 2);
        keyboardHandler();
    }

    function draw() {
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Draw colliders
        if (showColliders) {
            world.DebugDraw();
        }

        // Ground
        mat4.fromTranslation(modelMatrix, groundPosition);
        mat4.scale(modelMatrix, modelMatrix, groundSize);
        mat4.mul(mvpMatrix, projViewMatrix, modelMatrix);
        gl.uniformMatrix4fv(uMvpMatrixLocation, false, mvpMatrix);
        gl.uniform3fv(uColorLocation, groundColor);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        for (var i = 0; i < platforms.length; i++) {
            mat4.fromTranslation(modelMatrix, platforms[i].pos);
            mat4.scale(modelMatrix, modelMatrix, platforms[i].size);
            mat4.mul(mvpMatrix, projViewMatrix, modelMatrix);
            gl.uniformMatrix4fv(uMvpMatrixLocation, false, mvpMatrix);
            gl.uniform3fv(uColorLocation, groundColor);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        // Box
        const position = playerBody.GetPosition();
        playerPosition[0] = position.x * pixelsPerMeter;
        playerPosition[1] = position.y * pixelsPerMeter;
        mat4.fromTranslation(modelMatrix, playerPosition);
        mat4.scale(modelMatrix, modelMatrix, playerSize);
        mat4.mul(mvpMatrix, projViewMatrix, modelMatrix);
        gl.uniformMatrix4fv(uMvpMatrixLocation, false, mvpMatrix);
        gl.uniform3fv(uColorLocation, playerColor);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Up ray
        // raycaster.drawLine([playerPosition[0], playerPosition[1] + 5],
        //     [playerPosition[0], playerPosition[1] + 15], [1, 0, 0]);
        // let point1 = new b2Vec2(playerPosition[0] / pixelsPerMeter,
        //     (playerPosition[1] + 5) / pixelsPerMeter);
        // let point2 = new b2Vec2(playerPosition[0] / pixelsPerMeter,
        //     (playerPosition[1] + 15) / pixelsPerMeter);
        // world.RayCast(callback, point1, point2);

        // Down ray
        raycaster.drawLine([playerPosition[0], playerPosition[1] - 5],
            [playerPosition[0], playerPosition[1] - 15], [1, 1, 1]);
        const point1 = new b2Vec2(playerPosition[0] / pixelsPerMeter,
            (playerPosition[1] - 5) / pixelsPerMeter);
        const point2 = new b2Vec2(playerPosition[0] / pixelsPerMeter,
            (playerPosition[1] - 15) / pixelsPerMeter);
        // world.RayCast(downRayCallback, point1, point2);

        const input = {
            p1: point1,
            p2: point2,
            maxFraction: 1
        };
        const output = {
            normal: new b2Vec2(0, 0),
            fraction: 1
        };

        grounded = false;
        for (let i = 0; i < fixtures.length; i++) {
            grounded = fixtures[i].RayCast(output, input);
            if (grounded)
                break;
        }
        console.log(`grounded = ${grounded}`);
    }

    (function animationLoop(prevMs) {
        const nowMs = window.performance.now()
        window.requestAnimationFrame(animationLoop.bind(null, nowMs));
        const deltaMs = nowMs - prevMs;
        step(deltaMs);
        draw();
    })(window.performance.now());
}

init();
