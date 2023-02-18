import Box2DLib from "box2d";

export let box2d = null;

export function initBox2D() {
    return new Promise(resolve => {
        Box2DLib().then((re) => {
            box2d = re;
            resolve();
        });
    });
}
