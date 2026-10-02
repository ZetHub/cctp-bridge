export function xdrField<T>(source: object, key: string): T {
	const value: unknown = Reflect.get(source, key);
	return (typeof value === "function" ? value.call(source) : value) as T;
}
