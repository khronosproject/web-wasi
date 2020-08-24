import {
  serve,
} from "https://deno.land/std/http/server.ts";

import {
  serveFile,
} from "https://deno.land/std/http/file_server.ts";

import {
  browse,
} from "https://deno.land/x/web@0.1.0/browser/mod.ts";

const ignore = [
  "tests/std_env_args_none.wasm",
  "tests/std_env_args_some.wasm",
  "tests/std_fs_create_dir_absolute.wasm",
  "tests/std_fs_create_dir_relative.wasm",
  "tests/std_fs_file_create_absolute.wasm",
  "tests/std_fs_file_create_relative.wasm",
  "tests/std_fs_file_metadata_absolute.wasm",
  "tests/std_fs_file_metadata_relative.wasm",
  "tests/std_fs_file_seek_absolute.wasm",
  "tests/std_fs_file_seek_relative.wasm",
  "tests/std_fs_file_set_len_absolute.wasm",
  "tests/std_fs_file_set_len_relative.wasm",
  "tests/std_fs_file_sync_all_absolute.wasm",
  "tests/std_fs_file_sync_all_relative.wasm",
  "tests/std_fs_file_sync_data_absolute.wasm",
  "tests/std_fs_file_sync_data_relative.wasm",
  "tests/std_fs_hard_link_absolute.wasm",
  "tests/std_fs_hard_link_relative.wasm",
  "tests/std_fs_metadata_absolute.wasm",
  "tests/std_fs_metadata_relative.wasm",
  "tests/std_fs_read_absolute.wasm",
  "tests/std_fs_read_dir_absolute.wasm",
  "tests/std_fs_read_dir_relative.wasm",
  "tests/std_fs_read_relative.wasm",
  "tests/std_fs_remove_dir_all_absolute.wasm",
  "tests/std_fs_remove_dir_all_relative.wasm",
  "tests/std_fs_rename_absolute.wasm",
  "tests/std_fs_rename_relative.wasm",
  "tests/std_fs_symlink_metadata_absolute.wasm",
  "tests/std_fs_symlink_metadata_relative.wasm",
  "tests/std_fs_write_absolute.wasm",
  "tests/std_fs_write_relative.wasm",
  "tests/std_io_stderr.wasm",
  "tests/std_io_stdin.wasm",
  "tests/std_io_stdout.wasm",
  "tests/std_process_exit.wasm",
  "tests/wasi_clock_res_get_monotonic.wasm",
  "tests/wasi_clock_res_get_process.wasm",
  "tests/wasi_clock_res_get_realtime.wasm",
  "tests/wasi_clock_res_get_thread.wasm",
  "tests/wasi_clock_time_get_monotonic.wasm",
  "tests/wasi_clock_time_get_process.wasm",
  "tests/wasi_clock_time_get_realtime.wasm",
  "tests/wasi_clock_time_get_thread.wasm",
  "tests/wasi_fd_write_file.wasm",
  "tests/wasi_fd_write_stderr.wasm",
  "tests/wasi_fd_write_stdout.wasm",
  "tests/wasi_proc_exit_one.wasm",
  "tests/wasi_proc_exit_zero.wasm",
  "tests/wasi_random_get.wasm",
];

const manifest: { [key: string]: unknown } = {};
for await (const entry of Deno.readDir("tests")) {
  if (!entry.name.endsWith(".wasm")) {
    continue;
  }

  const name = `tests/${entry.name}`;
  const path = name.replace(/\.wasm$/, ".json");
  manifest[name] = JSON.parse(await Deno.readTextFile(path));
}

const server = serve({ port: 8080 });

const browser = browse({
  url: "http://localhost:8080",
  headless: true,
  browser: "chrome",
});

const result: {
  passed: number;
  failed: number;
  ignored: number;
  errors: string[];
} = {
  passed: 0,
  failed: 0,
  ignored: 0,
  errors: [],
};

