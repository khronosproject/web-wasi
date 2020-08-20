export default async function build() {
	try {
		await Deno.mkdir("lib");
	} catch (err) {
		// no-op
	}

	const [ diagnostics, records] = await Deno.compile("src/wasi_snapshot_preview1.ts", undefined, {
		outDir: "lib",
	});

	if (diagnostics) {
		throw Error(diagnostics.join(' '));
	}

	for (const [filepath, source] of Object.entries(records)) {
		await Deno.writeTextFile(filepath, source);
	}
}

if (import.meta.main) {
	build();
}
