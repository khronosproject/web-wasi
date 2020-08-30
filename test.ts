import {
  parse,
} from "https://deno.land/std/flags/mod.ts";

import {
  serve,
} from "https://deno.land/std/http/server.ts";

import {
  serveFile,
} from "https://deno.land/std/http/file_server.ts";

import {
  browse,
} from "https://deno.land/x/web@0.2.1/browser.ts";

const options = parse(Deno.args, {
  default: {
    browser: "chrome",
  },
});

const ignore = [
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
  browser: options.browser,
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

      case "/test.json": {
        await request.respond({ body: "" });
        const body = await Deno.readAll(request.body);
        const message = JSON.parse(new TextDecoder().decode(body));

        if (message.type == "test") {
          await Deno.writeAll(Deno.stderr, new TextEncoder().encode("test "));
          await Deno.writeAll(
            Deno.stderr,
            new TextEncoder().encode(message.name),
          );
          await Deno.writeAll(Deno.stderr, new TextEncoder().encode("..."));
        }

        if (message.type == "skip") {
          result.ignored++;
          await Deno.writeAll(
            Deno.stderr,
            new TextEncoder().encode("ignore\n"),
          );
        }

        if (message.type == "pass") {
          result.passed++;
          await Deno.writeAll(Deno.stderr, new TextEncoder().encode("ok\n"));
        }

        if (message.type == "fail") {
          result.failed++;
          result.errors.push(message.error);
          await Deno.writeAll(
            Deno.stderr,
            new TextEncoder().encode("FAILED\n"),
          );
        }

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

  async function post(body) {
    return fetch("http://localhost:8080/test.json", {
      method: 'POST',
      body: JSON.stringify(body),
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
      await post({
	type: "test",
	name: pathname,
      });

      if (ignore.includes(pathname)) {
        await post({
	  type: "skip",
	  name: pathname,
	});

	continue;
      }

      try {
	const context = new Context({
          args: [pathname].concat(options.args),
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

        await post({
	  type: "pass",
	  name: pathname,
	});
      } catch (error) {
        await post({
	  type: "fail",
	  name: pathname,
	  error: error.stack,
	});
      }
    }
  };`;

  return {
    headers,
    body,
  };
}
