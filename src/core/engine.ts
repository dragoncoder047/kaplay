// The engine is what KAPLAY needs for running and proccesing all it's stuff

import { initApp } from "../app/app";
import { initAssets } from "../assets/asset";
import { initAudio } from "../audio/audio";
import { createDebug } from "../debug/debug";
import { blendFactory } from "../ecs/components/draw/blend";
import { circleFactory } from "../ecs/components/draw/circle";
import { colorFactory } from "../ecs/components/draw/color";
import { ellipseFactory } from "../ecs/components/draw/ellipse";
import { maskFactory } from "../ecs/components/draw/mask";
import { opacityFactory } from "../ecs/components/draw/opacity";
import { outlineFactory } from "../ecs/components/draw/outline";
import { rectFactory } from "../ecs/components/draw/rect";
import { shaderFactory } from "../ecs/components/draw/shader";
import { spriteFactory } from "../ecs/components/draw/sprite";
import { textFactory } from "../ecs/components/draw/text";
import { agentFactory } from "../ecs/components/level/agent";
import { levelFactory } from "../ecs/components/level/level";
import { patrolFactory } from "../ecs/components/level/patrol";
import { tileFactory } from "../ecs/components/level/tile";
import { nameFactory } from "../ecs/components/misc/named";
import { stateFactory } from "../ecs/components/misc/state";
import { stayFactory } from "../ecs/components/misc/stay";
import { areaFactory } from "../ecs/components/physics/area";
import { bodyFactory } from "../ecs/components/physics/body";
import { anchorFactory } from "../ecs/components/transform/anchor";
import { fixedFactory } from "../ecs/components/transform/fixed";
import { moveFactory } from "../ecs/components/transform/move";
import { posFactory } from "../ecs/components/transform/pos";
import { rotateFactory } from "../ecs/components/transform/rotate";
import { scaleFactory } from "../ecs/components/transform/scale";
import { skewFactory } from "../ecs/components/transform/skew";
import { zFactory } from "../ecs/components/transform/z";
import { registerPrefabFactory } from "../ecs/entity/prefab";
import { createScopeHandlers } from "../events/scopeHandlers";
import {
    attachScopeHandlersToGameObjRaw,
    createAppScope,
    createSceneScope,
} from "../events/scopes";
import { createGame } from "../game/game";
import { createCanvas } from "../gfx/canvas";
import { initGfx } from "../gfx/gfx";
import { initAppGfx } from "../gfx/gfxApp";
import type { KAPLAYOpt } from "../types";
import type { KAPLAYCtx } from "./contextType";
import { startEngineLoop } from "./engineLoop";
import { createFontCache } from "./fontCache";
import { createFrameRenderer } from "./frameRendering";

export type Engine = ReturnType<typeof createEngine>;

// Create global variables
window.kaplayjs_assetsAliases ??= {};

/**
 * Creates all necessary contexts and variables for running a KAPLAY instance.
 *
 * @ignore
 *
 * @param gopt - Global options for create the engine.
 *
 * @returns Engine.
 */
