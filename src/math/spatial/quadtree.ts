import type { SweepAndPruneLike } from "."
import type { AreaComp } from "../../components"
import type { GameObj } from "../../types"
import { Rect, vec2 } from "../math"

enum NodeIndex {
    TR = 0,
    TL = 1,
    BL = 2,
    BR = 3,
    HERE = -1,
}

/**
 * A quadtree structure
 */
export class Quadtree implements SweepAndPruneLike {
    bounds: Rect;
    maxObjects: number;
    maxLevels: number;
    level: number;
    nodes: Quadtree[];
    objects: GameObj<AreaComp>[];

    /**
     * Creates a new quadtree
     * @param bounds The bounds of this node.
     * @param maxObjects The maximum amount of objects before triggering a split.
     * @param maxLevels The maximum amount of levels before no more splits are made.
     * @param level The current level.
     */
    constructor(
        bounds: Rect,
        maxObjects: number = 8,
        maxLevels: number = 4,
        level: number = 0,
    ) {
        this.bounds = bounds;
        this.maxObjects = maxObjects;
        this.maxLevels = maxLevels;
        this.level = level;
        this.nodes = [];
        this.objects = [];
    }

    /**
     * True if this node is a leaf node.
     */
    get isLeaf() {
        return this.nodes.length === 0;
    }

    /**
     * Splits the node, but doesn't redistribute objects
     */
    subdivide() {
        const level = this.level + 1;
        const width = this.bounds.width / 2;
        const height = this.bounds.height / 2;
        const x = this.bounds.pos.x;
        const y = this.bounds.pos.y;

        const pos = [
            vec2(x, y),
            vec2(x + width, y),
            vec2(x + width, y + height),
            vec2(x, y + height),
        ];

        for (let i = 0; i < 4; i++) {
            this.nodes[i] = new Quadtree(
                new Rect(pos[i], width, height),
                this.maxObjects,
                this.maxLevels,
                level,
            );
        }
    }

    /**
     * Tries to merge and collapse nodes which are no longer overpopulated.
     */
    merge() {
        if (this.nodes.length > 0) {
            let count = this.objects.length;
            let allLeaves = true;
            for (let i = 0; i < 4; i++) {
                this.nodes[i].merge();
                allLeaves &&= this.nodes[i].isLeaf;
                count += this.nodes[i].objects.length;
            }

            if (allLeaves && count <= this.maxObjects) {
                for (let i = 0; i < 4; i++) {
                    this.objects.push(...this.nodes[i].objects);
                }
                this.nodes = [];
            }
        }
    }

    /**
     * Returns the quadrant this rect fits in or -1 if it doesn't fit any quadrant
     * @param rect The rect to test with.
     * @returns The index of the quadrant fitting the rect completely, or -1 if none.
     */
    getQuadrant(rect: Rect): NodeIndex {
        const boundsCenterX = this.bounds.pos.x + (this.bounds.width / 2);
        const boundsCenterY = this.bounds.pos.y + (this.bounds.height / 2);
        // Left - If the right side is left of the center
        if (rect.pos.x + rect.width < boundsCenterX) {
            // Top Left - If the bottom side is above the center
            if (rect.pos.y + rect.height < boundsCenterY) {
                return NodeIndex.TL;
            }
            // Bottom Left - If the top side is below the center
            else if (rect.pos.y >= boundsCenterY) {
                return NodeIndex.BL;
            }
        }
        // Right - If the left side is right of the center
        else if (rect.pos.x >= boundsCenterX) {
            // Top Right - If the bottom side is above the center
            if (rect.pos.y + rect.height < boundsCenterY) {
                return NodeIndex.TR;
            }
            // Bottom Right - If the top side is below the center
            else if (rect.pos.y >= boundsCenterY) {
                return NodeIndex.BR;
            }
        }
        return NodeIndex.HERE;
    }

    /**
     * Returns the quadrants this rect intersects
     * @param rect The rect to test with. Note that this rect is assumed to be within the node.
     * @returns the list of quadrant indices
     */
    getQuadrants(rect: Rect): NodeIndex[] {
        const boundsCenterX = this.bounds.pos.x + (this.bounds.width / 2);
        const boundsCenterY = this.bounds.pos.y + (this.bounds.height / 2);
        const quadrants: NodeIndex[] = [];

        // Left - The left side is left of the center
        if (rect.pos.x < boundsCenterX) {
            // Top Left - If the top side is above the center
            if (rect.pos.y < boundsCenterY) {
                quadrants.push(NodeIndex.TL);
            }
            // Bottom Left - If the bottom side is below the center
            if (rect.pos.y + rect.height > boundsCenterY) {
                quadrants.push(NodeIndex.BL);
            }
        }
        // Right - If the right side is right of the center
        if (rect.pos.x + rect.width > boundsCenterX) {
            // Top Right - If the top side is above the center
            if (rect.pos.y < boundsCenterY) {
                quadrants.push(NodeIndex.TR);
            }
            // Bottom Right - If the bottom side is below the center
            if (rect.pos.y + rect.height > boundsCenterY) {
                quadrants.push(NodeIndex.BR);
            }
        }
        return quadrants;
    }

