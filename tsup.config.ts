import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/server.ts"],
	format: ["esm", "cjs"],
	target: "esnext",
	outDir: "dist",
	clean: true,
	bundle: true,
	splitting: false,
	sourcemap: true,
	// require() shim for CommonJS deps inside the ESM bundle
	banner: {
		js: `
      import { createRequire } from 'module';
      const require = createRequire(import.meta.url);
    `,
	},
});
