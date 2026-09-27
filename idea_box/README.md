# Idea Box

A tiny local notes app written in Rust with no external crates.

It starts a local HTTP server, serves a browser UI, and stores notes in a local
`idea_box.db` file. The point is to keep the project small enough to finish
while still touching useful cross-platform app skills: local storage, request
handling, UI state, and packaging as a single binary.

## Run

```sh
cargo run
```

Then open:

```text
http://127.0.0.1:7878
```

If your machine blocks newly built binaries, open the static fallback instead:

```text
/private/tmp/idea_box/index.html
```

That version stores notes in browser `localStorage`.

## Useful knobs

Change the port:

```sh
IDEA_BOX_ADDR=127.0.0.1:9000 cargo run
```

Change the data file:

```sh
IDEA_BOX_DATA=/tmp/my-ideas.db cargo run
```

## What to try next

- Add export to Markdown.
- Add note timestamps in the UI.
- Add a real app data directory.
- Replace the hand-written HTTP layer with Axum.
- Wrap the UI in Tauri when you want a desktop app shell.
