import type { SweepAndPruneLike } from "."
import type { AreaComp } from "../../components"
import type { GameObj } from "../../types"
import { Rect, vec2 } from "../math"

enum NodeIndex {
    TR = 0,
    TL = 1,
    BL = 2,
    BR = 3,
    NOWHERE = -1,
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

    objects: Set<GameObj>;

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
        this.objects = new Set();
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
            let count = this.objects.size;
            let allLeaves = true;
            for (let i = 0; i < 4; i++) {
                this.nodes[i].merge();
                allLeaves &&= this.nodes[i].isLeaf;
                count += this.nodes[i].objects.size;
            }

            if (allLeaves && count <= this.maxObjects) {
                for (let i = 0; i < 4; i++) {
                    this.objects = this.objects.union(this.nodes[i].objects);
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
        return NodeIndex.NOWHERE;
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
    insert(obj: GameObj<any>, bbox: Rect): void {
        // If we reached max objects, subdivide and redistribute
        if (this.objects.size >= this.maxObjects) {
            if (this.nodes.length === 0) {
                this.subdivide();
                // Redistribute objects
                const objects = [...this.objects];
                this.objects.clear();
                for (const obj of objects) {
                    const bbox = obj.screenArea().bbox();
                    const index = this.getQuadrant(bbox);
                    if (index !== NodeIndex.NOWHERE) {
                        this.nodes[index].insert(obj, bbox);
                    }
                    else {
                        this.objects.add(obj);
                    }
                }
            }
        }

        // Check if the object fits in a smaller quadrant
        if (this.nodes.length) {
            const index = this.getQuadrant(bbox);

            if (index !== NodeIndex.NOWHERE) {
                this.nodes[index].insert(obj, bbox);
                return;
            }
        }

        this.objects.add(obj);
    }

    add(obj: GameObj<AreaComp>): void {
        this.insert(obj, obj.worldArea().bbox());
    }

    /**
     * Retrieves all objects potentially intersecting the rectangle
     * @param rect The rect to test with
     * @returns A set of objects potentially intersecting the rectangle
     */
    retrieve(rect: Rect): Set<GameObj> {
        let retrievedObjects = this.objects;

        if (this.nodes.length) {
            const indices = this.getQuadrants(rect);
            for (var i = 0; i < indices.length; i++) {
                retrievedObjects = retrievedObjects.union(
                    this.nodes[indices[i]].retrieve(rect),
                );
            }
        }

        return retrievedObjects;
    }

    /** 
     * Removes the object
     * @param obj The object to remove
     * @param fast No node collapse if true
     */
    remove(obj: GameObj<any>, fast = false): boolean {
        if (this.objects.delete(obj)) {
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
     * 
     */
    updateObject(root: Quadtree, obj: GameObj<any>, bbox: Rect): void {
        this.remove(obj);
        root.insert(obj, bbox);
    }

    /** 
     * True if the rectangle is outside this node's bounds
     * @param bbox The bounding box to test
     */
    isOutside(bbox: Rect) {
        return bbox.pos.x + bbox.width < this.bounds.pos.x
            || bbox.pos.y + bbox.height < this.bounds.pos.y
            || bbox.pos.x > this.bounds.pos.x + this.bounds.width
            || bbox.pos.y > this.bounds.pos.y + this.bounds.height;
    }

    /**
     * Updates all objects in this node and the objects of its children
     * @param root The tree root, since insertion happens from the root
     */
    updateNode(root: Quadtree) {
        for (const obj of this.objects) {
            const bbox = obj.screenArea().bbox();
            // If the object is outside the bounds, remove it and add it to the root
            if (this.isOutside(bbox)) {
                this.objects.delete(obj);
                root.insert(obj, bbox);
            }
            else if (this.nodes.length > 0) {
                // If the object fits in a quadrant, remove it and add it to the quadrant
                const index = this.getQuadrant(bbox);
                if (index !== -1) {
                    // Use fast without merge, since it may remove the quadrant we are going to add it to
                    this.objects.delete(obj);
                    this.nodes[index].insert(obj, bbox);
                }
            }
        }
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].updateNode(root);
        }
    }

    /**
     * Update this tree
     */
    update() {
        this.updateNode(this);
    }

    /**
     * Clears this node and collapses it
     */
    clear() {
        this.objects.clear();

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
        const objects = [...this.objects];
        for (let i = 0; i < objects.length; i++) {
            // Note that we don't create doubles, since j = i + 1
            for (let j = i + 1; j < objects.length; j++) {
                pairs.push([objects[i], objects[j]]);
            }
        }

        // The objects in this node potentially collide with ancestor objects
        for (let i = 0; i < objects.length; i++) {
            // Note that we don't create doubles, since the lists are disjoint
            for (let j = 0; j < ancestorObjects.length; j++) {
                pairs.push([objects[i], ancestorObjects[j]]);
            }
        }

        // Check child nodes if any
        if (this.nodes.length) {
            // Add the local objects to the ancestors
            ancestorObjects = ancestorObjects.concat(objects);
            for (let i = 0; i < this.nodes.length; i++) {
                this.nodes[i].gatherPairs(ancestorObjects, pairs);
            }
        }
    }

    *[Symbol.iterator](): Generator<[GameObj<AreaComp>, GameObj<AreaComp>], void, void> {
        const pairs: Array<[GameObj<AreaComp>, GameObj<AreaComp>]> = [];
        this.gatherPairs([], pairs);
        for (const pair of pairs) {
            yield pair;
        }
    }
}
