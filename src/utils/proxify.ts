export function proxify<T extends object>(obj: T, onChange: () => void): T {
    return new Proxy(obj, {
        set(target, prop, value) {
            target[prop as keyof T] = value;
            onChange();
            return true;
        },
    });
}
