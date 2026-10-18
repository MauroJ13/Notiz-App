// ---------- Elemente ----------
const appEl = document.querySelector(".notes-app");
const notesListEl = document.querySelector(".notes-list");
const notesCountEl = document.querySelector(".notes-count");
const searchInputEl = document.getElementById("search-input");
const filterEls = document.querySelectorAll(".filter");

const createButtonEl = document.querySelector(".create-new");
const saveButtonEl = document.querySelector(".save-note");
const deleteButtonEl = document.querySelector(".delete-note");
const pinButtonEl = document.querySelector(".pin-note");
const previewButtonEl = document.querySelector(".preview-toggle");
const exportButtonEl = document.querySelector(".export-note");
const backButtonEl = document.querySelector(".back-btn");
const themeButtonEl = document.querySelector(".theme-toggle");

const colorToggleEl = document.querySelector(".color-toggle");
const colorMenuEl = document.querySelector(".color-menu");

const titleInputEl = document.getElementById("title-input");
const contentInputEl = document.getElementById("content-input");
const previewEl = document.querySelector(".preview");
const saveStatusEl = document.querySelector(".save-status");
const metaDateEl = document.querySelector(".meta-date");
const metaCountEl = document.querySelector(".meta-count");

const toastEl = document.querySelector(".toast");
const toastTextEl = document.querySelector(".toast__text");
const toastActionEl = document.querySelector(".toast__action");

// ---------- Zustand ----------
let selectedNoteId = null;
let searchQuery = "";
let activeFilter = "all";
let previewMode = false;
let saveTimer = null;
let toastTimer = null;
let toastUndo = null;

const LAST_NOTE_KEY = "notizapp-letzte-notiz";
const THEME_KEY = "notizapp-theme";
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

// ---------- Helfer ----------
function escapeHTML(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function store(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {}
}

function formatRelative(timestamp) {
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 7) return rtf.format(-days, "day");

  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*(#{1,6}|>|[-*]\s\[[ xX]\]|[-*]|\d+\.)\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function highlight(text, query) {
  const safe = escapeHTML(text);
  if (!query) return safe;
  const safeQuery = escapeHTML(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${safeQuery})`, "gi"), "<mark>$1</mark>");
}

// ---------- Mini-Markdown ----------
function renderInline(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    );
}

function renderMarkdown(source) {
  const lines = source.split("\n");
  let html = "";
  let listType = null;
  let inCode = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html += `<p>${paragraph.map(renderInline).join("<br />")}</p>`;
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      html += `</${listType}>`;
      listType = null;
    }
  };
  const openList = (type) => {
    if (listType !== type) {
      closeList();
      html += type === "ul-task" ? '<ul class="tasks">' : `<${type}>`;
      listType = type === "ul-task" ? "ul" : type;
    }
  };

  lines.forEach((rawLine, index) => {
    const line = escapeHTML(rawLine);

    if (/^```/.test(rawLine.trim())) {
      flushParagraph();
      closeList();
      html += inCode ? "</code></pre>" : "<pre><code>";
      inCode = !inCode;
      return;
    }
    if (inCode) {
      html += line + "\n";
      return;
    }

    let match;
    if ((match = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushParagraph();
      closeList();
      const level = match[1].length;
      html += `<h${level}>${renderInline(match[2])}</h${level}>`;
    } else if ((match = line.match(/^\s*[-*]\s\[([ xX])\]\s?(.*)$/))) {
      flushParagraph();
      openList("ul-task");
      const done = match[1].toLowerCase() === "x";
      html += `<li class="task${done ? " is-done" : ""}">
        <input type="checkbox" data-line="${index}" ${done ? "checked" : ""} />
        <span>${renderInline(match[2])}</span></li>`;
    } else if ((match = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushParagraph();
      openList("ul");
      html += `<li>${renderInline(match[1])}</li>`;
    } else if ((match = line.match(/^\s*\d+\.\s+(.*)$/))) {
      flushParagraph();
      openList("ol");
      html += `<li>${renderInline(match[1])}</li>`;
    } else if ((match = line.match(/^&gt;\s?(.*)$/))) {
      flushParagraph();
      closeList();
      html += `<blockquote>${renderInline(match[1])}</blockquote>`;
    } else if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      flushParagraph();
      closeList();
      html += "<hr />";
    } else if (line.trim() === "") {
      flushParagraph();
      closeList();
    } else {
      closeList();
      paragraph.push(line);
    }
  });

  flushParagraph();
  closeList();
  if (inCode) html += "</code></pre>";

  return html || '<p class="preview__empty">Nichts zum Anzeigen.</p>';
}

