import { type AreaComp, usesArea } from "../../components";
import { onAdd, onDestroy, onUnuse, onUse } from "../../events";
import { onSceneLeave } from "../../game";
import { height, width } from "../../gfx";
import { _k } from "../../kaplay";
import {
    gjkShapeIntersection,
    HashGrid,
    Quadtree,
    Rect,
    SweepAndPruneBoth,
    SweepAndPruneHorizontal,
    type SweepAndPruneLike,
    SweepAndPruneVertical,
    type Vec2,
    vec2
} from "../../math";
import type { GameObj, KAPLAYOpt } from "../../types";

export const getCollisionSystem = () => {
    class Collision {
        source: GameObj;
        target: GameObj;
        normal: Vec2;
        distance: number;
        resolved: boolean = false;
        constructor(
            source: GameObj,
            target: GameObj,
            normal: Vec2,
            distance: number,
            resolved = false,
        ) {
            this.source = source;
            this.target = target;
            this.normal = normal;
            this.distance = distance;
            this.resolved = resolved;
        }
        get displacement() {
            return this.normal.scale(this.distance);
        }
        reverse() {
            return new Collision(
                this.target,
                this.source,
                this.normal.scale(-1),
                this.distance,
                this.resolved,
            );
        }
        hasOverlap() {
            return !this.displacement.isZero();
        }
        isLeft() {
            return this.displacement.cross(_k.game.gravity || vec2(0, 1)) > 0;
        }
        isRight() {
            return this.displacement.cross(_k.game.gravity || vec2(0, 1)) < 0;
        }
        isTop() {
            return this.displacement.dot(_k.game.gravity || vec2(0, 1)) > 0;
        }
        isBottom() {
            return this.displacement.dot(_k.game.gravity || vec2(0, 1)) < 0;
        }
        preventResolution() {
            this.resolved = true;
        }
    }

    function narrowPhase(
        obj: GameObj<AreaComp>,
        other: GameObj<AreaComp>,
    ): boolean {
        if (other.paused) return false;
        if (!other.exists()) return false;
        for (const tag of obj.collisionIgnore) {
            if (other.is(tag)) {
                return false;
            }
        }
        for (const tag of other.collisionIgnore) {
            if (obj.is(tag)) {
                return false;
            }
        }
        const res = gjkShapeIntersection(
            obj.worldArea(),
            other.worldArea(),
        );
        if (res) {
            const col1 = new Collision(
                obj,
                other,
                res.normal,
                res.distance,
            );
            obj.trigger("collideUpdate", other, col1);
            const col2 = col1.reverse();
            // resolution only has to happen once
            col2.resolved = col1.resolved;
            other.trigger("collideUpdate", obj, col2);
        }
        return true;
    }

    let sap: SweepAndPruneLike = undefined as any;
    let sapInit = false;
    function broadPhase() {
        if (!sapInit) {
            sapInit = true;
            onAdd(obj => {
                if (obj.has("area")) {
                    sap.add(obj as GameObj<AreaComp>);
                }
            });
            onDestroy(obj => {
                sap.remove(obj as GameObj<AreaComp>);
            });
            onUse((obj, id) => {
                if (id === "area") {
                    sap.add(obj as GameObj<AreaComp>);
                }
            });
            onUnuse((obj, id) => {
                if (id === "area") {
                    sap.remove(obj as GameObj<AreaComp>);
                }
            });
            onSceneLeave(() => {
                sapInit = false;
                sap.clear();
            });
            for (const obj of _k.game.root.get("*", { recursive: true })) {
                if (obj.has("area")) {
                    sap.add(obj as GameObj<AreaComp>);
                }
            }
        }

        sap.update();
        for (const [obj1, obj2] of sap) {
            narrowPhase(obj1, obj2);
        }
    }

    function switchBroadPhaseAlgo(algo: KAPLAYOpt["sapDirection"]) {
        if (sap) sap.clear();
        sap = (() => {
            switch (algo) {
                case "both": return new SweepAndPruneBoth();
                case "vertical": return new SweepAndPruneVertical();
                case "hashgrid": return new HashGrid(_k.globalOpt);
                case "quadtree": return new Quadtree(new Rect(vec2(0), width(), height()), _k.globalOpt.qtMaxObjects, _k.globalOpt.qtMaxLevels);
                default: return new SweepAndPruneHorizontal();
            }
        })();
        sapInit = false;
    }
    switchBroadPhaseAlgo(_k.globalOpt.sapDirection);

    function cleanBroadPhase() {
        if (sap && sap.clean) sap.clean();
    }

    function checkFrame() {
        if (!usesArea()) {
            return;
        }

        return broadPhase();
    }

    return {
        checkFrame,
        cleanBroadPhase,
        switchBroadPhaseAlgo
    };
};
