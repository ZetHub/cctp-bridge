import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/__tests__/**/*.test.ts"],
		testTimeout: 30_000,
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/__tests__/**",
				"src/**/index.ts",
				"src/**/*.config.ts",
				"src/wagmi/**",
				"src/ports/**",
				"src/domain/BridgeTransaction.ts",
				"src/domain/Transfer.ts",
			],
		},
	},
});
