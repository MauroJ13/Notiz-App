const notesListEl = document.querySelector(".notes-list");
const saveButtonEl = document.querySelector(".save-note");
const createButtonEl = document.querySelector(".create-new");

const titleInputEl = document.getElementById("title-input");
const contentInputEl = document.getElementById("content-input");

const deleteButtonEl = document.querySelector(".delete-note");

let selectedNoteId = null;

saveButtonEl.addEventListener("click", clickSaveButton);
createButtonEl.addEventListener("click", clickCreateButton);
deleteButtonEl.addEventListener("click", clickDeleteButton);

function escapeHTML(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayNotesList() {
  const notes = getNotes();

  const sortedNotes = notes.sort(
    (noteA, noteB) => noteB.lastUpdated - noteA.lastUpdated,
  );

  let html = "";

  sortedNotes.forEach((note) => {
    html += `
      <div class="note-entry" data-id="${note.id}">
        <div class="note-title">${escapeHTML(note.title)}</div>
        <div class="note-content-teaser">${escapeHTML(note.content)}</div>
        <div class="note-date">
          ${new Date(note.lastUpdated).toLocaleString("de-DE")}
        </div>
      </div>
    `;
  });

  notesListEl.innerHTML = html;

  document.querySelectorAll(".note-entry").forEach((noteEl) => {
    noteEl.addEventListener("click", () => {
      const id = Number(noteEl.dataset.id);
      selectNote(id);
    });
  });
}

function selectNote(id) {
  const notes = getNotes();
  const note = notes.find((n) => n.id === id);

  selectedNoteId = id;

  titleInputEl.value = note.title;
  contentInputEl.value = note.content;
}

function clickCreateButton() {
  selectedNoteId = null;
  titleInputEl.value = "";
  contentInputEl.value = "";
}

function clickSaveButton() {
  const title = titleInputEl.value;
  const content = contentInputEl.value;

  if (!title || !content) {
    alert("Bitte Titel und Inhalt eingeben");
    return;
  }

  if (selectedNoteId === null) {
    saveNote(title, content);
  } else {
    updateNote(selectedNoteId, title, content);
  }

  titleInputEl.value = "";
  contentInputEl.value = "";
  selectedNoteId = null;

  displayNotesList();
}

function clickDeleteButton() {
  if (selectedNoteId === null) {
    alert("Bitte zuerst eine Notiz auswählen");
    return;
  }

  deleteNote(selectedNoteId);

  titleInputEl.value = "";
  contentInputEl.value = "";
  selectedNoteId = null;

  displayNotesList();
}

displayNotesList();
