import { ensureDir } from "https://deno.land/std/fs/mod.ts";

await ensureDir("lib");

const [diagnostics, records] = await Deno.compile(
  "src/wasi_snapshot_preview1.ts",
  undefined,
  {
    outDir: "lib",
  },
);

if (diagnostics) {
  for (const diagnostic of diagnostics) {
    console.error(diagnostics);
  }

  Deno.exit(1);
}

for (const [filepath, source] of Object.entries(records)) {
  await Deno.writeTextFile(filepath, source);
}
