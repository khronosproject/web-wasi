# WebAssembly System Interface Implementation for Web Browsers

This module provides an implementation of the WebAssembly System Interface for Web Browsers

## Supported Syscalls

### wasi_snapshot_preview1

- [x] args_get
- [x] args_sizes_get
- [x] environ_get
- [x] environ_sizes_get
- [x] clock_res_get
- [x] clock_time_get
- [ ] fd_advise
- [ ] fd_allocate
- [ ] fd_close
- [ ] fd_datasync
- [ ] fd_fdstat_get
- [ ] fd_fdstat_set_flags
- [ ] fd_fdstat_set_rights
- [ ] fd_filestat_get
- [ ] fd_filestat_set_size
- [ ] fd_filestat_set_times
- [ ] fd_pread
- [ ] fd_prestat_get
- [ ] fd_prestat_dir_name
- [ ] fd_pwrite
- [ ] fd_read
- [ ] fd_readdir
- [ ] fd_renumber
- [ ] fd_seek
- [ ] fd_sync
- [ ] fd_tell
- [ ] fd_write
- [ ] path_create_directory
- [ ] path_filestat_get
- [ ] path_filestat_set_times
- [ ] path_link
- [ ] path_open
- [ ] path_readlink
- [ ] path_remove_directory
- [ ] path_rename
- [ ] path_symlink
- [ ] path_unlink_file
- [ ] poll_oneoff
- [ ] proc_exit
- [ ] proc_raise
- [ ] sched_yield
- [x] random_get
- [ ] sock_recv
- [ ] sock_send
- [ ] sock_shutdown

## Usage

```javascript
import Context from "./wasi_snapshot_preview1.js";

const context = new Context({
});

const instance = await WebAssembly.instantiateStreaming(fetch("module.wasm"), {
  wasi_snapshot_preview1: context.exports,
});

context.memory = instance.exports.memory;

if (module.exports._start) {
  instance.exports._start();
} else if (module.exports._initialize) {
  instance.exports._initialize();
} else {
  throw new Error("No entry point found");
}
```
