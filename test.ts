import {
  green,
  red,
  yellow,
} from "https://deno.land/std@0.69.0/fmt/colors.ts";

import {
  parse,
} from "https://deno.land/std@0.69.0/flags/mod.ts";

import {
  serve,
} from "https://deno.land/std@0.69.0/http/server.ts";

import {
  serveFile,
} from "https://deno.land/std@0.69.0/http/file_server.ts";

import {
  browse,
} from "https://deno.land/x/web@0.2.1/browser.ts";

const options = parse(Deno.args, {
  default: {
    browser: "chrome",
  },
});

const tests = [
  "tests/std_env_args.wasm",
  "tests/std_env_vars.wasm",
  "tests/std_process_exit.wasm",
  "tests/wasi_clock_res_get.wasm",
  "tests/wasi_clock_time_get.wasm",
  "tests/wasi_fd_write_stderr.wasm",
  "tests/wasi_proc_exit.wasm",
  "tests/wasi_random_get.wasm",
];

const ignore: string[] = [];

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
        await request.respond(await serveRunner(tests, ignore));
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
          print(`test ${message.name} ...`, true);
        }

        if (message.type == "skip") {
          result.ignored++;
          print(` ${yellow("ignore")}`);
        }

        if (message.type == "pass") {
          result.passed++;
          print(` ${green("ok")}`);
        }

        if (message.type == "fail") {
          result.failed++;
          result.errors.push(message.error);
          print(` ${red("FAILED")}`);
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

  const pending = tests.length -
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
  for (const error of result.errors) {
    print(error);
  }
}

const status = result.failed ? "FAILED" : "ok";
print(
  `\ntest results: ${status}. ${result.passed} passed; ${result.failed} failed; ignored; ${result.ignored}\n`,
);

if (result.failed) {
  Deno.exit(1);
}

function print(text: string, noNewLine = false) {
  const encoder = new TextEncoder();
  Deno.stdout.writeSync(encoder.encode(text));

  if (!noNewLine) {
    Deno.stdout.writeSync(encoder.encode("\n"));
  }
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

async function serveRunner(tests: string[], ignore: string[]) {
  const headers = new Headers({
    "Content-Type": "application/javascript",
  });

  const body = `
  import Context, {
    ExitStatus,
  } from "/lib/wasi_snapshot_preview1.js";

  const tests = ${JSON.stringify(tests)};
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
    for (const pathname of tests) {
      const optionsRequest = await fetch(pathname.replace('.wasm', '.json'));
      const options = await optionsRequest.json();

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
	const stderr = [];

	const context = new Context({
	  args: [pathname].concat(options.args),
	  env: options.env,
	  stderr: {
	    write: (data) => {
	      stderr.push(new TextDecoder().decode(data));
	      return data.byteLength;
	    },
	  },
	});

	const request = await fetch(pathname);
	const binary = await request.arrayBuffer();
	const module = await WebAssembly.compile(binary);
	const instance = await WebAssembly.instantiate(module, {
	  wasi_snapshot_preview1: context.exports,
	});

	context.memory = instance.exports.memory;

	try {
	  instance.exports._start();
	} catch (err) {
	  if (err instanceof ExitStatus) {
	    console.assert(err.code == options.exitCode);
	  } else {
	    throw err;
	  }
	}

	if (stderr.join('') != (options.stderr ?? "")) {
	  throw new Error('stderr: ' + stderr.join(''));
	}

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
