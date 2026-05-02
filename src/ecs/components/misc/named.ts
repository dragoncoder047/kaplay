import type { Comp } from "../../../types";

/**
 * The serialized {@link named `named()`} component.
 *
 * @group Components
 * @subgroup Component Serialization
 */
export interface SerializedNameComp {
    name: string;
}

/**
 * The {@link named `named()`} component.
 *
 * @group Components
 * @subgroup Component Types
 */
export interface NamedComp extends Comp {
    /** The name assigned to this object. */
    name: string;
    serialize(): SerializedNameComp;
}

export function named(name: string): NamedComp {
    return {
        id: "named",
        name,
        serialize() {
            return { name: this.name };
        },
    };
}

export function nameFactory(data: SerializedNameComp) {
    return named(data.name);
}
