const LOCAL_STORAGE_KEY = "notizapp-notizen";

function getNotes() {
  return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
}

function saveNote(title, content) {
  const notes = getNotes();

  notes.push({
    id: getNextId(),
    title,
    content,
    lastUpdated: new Date().getTime(),
  });

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
}

function updateNote(id, title, content) {
  const notes = getNotes();

  const updatedNotes = notes.map((note) => {
    if (note.id === id) {
      return {
        ...note,
        title,
        content,
        lastUpdated: new Date().getTime(),
      };
    }
    return note;
  });

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedNotes));
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

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filteredNotes));
}