    /**
     * Inserts the object with the given rectangle
     * @param obj The object to add
     * @param bbox The bounding box of the object
     */
    insert(obj: GameObj<AreaComp>, bbox: Rect): void {
        // If we reached max objects, subdivide and redistribute
        if (this.objects.length >= this.maxObjects) {
            if (this.nodes.length === 0) {
                this.subdivide();
                // Redistribute objects
                let j = 0;
                for (let i = 0; i < this.objects.length; i++) {
                    const obj = this.objects[i];
                    const bbox = obj.screenArea().bbox();
                    const index = this.getQuadrant(bbox);
                    if (index !== NodeIndex.HERE) {
                        this.nodes[index].insert(obj, bbox);
                    }
                    else {
                        this.objects[j++] = obj;
                    }
                }
                this.objects.length = j;
            }
        }

        // Check if the object fits in a smaller quadrant
        if (this.nodes.length) {
            const index = this.getQuadrant(bbox);

            if (index !== NodeIndex.HERE) {
                this.nodes[index].insert(obj, bbox);
                return;
            }
        }

        this.objects.push(obj);
    }

    add(obj: GameObj<AreaComp>): void {
        this.insert(obj, obj.aabb());
    }

    /**
     * Retrieves all objects potentially intersecting the rectangle
     * @param rect The rect to test with
     * @returns A set of objects potentially intersecting the rectangle
     */
    retrieve(rect: Rect, objects: GameObj[]): void {
        objects.push(...this.objects);

        if (this.nodes.length) {
            const indices = this.getQuadrants(rect);
            for (let i = 0; i < indices.length; i++) {
                this.nodes[indices[i]].retrieve(rect, objects);
            }
        }
    }

