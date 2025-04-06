import type { SweepAndPruneLike } from ".";
import { DEF_HASH_GRID_SIZE } from "../../constants";
import type { AreaComp } from "../../ecs/components/physics/area";
import type { GameObj } from "../../types";
import { calcWorldTransform } from "../various";

export class HashGrid implements SweepAndPruneLike {
    private cellSize: number;
    private objects: GameObj<AreaComp>[];
    private grid: Record<number, Record<number, GameObj<AreaComp>[]>>;
    constructor(gopt: any) {
        this.cellSize = gopt.hashGridSize || DEF_HASH_GRID_SIZE;
        this.objects = [];
        this.grid = {};
    }

    add(obj: GameObj<AreaComp>) {
        this.objects.push(obj);
    }

    remove(obj: GameObj<AreaComp>) {
        const index = this.objects.indexOf(obj);
        if (index >= 0) {
            this.objects.splice(index, 1);
        }
    }

    clear() {
        this.objects = [];
    }

    update() {
        // Update edge data
        for (const obj of this.objects) {
            calcWorldTransform(obj, obj.worldTransform);
        }
    }

    /**
     * Iterates all object pairs which potentially collide
     */
    *[Symbol.iterator](): Generator<[GameObj<AreaComp>, GameObj<AreaComp>], void, void> {
        for (const obj of this.objects) {
            const area = obj.worldArea();
            const bbox = area.bbox();

            // Get spatial hash grid coverage
            const xMin = Math.floor(bbox.pos.x / this.cellSize);
            const yMin = Math.floor(bbox.pos.y / this.cellSize);
            const xMax = Math.ceil((bbox.pos.x + bbox.width) / this.cellSize);
            const yMax = Math.ceil((bbox.pos.y + bbox.height) / this.cellSize);

            // Cache objects that are already checked with this object
            const checked = new Set();

            // insert & check against all covered grids
            for (let x = xMin; x <= xMax; x++) {
                for (let y = yMin; y <= yMax; y++) {
                    if (!this.grid[x]) {
                        this.grid[x] = {};
                        this.grid[x][y] = [obj];
                    }
                    else if (!this.grid[x][y]) {
                        this.grid[x][y] = [obj];
                    }
                    else {
                        const cell = this.grid[x][y];
                        for (const other of cell) {
                            if (checked.has(other.id)) continue;
                            yield [obj, other];
                            checked.add(other.id);
                        }
                        cell.push(obj);
                    }
                }
            }
        }
    }
}