// ---------- Liste ----------
function getVisibleNotes() {
  const query = searchQuery.toLowerCase();

  return getNotes()
    .filter((note) => {
      if (activeFilter === "pinned" && !note.pinned) return false;
      if (["red", "amber", "green", "blue"].includes(activeFilter)) {
        if (note.color !== activeFilter) return false;
      }
      if (!query) return true;
      return (
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.lastUpdated - a.lastUpdated;
    });
}

function noteEntryHtml(note) {
  const teaser = plainText(note.content).slice(0, 140);
  const isSelected = note.id === selectedNoteId;

  return `
    <button class="note-entry${isSelected ? " selected-note" : ""}" data-id="${note.id}" type="button">
      <div class="note-entry__top">
        ${note.color ? `<i class="note-dot" style="--dot: var(--tag-${note.color})"></i>` : ""}
        <span class="note-title">${note.title ? highlight(note.title, searchQuery) : '<span class="muted">Ohne Titel</span>'}</span>
        ${note.pinned ? '<svg class="note-pin" viewBox="0 0 24 24" fill="currentColor"><path d="M9 4h6l-1 6 3 3v1H7v-1l3-3-1-6Z"/><path d="M11.25 14h1.5v6h-1.5z"/></svg>' : ""}
      </div>
      <div class="note-content-teaser">${teaser ? highlight(teaser, searchQuery) : "Kein Inhalt"}</div>
      <div class="note-date">${formatRelative(note.lastUpdated)}</div>
    </button>
  `;
}

function displayNotesList() {
  const allNotes = getNotes();
  const notes = getVisibleNotes();

  notesCountEl.textContent =
    allNotes.length === 1 ? "1 Notiz" : `${allNotes.length} Notizen`;

  if (!notes.length) {
    let message = "Noch keine Notizen. Leg mit „Neue Notiz“ los.";
    if (searchQuery) {
      message = `Nichts gefunden für „${escapeHTML(searchQuery)}“.`;
    } else if (activeFilter !== "all") {
      message = "Keine Notizen in diesem Filter.";
    }
    notesListEl.innerHTML = `<p class="notes-empty">${message}</p>`;
    return;
  }

  const pinned = notes.filter((n) => n.pinned);
  const others = notes.filter((n) => !n.pinned);

  let html = "";
  if (pinned.length && others.length) {
    html += `<div class="notes-group">Angeheftet</div>`;
    html += pinned.map(noteEntryHtml).join("");
    html += `<div class="notes-group">Weitere</div>`;
    html += others.map(noteEntryHtml).join("");
  } else {
    html = notes.map(noteEntryHtml).join("");
  }

  notesListEl.innerHTML = html;
}

notesListEl.addEventListener("click", (e) => {
  const entry = e.target.closest(".note-entry");
  if (!entry) return;
  flushSave();
  selectNote(Number(entry.dataset.id));
  showEditor();
});

// ---------- Editor ----------
function selectNote(id) {
  const note = getNote(id);
  if (!note) return;

  selectedNoteId = id;
  store(LAST_NOTE_KEY, String(id));

  titleInputEl.value = note.title;
  contentInputEl.value = note.content;

  setStatus("");
  updateEditorState();
  displayNotesList();
}

function clearEditor() {
  selectedNoteId = null;
  store(LAST_NOTE_KEY, null);
  titleInputEl.value = "";
  contentInputEl.value = "";
  setStatus("");
  updateEditorState();
  displayNotesList();
}

function updateEditorState() {
  const note = selectedNoteId !== null ? getNote(selectedNoteId) : null;

  pinButtonEl.classList.toggle("is-on", !!note?.pinned);
  pinButtonEl.title = note?.pinned ? "Lösen" : "Anheften";

  const color = note?.color;
  colorToggleEl.style.setProperty(
    "--dot",
    color ? `var(--tag-${color})` : "transparent",
  );
  colorToggleEl.classList.toggle("has-color", !!color);

  metaDateEl.textContent = note
    ? `Bearbeitet ${formatRelative(note.lastUpdated)}`
    : "Neue Notiz";

  updateCount();

  if (previewMode) {
    previewEl.innerHTML = renderMarkdown(contentInputEl.value);
  }
}

function updateCount() {
  const text = contentInputEl.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tasks = text.match(/^\s*[-*]\s\[[ xX]\]/gm) || [];
  const done = text.match(/^\s*[-*]\s\[[xX]\]/gm) || [];

  let label = words === 1 ? "1 Wort" : `${words} Wörter`;
  if (tasks.length) label += ` · ${done.length}/${tasks.length} erledigt`;
  metaCountEl.textContent = label;
}

function setStatus(text, kind = "") {
  saveStatusEl.textContent = text;
  saveStatusEl.dataset.kind = kind;
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = null;

  const title = titleInputEl.value;
  const content = contentInputEl.value;

  if (selectedNoteId === null) {
    if (!title.trim() && !content.trim()) return false;
    const note = saveNote(title, content);
    selectedNoteId = note.id;
    store(LAST_NOTE_KEY, String(note.id));
  } else {
    const note = getNote(selectedNoteId);
    if (note && note.title === title && note.content === content) {
      return true;
    }
    updateNote(selectedNoteId, { title, content });
  }

  setStatus("Gespeichert", "saved");
  updateEditorState();
  displayNotesList();
  return true;
}

function scheduleSave() {
  setStatus("Wird gespeichert …", "pending");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 700);
}

