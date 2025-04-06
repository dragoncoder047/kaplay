import type { AreaComp } from "../../ecs/components/physics/area";
import type { GameObj } from "../../types";

export interface SweepAndPruneLike {
    add(obj: GameObj<AreaComp>): void;
    remove(obj: GameObj<AreaComp>): void;
    clear(): void;
    update(): void;
    clean?(): void;
    [Symbol.iterator](): Generator<[GameObj<AreaComp>, GameObj<AreaComp>], void, void>;
}

export * from "./sweepandprune";
export * from "./quadtree";
export * from "./hashgrid";
