use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

const INDEX_HTML: &str = r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Idea Box</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <main class="shell">
    <section class="panel list-panel">
      <div class="topbar">
        <div>
          <p class="eyebrow">Local notes</p>
          <h1>Idea Box</h1>
        </div>
        <button id="new-note" class="icon-button" title="New note">+</button>
      </div>
      <input id="search" class="search" placeholder="Search title, body, or tags" />
      <div id="notes" class="notes"></div>
    </section>

    <section class="panel editor-panel">
      <input id="title" class="title-input" placeholder="Untitled idea" />
      <input id="tags" class="tags-input" placeholder="tags, comma separated" />
      <textarea id="body" class="body-input" placeholder="Write the small thing before it escapes."></textarea>
      <div class="actions">
        <span id="status" class="status">Ready</span>
        <button id="delete-note" class="danger-button">Delete</button>
        <button id="save-note" class="primary-button">Save</button>
      </div>
    </section>
  </main>
  <script src="/app.js"></script>
</body>
</html>
"#;

const STYLE_CSS: &str = r#"* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  color: #1d2430;
  background: #f4f0e8;
  font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button,
input,
textarea {
  font: inherit;
}

.shell {
  display: grid;
  grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
  gap: 16px;
  width: min(1180px, calc(100vw - 32px));
  height: calc(100vh - 32px);
  margin: 16px auto;
}

.panel {
  min-height: 0;
  border: 1px solid #ded6c9;
  border-radius: 8px;
  background: #fffdf9;
  box-shadow: 0 10px 30px rgba(34, 28, 20, 0.08);
}

.list-panel {
  display: flex;
  flex-direction: column;
  padding: 18px;
}

.editor-panel {
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin: 0 0 2px;
  color: #7d6e5d;
  font-size: 12px;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 28px;
  line-height: 1;
}

.icon-button {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 8px;
  color: white;
  background: #2457d6;
  font-size: 26px;
  cursor: pointer;
}

.search,
.title-input,
.tags-input,
.body-input {
  width: 100%;
  border: 1px solid #d7cdbc;
  border-radius: 8px;
  outline: none;
  background: #fffaf0;
}

.search {
  height: 42px;
  margin: 18px 0 12px;
  padding: 0 12px;
}

.notes {
  overflow: auto;
  display: grid;
  gap: 8px;
  padding-right: 2px;
}

.note {
  display: grid;
  gap: 5px;
  padding: 12px;
  border: 1px solid #e5dccd;
  border-radius: 8px;
  background: #fffaf0;
  text-align: left;
  cursor: pointer;
}

.note.active {
  border-color: #2457d6;
  background: #eef3ff;
}

.note-title {
  overflow: hidden;
  color: #161b24;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-meta {
  color: #71675a;
  font-size: 12px;
}

.title-input {
  height: 54px;
  padding: 0 14px;
  font-size: 28px;
  font-weight: 700;
}

.tags-input {
  height: 42px;
  margin-top: 12px;
  padding: 0 12px;
}

.body-input {
  flex: 1;
  min-height: 220px;
  margin-top: 12px;
  padding: 14px;
  resize: none;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.status {
  flex: 1;
  color: #75695c;
  font-size: 13px;
}

.primary-button,
.danger-button {
  height: 38px;
  border: 0;
  border-radius: 8px;
  padding: 0 16px;
  color: white;
  cursor: pointer;
}

.primary-button {
  background: #2457d6;
}

.danger-button {
  background: #b83232;
}

@media (max-width: 760px) {
  .shell {
    grid-template-columns: 1fr;
    height: auto;
  }

  .list-panel,
  .editor-panel {
    min-height: 360px;
  }
}
"#;

const APP_JS: &str = r#"let notes = [];
let activeId = null;

const $ = (id) => document.getElementById(id);

const els = {
  notes: $("notes"),
  search: $("search"),
  title: $("title"),
  tags: $("tags"),
  body: $("body"),
  status: $("status"),
  save: $("save-note"),
  del: $("delete-note"),
  fresh: $("new-note"),
};

function setStatus(text) {
  els.status.textContent = text;
}

function selectNote(id) {
  activeId = id;
  const note = notes.find((item) => item.id === id);
  els.title.value = note?.title || "";
  els.tags.value = note?.tags || "";
  els.body.value = note?.body || "";
  renderNotes();
}

function newNote() {
  activeId = null;
  els.title.value = "";
  els.tags.value = "";
  els.body.value = "";
  setStatus("New note");
  renderNotes();
}

function renderNotes() {
  const query = els.search.value.trim().toLowerCase();
  const filtered = notes.filter((note) => {
    const text = `${note.title} ${note.tags} ${note.body}`.toLowerCase();
    return text.includes(query);
  });

  els.notes.innerHTML = "";

  for (const note of filtered) {
    const button = document.createElement("button");
    button.className = `note ${note.id === activeId ? "active" : ""}`;
    button.type = "button";
    button.addEventListener("click", () => selectNote(note.id));

    const title = document.createElement("div");
    title.className = "note-title";
    title.textContent = note.title || "Untitled idea";

    const meta = document.createElement("div");
    meta.className = "note-meta";
    meta.textContent = note.tags || "No tags";

    button.append(title, meta);
    els.notes.append(button);
  }

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "note-meta";
    empty.textContent = "Nothing here yet.";
    els.notes.append(empty);
  }
}

