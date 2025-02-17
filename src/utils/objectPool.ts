export interface Resettable {
    reset(): void
}

interface PoolEntry<T extends Resettable> {
    value: T
    next?: PoolEntry<T>
}

export class ObjectPool<T extends Resettable> {
    unusedObjects: PoolEntry<T> | undefined;
    factory: () => T;
    constructor(factory: () => T, initialSize: number = 16) {
        this.unusedObjects = undefined;
        this.factory = factory;
        for (var i = 0; i < initialSize; i++) {
            this.release(factory());
        }
    }
    get(): T {
        if (this.unusedObjects) {
            const value: T = this.unusedObjects.value;
            this.unusedObjects = this.unusedObjects.next;
            return value;
        }
        return this.factory();
    }
    release(value: T) {
        value.reset();
        this.unusedObjects = { value, next: this.unusedObjects };
    }
}
