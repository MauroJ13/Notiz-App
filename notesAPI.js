const LOCAL_STORAGE_KEY = "notizapp-notizen";

function getNotes() {
  try {
    const notes = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
    // ältere Notizen haben noch kein "pinned" / "color"
    return notes.map((note) => ({
      pinned: false,
      color: null,
      createdAt: note.lastUpdated,
      ...note,
    }));
  } catch (e) {
    return [];
  }
}

function setNotes(notes) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
}

function getNote(id) {
  return getNotes().find((note) => note.id === id) || null;
}

function saveNote(title, content, extra = {}) {
  const notes = getNotes();
  const now = new Date().getTime();

  const note = {
    id: getNextId(),
    title,
    content,
    pinned: false,
    color: null,
    createdAt: now,
    lastUpdated: now,
    ...extra,
  };

  notes.push(note);
  setNotes(notes);

  return note;
}

// changes: { title, content, pinned, color }
// touch = false -> Datum bleibt gleich (z.B. beim Anheften)
function updateNote(id, changes, touch = true) {
  const notes = getNotes();

  const updatedNotes = notes.map((note) => {
    if (note.id === id) {
      return {
        ...note,
        ...changes,
        lastUpdated: touch ? new Date().getTime() : note.lastUpdated,
      };
    }
    return note;
  });

  setNotes(updatedNotes);
}

function restoreNote(note) {
  const notes = getNotes();
  // falls die ID inzwischen neu vergeben wurde, eine freie nehmen
  if (notes.some((n) => n.id === note.id)) {
    note = { ...note, id: getNextId() };
  }
  notes.push(note);
  setNotes(notes);
  return note;
}

function getNextId() {
  const notes = getNotes();

  const sortedNotes = notes.sort((noteA, noteB) => noteA.id - noteB.id);

  let nextID = 1;

  for (let note of sortedNotes) {
    if (note.id === nextID) {
      nextID++;
    } else {
      break;
    }
  }

  return nextID;
}

function deleteNote(id) {
  const notes = getNotes();

  const filteredNotes = notes.filter((note) => note.id !== id);

  setNotes(filteredNotes);
}