export const createEngine = (gopt: KAPLAYOpt) => {
    // Default options
    const opt = Object.assign(
        {
            scale: 1,
            spriteAtlasPadding: 2,
            defaultLifetimeScope: "scene" as "scene" | "app",
        } satisfies KAPLAYOpt,
        gopt,
    );

    const canvas = createCanvas(opt);
    const { fontCacheC2d, fontCacheCanvas } = createFontCache();
    const app = initApp({ canvas, ...gopt });
    const gameHandlers = createScopeHandlers(app);
    const sceneScope = createSceneScope(gameHandlers);
    const appScope = createAppScope(gameHandlers);
    attachScopeHandlersToGameObjRaw(gameHandlers);

    // TODO: Probably we should move this to initGfx
    const canvasContext = app.canvas
        .getContext("webgl", {
            antialias: true,
            depth: true,
            stencil: true,
            alpha: true,
            preserveDrawingBuffer: true,
        });

    if (!canvasContext) throw new Error("WebGL not supported");

    const gl = canvasContext;

    // TODO: Investigate correctly what's the different between GFX and AppGFX and reduce to 1 method
    const gfx = initGfx(gl, opt);
    const appGfx = initAppGfx(gfx, opt);
    const assets = initAssets(gfx, opt, appGfx);
    const audio = initAudio();
    const game = createGame();

    // Frame rendering
    const frameRenderer = createFrameRenderer(
        app,
        appGfx,
        game,
        opt.pixelDensity ?? 1,
    );

    // Debug mode
    const debug = createDebug(opt, app, appGfx, audio, game, frameRenderer);

    // Register default factories

    // Transform Serialization
    registerPrefabFactory("anchor", anchorFactory);
    registerPrefabFactory("fixed", fixedFactory);
    // bone() missing: TODO
    // constraint.distance(), constraint.rotation(), constraint.translation(),
    //     constraint.scale(), constraint.transform() missing: don't know how to serialize
    //     a reference to a GameObj; also they all use the same id so we don't know which
    //     one it is when deserializing except via duck typing it aaaaaaaaa
    // constraint.ik() missing: don't know how to serialize a reference to a GameObj
    // follow() missing: don't know how to serialize a reference to a GameObj (use the name from named()?)
    // layer() missing: depends on setLayers() having the right thing
    registerPrefabFactory("move", moveFactory);
    // offscreen() missing
    registerPrefabFactory("pos", posFactory);
    registerPrefabFactory("rotate", rotateFactory);
    registerPrefabFactory("scale", scaleFactory);
    registerPrefabFactory("skew", skewFactory);
    registerPrefabFactory("z", zFactory);

    // Draw Serialization
    registerPrefabFactory("blend", blendFactory);
    registerPrefabFactory("circle", circleFactory);
    registerPrefabFactory("color", colorFactory);
    // drawon() missing: don't know how to serialize the FrameBuffer
    registerPrefabFactory("ellipse", ellipseFactory);
    // fadeIn() missing: is this even worth serializing
    registerPrefabFactory("mask", maskFactory);
    registerPrefabFactory("shader", shaderFactory);
    registerPrefabFactory("opacity", opacityFactory);
    registerPrefabFactory("outline", outlineFactory);
    // particles() missing: don't know how to serialize the Texture
    // picture() missing: don't know how to serialize Picture's Mesh/Material internals
    // polygon() missing: don't know how to serialize Texture
    // raycast() is not a component
    registerPrefabFactory("rect", rectFactory);
    registerPrefabFactory("sprite", spriteFactory);
    registerPrefabFactory("text", textFactory);
    // uvquad() missing: this provides width and height only, how should that be serialized?
    // video() missing: don't know how to serialize the Texture or <video>

    // level and misc serialization
    registerPrefabFactory("level", levelFactory);
    registerPrefabFactory("named", nameFactory);
    registerPrefabFactory("state", stateFactory);
    registerPrefabFactory("stay", stayFactory);
    registerPrefabFactory("agent", agentFactory);
    // pathfinder() missing: unsure on how to serialize the Graph
    registerPrefabFactory("patrol", patrolFactory);
    // sentry() missing: don't know how to serialize candidates callback (function)
    registerPrefabFactory("tile", tileFactory);
    // textInput() missing: unsure how to serialize this
    // timer() missing: all this does is provide callbacks and we can't serialize callbacks

    // physics serialization
    registerPrefabFactory("area", areaFactory);
    registerPrefabFactory("body", bodyFactory);
    // doubleJump() missing: TODO
    // surfaceEffector() missing: TODO
    // areaEffector() missing: TODO
    // pointEffector() missing: TODO
    // constantForce() missing: TODO
    // platformEffector() missing: TODO
    // buoyancyEffector() missing: TODO

    return {
        globalOpt: opt,
        canvas,
        app,
        ggl: gfx,
        gfx: appGfx,
        audio,
        assets,
        frameRenderer,
        fontCacheC2d,
        fontCacheCanvas,
        game,
        debug,
        gc: [] as (() => void)[],
        sceneScope,
        appScope,
        // will be patched in later by kaplay()
        k: null as unknown as KAPLAYCtx,
        startLoop() {
            startEngineLoop(
                app,
                game,
                assets,
                opt,
                frameRenderer,
                debug,
            );
        },
    };
};
