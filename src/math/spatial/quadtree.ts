import type { SweepAndPruneLike } from "."
import type { AreaComp } from "../../components"
import type { GameObj } from "../../types"
import { Rect, vec2 } from "../math"

enum NodeIndex {
    TR = 0,
    TL = 1,
    BL = 2,
    BR = 3,
}

export class Quadtree implements SweepAndPruneLike {
    bounds: Rect;
    maxObjects: number;
    maxLevels: number;
    level: number;
    nodes: Quadtree[];
    objects: (GameObj<AreaComp> | undefined)[];

    constructor(bounds: Rect, maxObjects: number = 8, maxLevels: number = 4, level: number = 0) {
        this.bounds = bounds;
        this.maxObjects = maxObjects;
        this.maxLevels = maxLevels;
        this.level = level;
        this.nodes = [];
        this.objects = [];
    }

    subdivide() {
        const level = this.level + 1;
        const width = this.bounds.width / 2;
        const height = this.bounds.height / 2;
        const x = this.bounds.pos.x;
        const y = this.bounds.pos.y;

        const pos = [
            vec2(x + width, y),
            vec2(x, y),
            vec2(x, y + height),
            vec2(x + width, y + height),
        ];

        for (let i = 0; i < 4; i++) {
            this.nodes[i] = new Quadtree(new Rect(pos[i], width, height),
                this.maxObjects,
                this.maxLevels, level);
        }
    }

    getIndices(rect: Rect): NodeIndex[] {
        const indices: NodeIndex[] = [];
        const boundsCenterX = this.bounds.pos.x + (this.bounds.width / 2);
        const boundsCenterY = this.bounds.pos.y + (this.bounds.height / 2);

        const topLeftIsUp = rect.pos.y < boundsCenterY;
        const topLeftIsLeft = rect.pos.x < boundsCenterX;
        const bottomRightIsRight = rect.pos.x + rect.width > boundsCenterX;
        const bottomRightIsDown = rect.pos.y + rect.height > boundsCenterY;

        if (topLeftIsUp && bottomRightIsRight) {
            indices.push(NodeIndex.TR);
        }

        if (topLeftIsLeft && topLeftIsUp) {
            indices.push(NodeIndex.TL);
        }

        if (topLeftIsLeft && bottomRightIsDown) {
            indices.push(NodeIndex.BL);
        }

        if (bottomRightIsRight && bottomRightIsDown) {
            indices.push(NodeIndex.BR);
        }

        return indices;
    }

    add(obj: GameObj<AreaComp>) {
        const rect = obj.worldArea().bbox();

        if (this.nodes.length) {
            const indices = this.getIndices(rect);

            for (let i = 0; i < indices.length; i++) {
                this.nodes[indices[i]].add(obj);
            }
            return;
        }

        this.objects.push(obj);

        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {

            if (!this.nodes.length) {
                this.subdivide();
            }

            for (let i = 0; i < this.objects.length; i++) {
                const obj = this.objects[i];
                if (!obj) continue;
                const indices = this.getIndices(obj.worldArea().bbox());
                for (let k = 0; k < indices.length; k++) {
                    this.nodes[indices[k]].add(obj);
                }
            }

            this.objects = [];
        }
    }

    retrieve(rect: Rect) {
        const indices = this.getIndices(rect);
        let retrievedObjects = this.objects;

        if (this.nodes.length) {
            for (let i = 0; i < indices.length; i++) {
                retrievedObjects = retrievedObjects.concat(this.nodes[indices[i]].retrieve(rect));
            }
        }

        if (this.level === 0) {
            return Array.from(new Set(retrievedObjects));
        }

        return retrievedObjects;
    }

