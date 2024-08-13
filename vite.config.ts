/// <reference types="vitest" />
import * as fs from "node:fs";
import { defineConfig } from "vite";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));

export default defineConfig({
	build: {
		lib: {
			entry: pkg.exports["."].development,
			formats: ["es"],
		},
	},

	test: {
		coverage: {
			provider: "v8",
		},
		poolOptions: {
			threads: {
				useAtomics: true,
			},
		},
	},
});
