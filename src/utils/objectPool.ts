export interface Resettable {
    reset(): void
}

export class ObjectPool<T extends Resettable> {
    unusedObjects: T[] = [];
    factory: () => T;
    constructor(factory: () => T, initialSize: number = 16) {
        this.unusedObjects = [];
        this.factory = factory;
        for (var i = 0; i < initialSize; i++) {
            this.release(factory());
        }
    }
    get(): T {
        if (this.unusedObjects.length > 0) {
            return this.unusedObjects.pop()!;
        }
        return this.factory();
    }
    release(value: T) {
        value.reset();
        this.unusedObjects.push(value);
    }
}