    /**
     * Removes the object
     * @param obj The object to remove
     * @param fast No node collapse if true
     */
    remove(obj: GameObj<AreaComp>, fast = false): boolean {
        let index = this.objects.indexOf(obj);
        if (index != -1) {
            this.objects.splice(index, 1);
            if (!fast) {
                this.merge();
            }
            return true;
        }

        for (let i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i].remove(obj, fast)) {
                if (!fast) {
                    this.merge();
                }
                return true;
            }
        }

        return false;
    }

    /**
     * Updates a single object
     * Note that no testing is done here. Make sure the object needs to be actually updated.
     * @param root The tree root, since insertion happens from the root
     * @param obj The object to update
     * @param bbox The new bounding box
     */
    updateObject(root: Quadtree, obj: GameObj<AreaComp>, bbox: Rect): void {
        this.remove(obj);
        root.insert(obj, bbox);
    }

    /**
     * True if the rectangle is completely outside this node's bounds
     * @param bbox The bounding box to test
     */
    isOutside(bbox: Rect) {
        return bbox.pos.x + bbox.width < this.bounds.pos.x
            || bbox.pos.y + bbox.height < this.bounds.pos.y
            || bbox.pos.x > this.bounds.pos.x + this.bounds.width
            || bbox.pos.y > this.bounds.pos.y + this.bounds.height;
    }

    /**
     * True if the rectangle is completely outside this node's bounds
     * @param bbox The bounding box to test
     */
    isInside(bbox: Rect) {
        return bbox.pos.x >= this.bounds.pos.x
            && bbox.pos.y >= this.bounds.pos.y
            && bbox.pos.x + bbox.width <= this.bounds.pos.x + this.bounds.width
            && bbox.pos.y + bbox.height
                <= this.bounds.pos.y + this.bounds.height;
    }

    /**
     * Updates all objects in this node and the objects of its children
     * @param root The tree root, since insertion happens from the root
     */
    updateNode(orphans: [GameObj, Rect][]) {
        let i = 0;
        while (i < this.objects.length) {
            const obj = this.objects[i];
            const bbox = obj.worldArea().bbox();
            // If the object is outside the bounds, remove it and add it to the root later
            if (!this.isInside(bbox)) {
                orphans.push([obj, bbox]);
                this.objects.splice(i, 1);
                continue; // Don't increase i, the object at i was removed
            }
            else if (this.nodes.length > 0) {
                // If the object fits in a quadrant, remove it and add it to the quadrant
                const index = this.getQuadrant(bbox);
                if (index !== -1) {
                    // Use fast without merge, since it may remove the quadrant we are going to add it to
                    this.nodes[index].insert(obj, bbox);
                    this.objects.splice(i, 1);
                    continue; // Don't increase i, the object at i was removed
                }
            }
            i++;
        }
        // Update sub quadrants
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].updateNode(orphans);
        }
    }

    /**
     * Update this tree
     */
    update() {
        this.maybe_embiggen();
        const orphans: [GameObj<AreaComp>, Rect][] = [];
        this.updateNode(orphans);
        // Reinsert all objects that were removed because they went outside the bounds of their quadrant
        for (let i = 0; i < orphans.length; i++) {
            this.insert(orphans[i][0], orphans[i][1]);
        }
    }

    has_oob(directionsToCheck: Set<"left" | "right" | "up" | "down">): boolean {
        // Run around the outside of the quadtree and get objects only in the nodes on the edge
        if (this.objects.some(obj => this.isOutside(obj.aabb()))) return true;
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

    maybe_embiggen() {
        if (!this.has_oob(new Set(["left", "right", "up", "down"]))) return;
        const newBounds = this.bbox_union();
        const objs = this.everything();
        this.clear();
        this.bounds = newBounds;
        for (const obj of objs) {
            this.add(obj);
        }
    }

    bbox_union(): Rect {
        let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE, maxX = Number.MIN_VALUE, maxY = Number.MIN_VALUE;
        const boxes = this.objects.map(x => x.aabb());
        boxes.push(...this.nodes.map(x => x.bbox_union()));
        for (let i = 0; i < boxes.length; i++) {
            minX = Math.min(minX, boxes[i].pos.x);
            minY = Math.min(minY, boxes[i].pos.y);
            maxX = Math.max(maxX, boxes[i].pos.x + boxes[i].width);
            maxY = Math.max(maxY, boxes[i].pos.y + boxes[i].height);
        }
        return new Rect(vec2(minX, minY), maxX - minX, maxY - minY);
    }

    everything(): GameObj<AreaComp>[] {
        let allObjects = this.objects.slice();
        for (let i = 0; i < this.nodes.length; i++) {
            const nodeObjects = this.nodes[i].everything();
            allObjects.push(...nodeObjects);
        }
        return allObjects;
    }

    /**
     * Clears this node and collapses it
     */
    clear() {
        this.objects.length = 0;

        // Do we need this? It only makes sense if someone is still holding a reference to a node
        for (var i = 0; i < this.nodes.length; i++) {
            if (this.nodes.length) {
                this.nodes[i].clear();
            }
        }

        this.nodes = [];
    }

    /**
     * Gathers all collision pairs in this node and child nodes
     * @param ancestorObjects Objects in one of the node's ancestors
     * @param pairs The pairs being gathered
     */
    gatherPairs(
        ancestorObjects: Array<GameObj>,
        pairs: Array<[GameObj, GameObj]>,
    ) {
        // The objects in this node potentially collide with each other
        for (let i = 0; i < this.objects.length; i++) {
            // Note that we don't create doubles, since j = i + 1
            for (let j = i + 1; j < this.objects.length; j++) {
                pairs.push([this.objects[i], this.objects[j]]);
            }
        }

        // The objects in this node potentially collide with ancestor objects
        for (let i = 0; i < this.objects.length; i++) {
            // Note that we don't create doubles, since the lists are disjoint
            for (let j = 0; j < ancestorObjects.length; j++) {
                pairs.push([this.objects[i], ancestorObjects[j]]);
            }
        }

        // Check child nodes if any
        if (this.nodes.length) {
            // Add the local objects to the ancestors
            ancestorObjects = ancestorObjects.concat(this.objects);
            for (let i = 0; i < this.nodes.length; i++) {
                this.nodes[i].gatherPairs(ancestorObjects, pairs);
            }
        }
    }

    *[Symbol.iterator](): Generator<[GameObj<AreaComp>, GameObj<AreaComp>], void, void> {
        const pairs: Array<[GameObj<AreaComp>, GameObj<AreaComp>]> = [];
        this.gatherPairs([], pairs);
        for (let i = 0; i < pairs.length; i++) {
            yield pairs[i];
        }
    }
}