    remove(obj: GameObj<AreaComp>, fast = false): boolean {
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].remove(obj);
        }
        if (fast) return true;
        const index = this.objects.indexOf(obj);
        if (index > -1) {
            this.objects[index] = undefined;
        }
        if (this.level === 0) {
            this.join();
        }
        return index !== -1;
    }

    update(root = this): void {
        if (this.level === 0)
            this.maybe_embiggen();
        else {
            let keep: GameObj<AreaComp>[] = [];
            let readd: GameObj<AreaComp>[] = [];
            for (let i = 0; i < this.objects.length; i++) {
                const obj = this.objects[i];
                if (!obj) continue;
                // https://gamedev.stackexchange.com/a/20609
                if (this.is_oob(obj.worldArea().bbox())) readd.push(obj);
                else keep.push(obj);
            }
            for (let i = 0; i < readd.length; i++) {
                this.remove(readd[i], true);
            }
            this.objects = keep;
            for (let i = 0; i < readd.length; i++) {
                root.add(readd[i]);
            }
        }
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].update(root);
        }
    }

    private everything(): (GameObj<AreaComp> | undefined)[] {
        let allObjects = Array.from(this.objects);
        for (let i = 0; i < this.nodes.length; i++) {
            const nodeObjects = this.nodes[i].everything();
            allObjects.push(...nodeObjects);
        }
        return allObjects;
    }

    join(): GameObj<AreaComp>[] {
        const everything = this.everything().filter(obj => obj !== undefined);
        const uniqueObjects = Array.from(new Set(everything));
        if (uniqueObjects.length <= this.maxObjects) {
            this.objects = uniqueObjects;
            for (let i = 0; i < this.nodes.length; i++) {
                this.nodes[i].objects = [];
            }
            this.nodes = [];
        }

        return everything;
    }

    clear() {
        this.objects = [];
        // XXX Is this necessary?
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].clear();
        }
        this.nodes = [];
    }

    private is_oob(rect: Rect) {
        return rect.pos.x < this.bounds.pos.x ||
            rect.pos.y < this.bounds.pos.y ||
            rect.pos.x + rect.width > this.bounds.pos.x + this.bounds.width ||
            rect.pos.y + rect.height > this.bounds.pos.y + this.bounds.height;
    }

    private has_oob(directionsToCheck: Set<"left" | "right" | "up" | "down">): boolean {
        // Run around the outside of the quadtree and get objects only in the nodes on the edge
        if (this.objects.some(obj => obj && this.is_oob(obj.worldArea().bbox()))) return true;
        if (this.nodes.length === 0) return false;
        if (directionsToCheck.size === 0) return false;
        const memoized = (expensive: () => boolean): (() => boolean) => {
            let result: boolean | undefined;
            return () => {
                if (result !== undefined) return result;
                return result = expensive();
            };
        };
        const brHasOOB = memoized(() => this.nodes[NodeIndex.BR]?.has_oob(directionsToCheck.intersection(new Set(["right", "down"]))));
        const blHasOOB = memoized(() => this.nodes[NodeIndex.BL]?.has_oob(directionsToCheck.intersection(new Set(["left", "down"]))));
        const trHasOOB = memoized(() => this.nodes[NodeIndex.TR]?.has_oob(directionsToCheck.intersection(new Set(["right", "up"]))));
        const tlHasOOB = memoized(() => this.nodes[NodeIndex.TL]?.has_oob(directionsToCheck.intersection(new Set(["left", "up"]))));
        if (directionsToCheck.has("left")) {
            if (tlHasOOB() || blHasOOB()) return true;
        }
        if (directionsToCheck.has("right")) {
            if (trHasOOB() || brHasOOB()) return true;
        }
        if (directionsToCheck.has("up")) {
            if (tlHasOOB() || trHasOOB()) return true;
        }
        if (directionsToCheck.has("down")) {
            if (blHasOOB() || brHasOOB()) return true;
        }
        return false;
    }

    private maybe_embiggen() {
        if (!this.has_oob(new Set(["left", "right", "up", "down"]))) return;
        const newBounds = this.bbox_union();
        const objs = this.everything().filter(obj => obj !== undefined);
        this.clear();
        this.bounds = newBounds;
        for (let i = 0; i < objs.length; i++) {
            this.add(objs[i]);
        }
    }

    private bbox_union(): Rect {
        let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE, maxX = Number.MIN_VALUE, maxY = Number.MIN_VALUE;
        const boxes = this.objects.flatMap(x => x ? [x.worldArea().bbox()] : []);
        boxes.push(...this.nodes.map(x => x.bbox_union()));
        for (let i = 0; i < boxes.length; i++) {
            minX = Math.min(minX, boxes[i].pos.x);
            minY = Math.min(minY, boxes[i].pos.y);
            maxX = Math.max(maxX, boxes[i].pos.x + boxes[i].width);
            maxY = Math.max(maxY, boxes[i].pos.y + boxes[i].height);
        }
        return new Rect(vec2(minX, minY), maxX - minX, maxY - minY);
    }

    *[Symbol.iterator](): Generator<[GameObj<AreaComp>, GameObj<AreaComp>], void, void> {
        function* processNode(node: Quadtree, ancestorObjects: (GameObj<AreaComp> | undefined)[]): Generator<[GameObj<AreaComp>, GameObj<AreaComp>], void, void> {
            for (let i = 0; i < node.objects.length; i++) {
                const obj1 = node.objects[i];
                if (!obj1) continue;
                // An object in this sub node can potentially collide with objects in an ancestor node
                for (let j = 0; j < ancestorObjects.length; j++) {
                    const obj2 = ancestorObjects[j];
                    if (!obj2) continue;
                    yield [obj1, obj2];
                }
                // An object in this sub node can potentially collide with other objects in this node
                for (let j = i; j < node.objects.length; j++) {
                    const obj2 = node.objects[j]
                    if (!obj2) continue;
                    yield [obj1, obj2];
                }
            }
            if (node.nodes.length > 0) {
                const allObjects = ancestorObjects.concat(node.objects)
                for (let i = 0; i < node.nodes.length; i++) {
                    yield* processNode(node.nodes[i], allObjects);
                }
            }
        }
        yield* processNode(this, []);
    }
}
