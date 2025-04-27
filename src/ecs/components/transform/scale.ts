import { Vec2, vec2, type Vec2Args } from "../../../math/math";
import type { Comp } from "../../../types";
import { proxify } from "../../../utils/proxify";
import { DirtyFlags } from "../../entity/GameObjRaw";

/**
 * The {@link scale `scale()`} component.
 *
 * @group Component Types
 */
export interface ScaleComp extends Comp {
    /**
     * The current scale of the object
     *
     * @returns The current scale of the object as a {@link Vec2 `Vec2`}
     */
    scale: Vec2;
    /**
     * Set the scale of the object to a number
     */
    scaleTo(s: number): void;
    /**
     * Set the scale of the object to a Vec2
     */
    scaleTo(s: Vec2): void;
    /**
     * Set the scale of the object to a number for x and y
     */
    scaleTo(sx: number, sy: number): void;
    /**
     * Scale the object by a number
     */
    scaleBy(s: number): void;
    /**
     * Scale the object by a Vec2
     */
    scaleBy(s: Vec2): void;
    /**
     * Scale the object by a number for x and y
     */
    scaleBy(sx: number, sy: number): void;
}

export function scale(...args: Vec2Args): ScaleComp {
    if (args.length === 0) {
        return scale(1);
    }

    let _scale: Vec2;

    return {
        id: "scale",
        add() {
            this.scale = vec2(...args);
        },
        set scale(value: Vec2) {
            if (!(value instanceof Vec2)) {
                throw Error(
                    "The scale property on scale is a vector. Use scaleTo or scaleBy to set the scale with a number.",
                );
            }
            const onchange = () => (this as any)._dirtyFlags |= DirtyFlags.All;
            _scale = proxify(vec2(value), onchange);
            onchange();
        },
        get scale() {
            return _scale;
        },
        scaleTo(...args: Vec2Args) {
            this.scale = vec2(...args);
        },
        scaleBy(...args: Vec2Args) {
            this.scale = this.scale.scale(vec2(...args));
        },
        inspect() {
            if (_scale.x == _scale.y) {
                return `scale: ${_scale.x.toFixed(1)}x`;
            }
            else {
                return `scale: (${_scale.x.toFixed(1)}x, ${_scale.y.toFixed(1)
                    }y)`;
            }
        },
    };
}
