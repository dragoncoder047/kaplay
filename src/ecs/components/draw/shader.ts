import type { Uniform } from "../../../assets/shader";
import type { Comp } from "../../../types";

/**
 * The serialized {@link shader `shader()`} component.
 *
 * @group Components
 * @subgroup Component Serialization
 */
export interface SerializedShaderComp {
    shader: string;
}

/**
 * The {@link shader `shader()`} component.
 *
 * @group Components
 * @subgroup Component Types
 */
export interface ShaderComp extends Comp {
    /**
     * Uniform values to pass to the shader.
     */
    uniform?: Uniform;
    /**
     * If present, this will be called every frame to recalculate the uniforms.
     */
    getUniform?(): Uniform;
    /**
     * The shader ID.
     */
    shader: string;
    serialize(): SerializedShaderComp;
}

export function shader(
    id: string,
    uniform?: Uniform | (() => Uniform),
): ShaderComp {
    return {
        id: "shader",
        shader: id,
        uniform: typeof uniform === "function" ? {} : uniform,
        getUniform: typeof uniform === "function" ? uniform : undefined,
        update() {
            if (this.getUniform) this.uniform = this.getUniform();
        },
        inspect() {
            return `shader: ${this.shader}`;
        },
        serialize() {
            // TODO: serialize uniforms. How to save references to textures and stuff?
            return { shader: this.shader };
        },
    };
}

export function shaderFactory(data: SerializedShaderComp) {
    return shader(data.shader);
}
