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
    objects: GameObj<AreaComp>[];

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
                const indices = this.getIndices(this.objects[i].worldArea().bbox());
                for (let k = 0; k < indices.length; k++) {
                    this.nodes[indices[k]].add(this.objects[i]);
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
        const index = this.objects.indexOf(obj);

        if (index > -1) {
            this.objects.splice(index, 1);
        }

        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].remove(obj);
        }

        if (this.level === 0 && !fast) {
            this.join();
        }

        return index !== -1;
    }

    update(root = this): void {
        if (this.level === 0)
            this.maybe_embiggen();
        else for (let obj of this.objects) {
            // https://gamedev.stackexchange.com/a/20609
            if (this.is_oob(obj.worldArea().bbox())) {
                this.remove(obj, true);
                root.add(obj);
            }
        }
        for (let child of this.nodes) {
            child.update(root);
        }
    }

    private everything(): GameObj<AreaComp>[] {
        let allObjects = Array.from(this.objects);
        for (let i = 0; i < this.nodes.length; i++) {
            const nodeObjects = this.nodes[i].everything();
            allObjects = allObjects.concat(nodeObjects);
        }
        return allObjects;
    }

    join(): GameObj<AreaComp>[] {
        const everything = this.everything();
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
        if (this.objects.some(obj => this.is_oob(obj.worldArea().bbox()))) return true;
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
        const objs = this.everything();
        this.clear();
        this.bounds = newBounds;
        for (let obj of objs) {
            this.add(obj);
        }
    }

    private bbox_union(): Rect {
        let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE, maxX = Number.MIN_VALUE, maxY = Number.MIN_VALUE;
        const objBoxes = this.objects.map(x => x.worldArea().bbox());
        const nodeBoxes = this.nodes.map(x => x.bbox_union());
        for (let box of objBoxes.concat(nodeBoxes)) {
            minX = Math.min(minX, box.pos.x);
            minY = Math.min(minY, box.pos.y);
            maxX = Math.max(maxX, box.pos.x + box.width);
            maxY = Math.max(maxY, box.pos.y + box.height);
        }
        return new Rect(vec2(minX, minY), maxX - minX, maxY - minY);
    }

    *[Symbol.iterator](): Generator<[GameObj<AreaComp>, GameObj<AreaComp>], void, void> {
        function* processNode(node: Quadtree, ancestorObjects: GameObj<AreaComp>[]): Generator<[GameObj<AreaComp>, GameObj<AreaComp>], void, void> {
            for (let i = 0; i < node.objects.length; i++) {
                const obj1 = node.objects[i];
                // An object in this sub node can potentially collide with objects in an ancestor node
                for (const obj2 of ancestorObjects) {
                    yield [obj1, obj2];
                }
                // An object in this sub node can potentially collide with other objects in this node
                for (let j = i; j < node.objects.length; j++) {
                    yield [obj1, node.objects[j]];
                }
            }
            if (node.nodes.length > 0) {
                const allObjects = ancestorObjects.concat(node.objects)
                for (const n of node.nodes) {
                    yield* processNode(n, allObjects);
                }
            }
        }
        yield* processNode(this, []);
    }
}