function flushSave() {
  if (saveTimer) persist();
}

function handleEditorInput() {
  updateCount();
  scheduleSave();
}

titleInputEl.addEventListener("input", handleEditorInput);
contentInputEl.addEventListener("input", handleEditorInput);

titleInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    contentInputEl.focus();
  }
});

// Listen beim Enter automatisch weiterführen
contentInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    contentInputEl.setRangeText("  ", contentInputEl.selectionStart, contentInputEl.selectionEnd, "end");
    handleEditorInput();
    return;
  }

  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;

  const { value, selectionStart } = contentInputEl;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const line = value.slice(lineStart, selectionStart);
  const match = line.match(/^(\s*)([-*]\s\[[ xX]\]\s|[-*]\s|(\d+)\.\s)(.*)$/);
  if (!match) return;

  e.preventDefault();
  const [, indent, marker, number, rest] = match;

  if (!rest.trim()) {
    // leeres Listenelement -> Liste beenden
    contentInputEl.setRangeText("", lineStart, selectionStart, "end");
  } else {
    let next = marker;
    if (number) next = `${Number(number) + 1}. `;
    if (/\[[xX]\]/.test(marker)) next = marker.replace(/\[[xX]\]/, "[ ]");
    contentInputEl.setRangeText("\n" + indent + next, selectionStart, contentInputEl.selectionEnd, "end");
  }
  handleEditorInput();
});

// ---------- Aktionen ----------
function clickCreateButton() {
  flushSave();
  clearEditor();
  if (previewMode) togglePreview(false);
  showEditor();
  titleInputEl.focus();
}

function clickSaveButton() {
  const saved = persist();
  if (!saved) {
    showToast("Schreib zuerst etwas, dann wird gespeichert.");
    return;
  }
  setStatus("Gespeichert", "saved");
  saveButtonEl.classList.add("is-flash");
  setTimeout(() => saveButtonEl.classList.remove("is-flash"), 600);
}

function clickDeleteButton() {
  clearTimeout(saveTimer);
  saveTimer = null;

  if (selectedNoteId === null) {
    if (titleInputEl.value || contentInputEl.value) {
      clearEditor();
    } else {
      showToast("Wähle zuerst eine Notiz aus.");
    }
    return;
  }

  // vor dem Löschen den aktuellen Stand sichern, damit Rückgängig alles zurückholt
  updateNote(selectedNoteId, {
    title: titleInputEl.value,
    content: contentInputEl.value,
  }, false);
  const deleted = getNote(selectedNoteId);
  deleteNote(selectedNoteId);
  clearEditor();
  togglePreview(false);
  showList();

  showToast(`„${deleted.title || "Ohne Titel"}“ gelöscht`, () => {
    const restored = restoreNote(deleted);
    selectNote(restored.id);
    showEditor();
  });
}

function ensureNote() {
  if (selectedNoteId !== null) {
    flushSave();
    return true;
  }
  if (persist()) return true;
  showToast("Schreib zuerst etwas in die Notiz.");
  return false;
}

function togglePin() {
  if (!ensureNote()) return;
  const note = getNote(selectedNoteId);
  updateNote(selectedNoteId, { pinned: !note.pinned }, false);
  updateEditorState();
  displayNotesList();
}

function setColor(color) {
  colorMenuEl.hidden = true;
  if (!ensureNote()) return;
  updateNote(selectedNoteId, { color: color || null }, false);
  updateEditorState();
  displayNotesList();
}

function togglePreview(force) {
  previewMode = typeof force === "boolean" ? force : !previewMode;
  previewButtonEl.classList.toggle("is-on", previewMode);
  contentInputEl.hidden = previewMode;
  previewEl.hidden = !previewMode;

  if (previewMode) {
    previewEl.innerHTML = renderMarkdown(contentInputEl.value);
  } else if (typeof force !== "boolean") {
    contentInputEl.focus();
  }
}