async function loadNotes() {
  const response = await fetch("/api/notes");
  notes = await response.json();
  renderNotes();
  if (notes.length > 0 && activeId === null) {
    selectNote(notes[0].id);
  }
}

async function saveNote() {
  const body = new URLSearchParams({
    id: activeId ?? "",
    title: els.title.value,
    tags: els.tags.value,
    body: els.body.value,
  });

  setStatus("Saving...");
  const response = await fetch("/api/notes", {
    method: "POST",
    body,
  });

  if (!response.ok) {
    setStatus("Save failed");
    return;
  }

  const saved = await response.json();
  activeId = saved.id;
  await loadNotes();
  selectNote(saved.id);
  setStatus("Saved");
}

async function deleteNote() {
  if (activeId === null) {
    newNote();
    return;
  }

  setStatus("Deleting...");
  const response = await fetch(`/api/notes/${activeId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    setStatus("Delete failed");
    return;
  }

  activeId = null;
  await loadNotes();
  if (notes.length === 0) {
    newNote();
  }
  setStatus("Deleted");
}

els.fresh.addEventListener("click", newNote);
els.save.addEventListener("click", saveNote);
els.del.addEventListener("click", deleteNote);
els.search.addEventListener("input", renderNotes);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveNote();
  }
});

loadNotes().catch(() => setStatus("Could not load notes"));
"#;

#[derive(Clone, Debug)]
struct Note {
    id: u64,
    title: String,
    tags: String,
    body: String,
    updated_at: u64,
}

#[derive(Debug)]
struct Request {
    method: String,
    path: String,
    body: String,
}

fn main() {
    let address = env::var("IDEA_BOX_ADDR").unwrap_or_else(|_| "127.0.0.1:7878".to_string());
    let listener = TcpListener::bind(&address).unwrap_or_else(|err| {
        panic!("failed to bind {address}: {err}");
    });

    println!("Idea Box is running at http://{address}");
    println!("Data file: {}", data_path().display());
    println!("Press Ctrl+C to stop.");

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                thread::spawn(|| {
                    if let Err(err) = handle_connection(stream) {
                        eprintln!("request failed: {err}");
                    }
                });
            }
            Err(err) => eprintln!("connection failed: {err}"),
        }
    }
}

fn handle_connection(mut stream: TcpStream) -> std::io::Result<()> {
    let request = match read_request(&mut stream)? {
        Some(request) => request,
        None => return Ok(()),
    };

    let response = route(request);
    stream.write_all(response.as_bytes())?;
    stream.flush()
}

fn read_request(stream: &mut TcpStream) -> std::io::Result<Option<Request>> {
    let mut reader = BufReader::new(stream);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line)? == 0 {
        return Ok(None);
    }

    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let path = parts.next().unwrap_or("/").to_string();

    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        reader.read_line(&mut line)?;
        if line == "\r\n" || line.is_empty() {
            break;
        }

        if let Some((name, value)) = line.split_once(':') {
            if name.eq_ignore_ascii_case("Content-Length") {
                content_length = value.trim().parse().unwrap_or(0);
            }
        }
    }

    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        reader.read_exact(&mut body)?;
    }

    Ok(Some(Request {
        method,
        path,
        body: String::from_utf8_lossy(&body).to_string(),
    }))
}

fn route(request: Request) -> String {
    match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/") => ok("text/html; charset=utf-8", INDEX_HTML),
        ("GET", "/style.css") => ok("text/css; charset=utf-8", STYLE_CSS),
        ("GET", "/app.js") => ok("application/javascript; charset=utf-8", APP_JS),
        ("GET", "/api/notes") => match load_notes() {
            Ok(mut notes) => {
                notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
                ok("application/json; charset=utf-8", &notes_to_json(&notes))
            }
            Err(err) => server_error(&err.to_string()),
        },
        ("POST", "/api/notes") => save_note(&request.body),
        _ if request.method == "DELETE" && request.path.starts_with("/api/notes/") => {
            delete_note(&request.path)
        }
        ("GET", "/health") => ok("text/plain; charset=utf-8", "ok"),
        _ => not_found(),
    }
}

fn save_note(body: &str) -> String {
    let form = parse_form(body);
    let title = form.get("title").cloned().unwrap_or_default();
    let tags = form.get("tags").cloned().unwrap_or_default();
    let note_body = form.get("body").cloned().unwrap_or_default();
    let id = form.get("id").and_then(|value| value.parse::<u64>().ok());

    let mut notes = match load_notes() {
        Ok(notes) => notes,
        Err(err) => return server_error(&err.to_string()),
    };

    let now = unix_now();
    let saved_id = if let Some(id) = id {
        if let Some(note) = notes.iter_mut().find(|note| note.id == id) {
            note.title = title;
            note.tags = tags;
            note.body = note_body;
            note.updated_at = now;
            id
        } else {
            notes.push(Note {
                id,
                title,
                tags,
                body: note_body,
                updated_at: now,
            });
            id
        }
    } else {
        let next_id = notes.iter().map(|note| note.id).max().unwrap_or(0) + 1;
        notes.push(Note {
            id: next_id,
            title,
            tags,
            body: note_body,
            updated_at: now,
        });
        next_id
    };

    if let Err(err) = store_notes(&notes) {
        return server_error(&err.to_string());
    }

    ok(
        "application/json; charset=utf-8",
        &format!("{{\"id\":{saved_id}}}"),
    )
}

fn delete_note(path: &str) -> String {
    let Some(id_part) = path.strip_prefix("/api/notes/") else {
        return not_found();
    };
    let Ok(id) = id_part.parse::<u64>() else {
        return bad_request("invalid note id");
    };

    let mut notes = match load_notes() {
        Ok(notes) => notes,
        Err(err) => return server_error(&err.to_string()),
    };
    notes.retain(|note| note.id != id);

    if let Err(err) = store_notes(&notes) {
        return server_error(&err.to_string());
    }

    ok("application/json; charset=utf-8", "{\"ok\":true}")
}

fn load_notes() -> std::io::Result<Vec<Note>> {
    let path = data_path();
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(path)?;
    let notes = content
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(5, '\t');
            let id = parts.next()?.parse().ok()?;
            let updated_at = parts.next()?.parse().ok()?;
            let title = percent_decode(parts.next()?);
            let tags = percent_decode(parts.next()?);
            let body = percent_decode(parts.next()?);
            Some(Note {
                id,
                title,
                tags,
                body,
                updated_at,
            })
        })
        .collect();

    Ok(notes)
}

fn store_notes(notes: &[Note]) -> std::io::Result<()> {
    let mut content = String::new();
    for note in notes {
        content.push_str(&format!(
            "{}\t{}\t{}\t{}\t{}\n",
            note.id,
            note.updated_at,
            percent_encode(&note.title),
            percent_encode(&note.tags),
            percent_encode(&note.body)
        ));
    }

    fs::write(data_path(), content)
}

fn data_path() -> PathBuf {
    env::var("IDEA_BOX_DATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("idea_box.db"))
}

fn notes_to_json(notes: &[Note]) -> String {
    let items = notes
        .iter()
        .map(|note| {
            format!(
                "{{\"id\":{},\"title\":\"{}\",\"tags\":\"{}\",\"body\":\"{}\",\"updated_at\":{}}}",
                note.id,
                json_escape(&note.title),
                json_escape(&note.tags),
                json_escape(&note.body),
                note.updated_at
            )
        })
        .collect::<Vec<_>>();
    format!("[{}]", items.join(","))
}

fn parse_form(body: &str) -> HashMap<String, String> {
    let mut form = HashMap::new();
    for pair in body.split('&') {
        if pair.is_empty() {
            continue;
        }
        let mut parts = pair.splitn(2, '=');
        let key = parts.next().unwrap_or_default();
        let value = parts.next().unwrap_or_default();
        form.insert(percent_decode_form(key), percent_decode_form(value));
    }
    form
}

fn percent_encode(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(*byte as char)
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

fn percent_decode(value: &str) -> String {
    let bytes = percent_decode_bytes(value, false);
    String::from_utf8_lossy(&bytes).to_string()
}

fn percent_decode_form(value: &str) -> String {
    let bytes = percent_decode_bytes(value, true);
    String::from_utf8_lossy(&bytes).to_string()
}

fn percent_decode_bytes(value: &str, plus_is_space: bool) -> Vec<u8> {
    let mut bytes = Vec::new();
    let raw = value.as_bytes();
    let mut index = 0;

    while index < raw.len() {
        match raw[index] {
            b'%' if index + 2 < raw.len() => {
                if let (Some(high), Some(low)) =
                    (hex_value(raw[index + 1]), hex_value(raw[index + 2]))
                {
                    bytes.push(high * 16 + low);
                    index += 3;
                } else {
                    bytes.push(raw[index]);
                    index += 1;
                }
            }
            b'+' if plus_is_space => {
                bytes.push(b' ');
                index += 1;
            }
            byte => {
                bytes.push(byte);
                index += 1;
            }
        }
    }

    bytes
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn json_escape(value: &str) -> String {
    let mut escaped = String::new();
    for ch in value.chars() {
        match ch {
            '"' => escaped.push_str("\\\""),
            '\\' => escaped.push_str("\\\\"),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            ch if ch.is_control() => escaped.push_str(&format!("\\u{:04x}", ch as u32)),
            ch => escaped.push(ch),
        }
    }
    escaped
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn ok(content_type: &str, body: &str) -> String {
    response("200 OK", content_type, body)
}

fn bad_request(message: &str) -> String {
    response("400 Bad Request", "text/plain; charset=utf-8", message)
}

fn not_found() -> String {
    response("404 Not Found", "text/plain; charset=utf-8", "not found")
}

fn server_error(message: &str) -> String {
    response(
        "500 Internal Server Error",
        "text/plain; charset=utf-8",
        message,
    )
}

fn response(status: &str, content_type: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
        body.as_bytes().len()
    )
}
