import * as fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import {
	type Result,
	andThen,
	combine,
	err,
	isErr,
	isOk,
	map,
	mapErr,
	match,
	ofPromise,
	ofThrowable,
	ok,
	result,
	valueExn,
	valueOr,
} from "./resulta.ts";

describe("Result module", () => {
	describe("isOk and isErr", () => {
		it("should correctly identify Ok and Err results", () => {
			fc.assert(
				fc.property(fc.anything(), (value) => {
					const okResult = ok(value);
					const errResult = err(new Error("test error"));

					expect(isOk(okResult)).toBe(true);
					expect(isErr(okResult)).toBe(false);
					expect(isOk(errResult)).toBe(false);
					expect(isErr(errResult)).toBe(true);
				}),
			);
		});
	});

	describe("result", () => {
		it("should create an Ok result when given a value that is not undefined, null, or an error", () => {
			fc.assert(
				fc.property(fc.anything(), (value) => {
					fc.pre(Boolean(value));
					fc.pre(!(value instanceof Error));
					const r = result(value);
					expect(isOk(r)).toBe(true);
					expect(r.value).toBe(value);
				}),
			);
		});

		it("should create an Err result when not given a value", () => {
			const r = result();
			expect(isErr(r)).toBe(true);
		});
	});

	describe("err and ok", () => {
		it("should create Err and Ok results", () => {
			fc.assert(
				fc.property(fc.anything(), fc.string(), (value, errorMsg) => {
					const okResult = ok(value);
					const errResult = err(new Error(errorMsg));

					expect(isOk(okResult)).toBe(true);
					expect(okResult.value).toBe(value);
					expect(isErr(errResult)).toBe(true);
					expect(errResult.err).toBeInstanceOf(Error);
					expect(errResult.err.message).toBe(errorMsg);
				}),
			);
		});
	});

	describe("ofPromise", () => {
		it("should handle resolved promises", async () => {
			await fc.assert(
				fc.asyncProperty(fc.anything(), async (value) => {
					const r = await ofPromise(() => Promise.resolve(value));
					expect(isOk(r)).toBe(true);
					expect(r.value).toBe(value);
				}),
			);
		});

		it("should handle rejected promises", async () => {
			await fc.assert(
				fc.asyncProperty(fc.string(), async (errorMsg) => {
					const r = await ofPromise(() => Promise.reject(new Error(errorMsg)));
					const res = isErr(r);
					expect(res).toBe(true);
					if (res) {
						expect(r.err).toBeInstanceOf(Error);
						expect(r.err.message).toBe(errorMsg);
					}
				}),
			);
		});
	});

	describe("ofThrowable", () => {
		it("should return Ok for non-throwing functions", () => {
			fc.assert(
				fc.property(fc.anything(), (value) => {
					const r = ofThrowable(() => value);
					expect(isOk(r)).toBe(true);
					expect(r.value).toBe(value);
				}),
			);
		});

		it("should return Err for throwing functions", () => {
			fc.assert(
				fc.property(fc.string(), (errorMsg) => {
					const r = ofThrowable(() => {
						throw new Error(errorMsg);
					});
					expect(isErr(r)).toBe(true);
					expect(r.err).toBeInstanceOf(Error);
					expect(r.err?.message).toBe(errorMsg);
				}),
			);
		});
	});

	describe("map", () => {
		it("should apply the transformation to Ok results", () => {
			fc.assert(
				fc.property(fc.integer(), (value) => {
					const r = ok(value);
					const mapped = map(r, (x) => x * 2);
					expect(isOk(mapped)).toBe(true);
					expect(mapped.value).toBe(value * 2);
				}),
			);
		});

		it("should not apply the transformation to Err results", () => {
			fc.assert(
				fc.property(fc.string(), (errorMsg) => {
					const r = err(new Error(errorMsg));
					const mapped = map(r, (x) => x);
					expect(isErr(mapped)).toBe(true);
					expect(mapped.err).toBeInstanceOf(Error);
					expect(mapped.err?.message).toBe(errorMsg);
				}),
			);
		});
	});

	describe("mapErr", () => {
		it("should apply the transformation to Err results", () => {
			fc.assert(
				fc.property(fc.string(), fc.string(), (errorMsg, newErrorMsg) => {
					const r = err(new Error(errorMsg));
					const mapped = mapErr(r, () => new Error(newErrorMsg));
					expect(isErr(mapped)).toBe(true);
					expect(mapped.err).toBeInstanceOf(Error);
					expect(mapped.err?.message).toBe(newErrorMsg);
				}),
			);
		});

		it("should not apply the transformation to Ok results", () => {
			fc.assert(
				fc.property(fc.anything(), (value) => {
					const r = ok(value);
					const mapped = mapErr(r, () => new Error("New error"));
					expect(isOk(mapped)).toBe(true);
					expect(mapped.value).toBe(value);
				}),
			);
		});
	});

	describe("valueOr", () => {
		it("should return the value for Ok results", () => {
			fc.assert(
				fc.property(fc.anything(), fc.anything(), (value, fallback) => {
					const r = ok(value);
					expect(valueOr(r, fallback)).toBe(value);
				}),
			);
		});

		it("should return the fallback for Err results", () => {
			fc.assert(
				fc.property(fc.anything(), (fallback) => {
					const r = err(new Error("test error"));
					expect(valueOr(r, fallback)).toBe(fallback);
				}),
			);
		});
	});

	describe("valueExn", () => {
		it("should return the value for Ok results", () => {
			fc.assert(
				fc.property(fc.anything(), (value) => {
					const r = ok(value);
					expect(valueExn(r)).toBe(value);
				}),
			);
		});

		it("should throw for Err results", () => {
			fc.assert(
				fc.property(fc.string(), (errorMsg) => {
					const r = err(new Error(errorMsg));

					expect(() => valueExn(r)).throws(
						Error,
						"Tried to access result value that is not ok",
					);
				}),
			);
		});
	});

	describe("combine", () => {
		it("should return Ok with all values if all results are Ok", () => {
			fc.assert(
				fc.property(fc.array(fc.anything()), (values) => {
					const results = values.map(ok);
					const combined = combine(results);
					expect(isOk(combined)).toBe(true);
					expect(combined.value).toEqual(values);
				}),
			);
		});

		it("should return the first Err if any result is Err", () => {
			fc.assert(
				fc.property(
					fc.array(fc.anything()),
					fc.string(),
					fc.nat(),
					(values, errorMsg, errorIndex) => {
						const results = values.map((x) => ok(x));
						const error = new Error(errorMsg);
						// @ts-ignore
						results[errorIndex % (values.length + 1)] = err(error);
						const combined = combine(results);
						expect(isErr(combined)).toBe(true);
						expect(combined.err).toBe(error);
					},
				),
			);
		});
	});

	describe("match", () => {
		it("should call Ok handler for Ok results", () => {
			fc.assert(
				fc.property(fc.anything(), (value) => {
					const r = ok(value);

					const mockOk = vi.fn((x) => x);
					const mockErr = vi.fn();
					const result = match(r, {
						Ok: mockOk,
						Err: mockErr,
					});

					expect(mockErr).not.toHaveBeenCalled();
					expect(mockOk).toHaveBeenCalledOnce();
					expect(result).toBe(value);
				}),
			);
		});

		it("should call Err handler for Err results", () => {
			fc.assert(
				fc.property(fc.string(), (errorMsg) => {
					const r = err(new Error(errorMsg));

					const mockOk = vi.fn();
					const errVal = "ERR~";
					const mockErr = vi.fn(() => errVal);
					const result = match(r, {
						Ok: mockOk,
						Err: mockErr,
					});

					expect(mockOk).not.toHaveBeenCalled();
					expect(mockErr).toHaveBeenCalledOnce();
					expect(result).toEqual(errVal);
				}),
			);
		});
	});

	describe("andThen", () => {
		it("should transform Ok results and call the transform function", () => {
			fc.assert(
				fc.property(
					fc.anything(),
					fc.anything(),
					(initialValue, transformedValue) => {
						const initialResult = ok(initialValue);
						const transform = vi.fn(() => ok(transformedValue));

						const result = andThen(initialResult, transform);

						expect(isOk(result)).toBe(true);
						expect(result.value).toBe(transformedValue);
						expect(transform).toHaveBeenCalledOnce();
						expect(transform).toHaveBeenCalledWith(initialValue);
					},
				),
			);
		});

		it("should not call transform function for Err results", () => {
			fc.assert(
				fc.property(fc.string(), (errorMessage) => {
					const initialResult = err(new Error(errorMessage));
					const transform = vi.fn(() => ok("This should not be reached"));

					const result = andThen(initialResult, transform);

					expect(isErr(result)).toBe(true);
					expect(result.err).toBeInstanceOf(Error);
					expect(result.err?.message).toBe(errorMessage);
					expect(transform).not.toHaveBeenCalled();
				}),
			);
		});

		it("should allow transformation to Err results", () => {
			fc.assert(
				fc.property(
					fc.anything(),
					fc.string(),
					(initialValue, errorMessage) => {
						const initialResult = ok(initialValue);
						const transform = vi.fn(() => err(new Error(errorMessage)));

						const result = andThen(initialResult, transform);

						expect(isErr(result)).toBe(true);
						expect(result.err).toBeInstanceOf(Error);
						expect(result.err?.message).toBe(errorMessage);
						expect(transform).toHaveBeenCalledOnce();
						expect(transform).toHaveBeenCalledWith(initialValue);
					},
				),
			);
		});

		it("should chain multiple transformations", () => {
			fc.assert(
				fc.property(fc.integer(), (initialValue) => {
					const initialResult = ok(initialValue);
					const double = vi.fn((x: number) => ok(x * 2));
					const addOne = vi.fn((x: number) => ok(x + 1));

					const result = andThen(andThen(initialResult, double), addOne);

					expect(isOk(result)).toBe(true);
					expect(result.value).toBe(initialValue * 2 + 1);
					expect(double).toHaveBeenCalledOnce();
					expect(double).toHaveBeenCalledWith(initialValue);
					expect(addOne).toHaveBeenCalledOnce();
					expect(addOne).toHaveBeenCalledWith(initialValue * 2);
				}),
			);
		});

		it("should short-circuit on first Err in a chain", () => {
			fc.assert(
				fc.property(fc.integer(), fc.string(), (initialValue, errorMessage) => {
					const initialResult = ok(initialValue);
					const double = vi.fn((x: number) => ok(x * 2));
					const failOnEven = vi.fn((x: number) =>
						x % 2 === 0 ? err(new Error(errorMessage)) : ok(x),
					);
					const addOne = vi.fn((x: number) => ok(x + 1));

					const result = andThen(
						andThen(andThen(initialResult, double), failOnEven),
						addOne,
					);

					expect(isErr(result)).toBe(true);
					expect(result.err).toBeInstanceOf(Error);
					expect(result.err?.message).toBe(errorMessage);
					expect(double).toHaveBeenCalledOnce();
					expect(failOnEven).toHaveBeenCalledOnce();
					expect(addOne).not.toHaveBeenCalled();
				}),
			);
		});

		it("should work with different types in the chain", () => {
			fc.assert(
				fc.property(fc.integer(), fc.string(), (initialValue, stringValue) => {
					const initialResult = ok(initialValue);
					const pp = vi.fn((x: number) => ok(x.toString()));
					const appendString = vi.fn((x: string) => ok(x + stringValue));

					const result = andThen(andThen(initialResult, pp), appendString);

					expect(isOk(result)).toBe(true);
					expect(result.value).toBe(initialValue.toString() + stringValue);
					expect(pp).toHaveBeenCalledOnce();
					expect(pp).toHaveBeenCalledWith(initialValue);
					expect(appendString).toHaveBeenCalledOnce();
					expect(appendString).toHaveBeenCalledWith(initialValue.toString());
				}),
			);
		});

		it("should maintain the original error type", () => {
			class CustomError extends Error {
				constructor(message: string) {
					super(message);
					this.name = "CustomError";
				}
			}

			fc.assert(
				fc.property(fc.string(), (errorMessage) => {
					const initialResult: Result<number, CustomError> = err(
						new CustomError(errorMessage),
					);
					const transform = vi.fn((x: number) => ok(x * 2));

					const result = andThen(initialResult, transform);

					expect(isErr(result)).toBe(true);
					expect(result.err).toBeInstanceOf(CustomError);
					expect(result.err?.message).toBe(errorMessage);
					expect(result.err?.name).toBe("CustomError");
					expect(transform).not.toHaveBeenCalled();
				}),
			);
		});
	});
});