// Checkboxen in der Vorschau direkt abhaken
previewEl.addEventListener("change", (e) => {
  if (e.target.type !== "checkbox") return;
  const lineIndex = Number(e.target.dataset.line);
  const lines = contentInputEl.value.split("\n");
  lines[lineIndex] = lines[lineIndex].replace(
    /\[([ xX])\]/,
    e.target.checked ? "[x]" : "[ ]",
  );
  contentInputEl.value = lines.join("\n");
  e.target.closest(".task").classList.toggle("is-done", e.target.checked);
  updateCount();
  scheduleSave();
});

function exportNote() {
  const title = titleInputEl.value.trim() || "Notiz";
  const content = contentInputEl.value;

  if (!titleInputEl.value.trim() && !content.trim()) {
    showToast("Leere Notizen kann man nicht exportieren.");
    return;
  }

  const fileName =
    title
      .toLowerCase()
      .replace(/[äöü]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue" })[c])
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "notiz";

  const blob = new Blob([`# ${title}\n\n${content}\n`], {
    type: "text/markdown;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

createButtonEl.addEventListener("click", clickCreateButton);
saveButtonEl.addEventListener("click", clickSaveButton);
deleteButtonEl.addEventListener("click", clickDeleteButton);
pinButtonEl.addEventListener("click", togglePin);
previewButtonEl.addEventListener("click", () => togglePreview());
exportButtonEl.addEventListener("click", exportNote);

colorToggleEl.addEventListener("click", (e) => {
  e.stopPropagation();
  colorMenuEl.hidden = !colorMenuEl.hidden;
});
colorMenuEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-color]");
  if (btn) setColor(btn.dataset.color);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".color-picker")) colorMenuEl.hidden = true;
});

// ---------- Suche & Filter ----------
searchInputEl.addEventListener("input", () => {
  searchQuery = searchInputEl.value.trim();
  displayNotesList();
});

filterEls.forEach((btn) => {
  btn.addEventListener("click", () => {
    activeFilter = btn.dataset.filter;
    filterEls.forEach((b) => b.classList.toggle("is-active", b === btn));
    displayNotesList();
  });
});

document.querySelector(".search__kbd").textContent = isMac ? "⌘K" : "Strg K";

// ---------- Mobile Ansicht ----------
function showEditor() {
  appEl.dataset.view = "editor";
}
function showList() {
  appEl.dataset.view = "list";
}
backButtonEl.addEventListener("click", () => {
  flushSave();
  showList();
});

// ---------- Theme ----------
themeButtonEl.addEventListener("click", () => {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  store(THEME_KEY, next);
});

// ---------- Toast ----------
function showToast(text, undo = null) {
  clearTimeout(toastTimer);
  toastTextEl.textContent = text;
  toastUndo = undo;
  toastActionEl.hidden = !undo;
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add("is-visible"));
  toastTimer = setTimeout(hideToast, undo ? 6000 : 2800);
}

function hideToast() {
  toastEl.classList.remove("is-visible");
  toastUndo = null;
  setTimeout(() => {
    if (!toastEl.classList.contains("is-visible")) toastEl.hidden = true;
  }, 250);
}

toastActionEl.addEventListener("click", () => {
  if (toastUndo) toastUndo();
  hideToast();
});

// ---------- Tastenkürzel ----------
document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();

  if (mod && key === "s") {
    e.preventDefault();
    clickSaveButton();
  } else if (mod && key === "k") {
    e.preventDefault();
    showList();
    searchInputEl.focus();
    searchInputEl.select();
  } else if (mod && key === "e") {
    e.preventDefault();
    togglePreview();
  } else if (e.altKey && e.code === "KeyN") {
    e.preventDefault();
    clickCreateButton();
  } else if (key === "escape") {
    if (!colorMenuEl.hidden) colorMenuEl.hidden = true;
    else if (document.activeElement === searchInputEl && searchInputEl.value) {
      searchInputEl.value = "";
      searchQuery = "";
      displayNotesList();
    }
  }
});

// Ungespeichertes nicht verlieren
window.addEventListener("beforeunload", flushSave);

// Relative Zeiten aktuell halten
setInterval(() => {
  displayNotesList();
  if (selectedNoteId !== null) {
    const note = getNote(selectedNoteId);
    if (note) metaDateEl.textContent = `Bearbeitet ${formatRelative(note.lastUpdated)}`;
  }
}, 60000);

// ---------- Start ----------
(function init() {
  let lastId = null;
  try {
    lastId = Number(localStorage.getItem(LAST_NOTE_KEY));
  } catch (e) {}

  if (lastId && getNote(lastId)) {
    selectNote(lastId);
  } else {
    clearEditor();
  }
})();
