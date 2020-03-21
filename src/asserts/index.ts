export function assertTrue(value: any): asserts value {
    if (!value) {
        throw new Error("Assertion failure");
    }
    return value;
}


export function throwIfNotDefined<T>(value: T | undefined | null): T {
    if (!value) {
        throw new Error("Assertion failure");
    }
    return value;
}
