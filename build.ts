import { ensureDir } from "https://deno.land/std@0.69.0/fs/mod.ts";

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
    console.error(diagnostic);
  }

  Deno.exit(1);
}

for (const [filepath, source] of Object.entries(records)) {
  await Deno.writeTextFile(filepath, source);
}
