import type { Tagged, ValueOf } from "type-fest";

/**
 * @description
 * Encodes the result of an operation that can fail with some error.
 * Enforces returning errors as values for direct control flow instead of
 * try/catch
 *
 * @notes
 * - Does not use prototypes intentionally to be more stream friendly.
 *   Remix's streaming does not allow complex classes to be serialized.
 */

export type Result<
	/** The type of a successful operation's value if the result represents a success */
	A,
	E extends Error,
> = ReturnType<typeof err<E> | typeof ok<A>>;

/**
 * @private
 */
const ResultStatus = {
	ok: 1 << 0,
	err: 1 << 1,
} as const;

interface ResultCase<A, E = unknown> {
	readonly status: ValueOf<typeof ResultStatus>;
	readonly value: A | null;
	readonly err: E | null;
}

interface _Ok<T> extends ResultCase<T> {
	err: null;
	status: typeof ResultStatus.ok;
	value: T;
}

/**
 * @description
 * A successful operation that includes the value
 *
 */
type Ok<T> = Tagged<Readonly<_Ok<T>>, "Ok">;

interface _Err<R> extends ResultCase<R> {
	err: R;
	status: typeof ResultStatus.err;
	value: null;
}

/**
 * @description
 * A non-successful operation that includes metadata for why
 *
 */
type Err<E extends Error> = Tagged<Readonly<_Err<E>>, "Err">;

export function isOk<A, E extends Error>(
	result: Result<A, E>,
): result is Ok<A> {
	return result.status === ResultStatus.ok;
}

export function isErr<A, E extends Error>(
	result: Result<A, E>,
): result is Err<E> {
	return result.status === ResultStatus.err;
}

/**
 * @description
 * Constructs an `Ok` if `value` is non-falsy and not an `Error` otherwise an
 * `Err`
 *
 */
export function result<A, E extends Error>(value?: A): Result<A, E> {
	let isError = value instanceof Error;
	if (value && !isError) {
		return ok<A>(value as A);
	}
	return err<E>(value as unknown as E);
}

/**
 * @description
 * Construct an Err
 *
 */
export function err<E extends Error>(e: E): Err<E> {
	return {
		value: null,
		status: ResultStatus.err,
		err: e,
	} as Err<E>;
}

/**
 * @description
 * Construct an Ok with a value
 *
 */
export function ok<A>(t: A) {
	return {
		value: t,
		status: ResultStatus.ok,
		err: null,
	} as Ok<A>;
}

/**
 * @description
 * Construct a result `Result` from a function that returns a `Promise`
 *
 * If the `thunk` throws when awaited, an `Err` is returned with the caught
 * error, otherwise the returned value is `Ok`
 */
export async function ofPromise<A, E extends Error>(
	thunk: () => Promise<A>,
): Promise<Result<A, E>> {
	try {
		let value = await thunk();
		return ok(value);
	} catch (error) {
		return err<E>(error as E);
	}
}

/**
 * @description
 * Construct a result from a function that can throw
 *
 * If the `throwable` throws, an `Err` is returned with the caught error,
 * otherwise the returned value is `Ok`
 */
export function ofThrowable<T, E extends Error>(
	throwable: () => T,
): Result<T, E> {
	try {
		return ok(throwable());
	} catch (e) {
		return err<E>(e as E);
	}
}

/**
 * @description
 * Transform the `A` to a new `Result` if `Ok`, otherwise the original `Err`.
 *
 * @alias `bind` \ `flatMap`
 */
export function andThen<A, B, E extends Error>(
	result: Result<A, E>,
	tx: (value: A) => Result<B, E>,
): Result<B, E> {
	if (isOk(result)) {
		return tx(result.value);
	}
	return result;
}

/**
 * @description
 * Transform the `A` to a new `B` if `Ok`, otherwise the original `Err`.
 *
 */
export function map<A, B, E extends Error>(
	result: Result<A, E>,
	tx: (value: A) => B,
): Result<B, E> {
	if (isOk(result)) {
		return ok<B>(tx(result.value));
	}
	return result;
}

/**
 * @description
 *
 * Transform the `Err` in the `Result` if present, otherwise returns the `Ok`
 *
 */
export function mapErr<A, B extends Error, E extends Error>(
	result: Result<A, E>,
	tx: (error: E) => B,
): Result<A, B> {
	if (isOk(result)) {
		return result;
	}
	return err<B>(tx(result.err as E));
}

/**
 * @description
 * Unwrap the value if `Ok` else uses the `fallback`
 */
export function valueOr<A, E extends Error>(
	result: Result<A, E>,
	fallback: A,
): A {
	if (isOk(result)) {
		return result.value;
	}
	return fallback;
}

class ResultAccessErr extends Error {
	readonly _tag = "ResultAccessErr";
}

/**
 * @description
 * Extract the value if `Ok`, else throws `ResultAccessErr`
 */
export function valueExn<A, E extends Error>(result: Result<A, E>): A {
	if (isOk(result)) {
		return result.value;
	}
	throw new ResultAccessErr("Tried to access result value that is not ok");
}

/**
 * @description
 * Combines an array of `Result`s into a single `Result`.
 *
 * Returns an `Ok` result with an array of all values from the input `Result`s
 * all `Ok`, or the first `Err` result encountered.
 */
export function combine<A, E extends Error>(
	results: ReadonlyArray<Result<A, E>>,
): Result<ReadonlyArray<A>, E> {
	let values: Array<A> = new Array(results.length).fill(null);
	let i = 0;
	for (let result of results) {
		if (isOk(result)) {
			values[i++] = result.value;
		} else {
			return result;
		}
	}
	return ok(values);
}

/**
 * @description
 * Unwrap a `Result` by handling each case
 */
export function match<A, E extends Error, U>(
	result: Result<A, E>,
	cases: {
		Ok: (value: A) => U;
		Err: (error: E) => U;
	},
): U {
	if (isOk(result)) {
		return cases.Ok(result.value);
	}
	return cases.Err(result.err as E);
}