for await (const request of server) {
  try {
    switch (request.url) {
      case "/":
      case "/index.html": {
        await request.respond(await serveIndex());
        break;
      }

      case "/runner.js": {
        await request.respond(await serveRunner(manifest, ignore));
        break;
      }

      case "/favicon.ico": {
        await request.respond({ body: "" });
        break;
      }

      case "/test": {
        await request.respond({ body: "" });
        const body = await Deno.readAll(request.body);

        await Deno.writeAll(Deno.stderr, new TextEncoder().encode("test "));
        await Deno.writeAll(Deno.stderr, body);
        await Deno.writeAll(Deno.stderr, new TextEncoder().encode("..."));
        break;
      }

      case "/pass": {
        await request.respond({ body: "" });
        result.passed++;

        await Deno.writeAll(Deno.stderr, new TextEncoder().encode("ok\n"));
        break;
      }

      case "/fail": {
        await request.respond({ body: "" });
        const body = await Deno.readAll(request.body);

        result.errors.push(new TextDecoder().decode(body));
        result.failed++;

        await Deno.writeAll(Deno.stderr, new TextEncoder().encode("FAILED\n"));
        break;
      }

      case "/skip": {
        await request.respond({ body: "" });
        const body = await Deno.readAll(request.body);

        result.ignored++;

        await Deno.writeAll(Deno.stderr, new TextEncoder().encode("ignore\n"));
        break;
      }

      default: {
        const filepath = request.url.slice(1);
        await request.respond(await serveFile(request, filepath));
        break;
      }
    }
  } catch (error) {
    console.error(request.url, error);
  }

  const pending = Object.keys(manifest).length -
    result.passed -
    result.failed -
    result.ignored;

  if (pending == 0) {
    break;
  }
}

browser.close();
server.close();

if (result.errors.length > 0) {
  await Deno.writeAll(
    Deno.stderr,
    new TextEncoder().encode(`\n`),
  );

  for (const error of result.errors) {
    await Deno.writeAll(
      Deno.stderr,
      new TextEncoder().encode(`${error}\n`),
    );
  }
}

await Deno.writeAll(
  Deno.stderr,
  new TextEncoder().encode(
    `\ntest results: ${
      result.failed ? "FAILED" : "ok"
    }. ${result.passed} passed; ${result.failed} failed; ignored; ${result.ignored}\n`,
  ),
);

if (result.failed) {
  Deno.exit(1);
}

async function serveIndex() {
  const body = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="utf-8">
  <title></title>
  </head>
  <body>
  <script type="module" src="/runner.js"></script>
  </body>
  </html>`;

  return {
    body,
  };
}

async function serveRunner(manifest: unknown, ignore: string[]) {
  const headers = new Headers({
    "Content-Type": "application/javascript",
  });

  const body = `
  import Context from "/lib/wasi_snapshot_preview1.js";

  const manifest = ${JSON.stringify(manifest)};
  const ignore = ${JSON.stringify(ignore)};

  async function test(name) {
    return fetch("http://localhost:8080/test", {
      method: 'POST',
      body: name,
    });
  }

  async function pass() {
    return fetch("http://localhost:8080/pass", {
      method: 'POST',
    });
  }

  async function fail(error) {
    return fetch("http://localhost:8080/fail", {
      method: 'POST',
      body: error,
    });
  }

  async function skip(error) {
    return fetch("http://localhost:8080/skip", {
      method: 'POST',
      body: error,
    });
  }

  window.onerror = async function() {
    write("error");
  };

  window.onload = async function() {
    const result = {
      passed: 0,
      failed: 0,
      errors: [],
    };

    const entries = Object.entries(manifest).sort();
    for (const [pathname, options] of entries) {
      await test(pathname);

      if (ignore.includes(pathname)) {
        await skip();
	continue;
      }

      try {
	const context = new Context({
          env: options.env,
	});

	const request = await fetch(pathname);
	const binary = await request.arrayBuffer();
	const module = await WebAssembly.compile(binary);
	const instance = await WebAssembly.instantiate(module, {
	  wasi_snapshot_preview1: context.exports,
	});

	context.memory = instance.exports.memory;
	instance.exports._start();
	await pass();
      } catch (error) {
        await fail(error.stack);
      }
    }
  };`;

  return {
    headers,
    body,
  };
}
