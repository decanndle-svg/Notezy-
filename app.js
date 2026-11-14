// ===== DATA =====
let notes = [];            // daftar semua catatan
let filter = "semua";      // "semua" atau "favorit"
let subjectFilter = "";    // mata pelajaran yang sedang dipilih
let editingId = null;      // null = membuat baru, angka = sedang mengedit

const subjects = [
  "Matematika",
  "Bahasa Indonesia",
  "Bahasa Inggris",
  "IPA",
  "IPS",
  "Informatika",
  "PPKn",
  "Seni Budaya",
  "PJOK",
  "Pendidikan Agama"
];

// ===== MENYIMPAN & MEMBACA DARI BROWSER =====
function loadNotes() {
  const saved = localStorage.getItem("notezy-notes");
  notes = saved ? JSON.parse(saved) : [];
  render();
}

function saveToStorage() {
  localStorage.setItem("notezy-notes", JSON.stringify(notes));
}

// ===== MENAMPILKAN =====
function render() {
  renderSubjects();
  renderNotes();
}

// Mencegah teks yang mengandung simbol < > merusak halaman
function esc(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderSubjects() {
  const box = document.getElementById("subjects");
  box.innerHTML = "";

  subjects.forEach(s => {
    const count = notes.filter(n => n.subject === s).length;
    const div = document.createElement("div");
    div.className = "subject" + (subjectFilter === s ? " active" : "");
    div.innerHTML = `<b>${s}</b><small>${count} catatan</small>`;
    div.onclick = () => {
      subjectFilter = (subjectFilter === s) ? "" : s;  // klik lagi = batal pilih
      render();
    };
    box.appendChild(div);
  });
}

function renderNotes() {
  const keyword = document.getElementById("search").value.toLowerCase();
  const box = document.getElementById("noteList");

  // Saring catatan sesuai tab, mata pelajaran, dan kata pencarian
  const list = notes.filter(n => {
    if (filter === "favorit" && !n.isFavorite) return false;
    if (subjectFilter && n.subject !== subjectFilter) return false;
    const text = (n.title + " " + n.content + " " + n.subject).toLowerCase();
    return text.includes(keyword);
  });

  if (list.length === 0) {
    box.innerHTML = "<p>Belum ada catatan.</p>";
    return;
  }

  // Catatan terbaru ditampilkan paling atas
  box.innerHTML = list.slice().reverse().map(n => `
    <div class="note">
      <h3>${esc(n.title)}</h3>
      <span class="tag">${esc(n.subject)}</span>
      <span class="date">${esc(n.date)}</span>
      <p>${esc(n.content)}</p>
      <div class="note-actions">
        <button onclick="toggleFavorite(${n.id})">${n.isFavorite ? "⭐" : "☆"}</button>
        <button onclick="openEdit(${n.id})">✏️</button>
        <button onclick="removeNote(${n.id})">🗑️</button>
      </div>
    </div>
  `).join("");
}

// ===== POP-UP =====
function openModal() {
  document.getElementById("modal").classList.remove("hidden");
}
function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

function openNew() {
  editingId = null;
  document.getElementById("modalTitle").textContent = "Catatan Baru";
  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
  document.getElementById("subject").value = subjects[0];
  openModal();
}

function openEdit(id) {
  const note = notes.find(n => n.id === id);
  editingId = id;
  document.getElementById("modalTitle").textContent = "Edit Catatan";
  document.getElementById("title").value = note.title;
  document.getElementById("content").value = note.content;
  document.getElementById("subject").value = note.subject;
  openModal();
}

// ===== SIMPAN / EDIT / HAPUS =====
function saveNote() {
  const title = document.getElementById("title").value.trim();
  if (title === "") {
    alert("Judul tidak boleh kosong ya!");
    return;
  }

  const content = document.getElementById("content").value;
  const subject = document.getElementById("subject").value;

  if (editingId === null) {
    // Catatan baru
    notes.push({
      id: Date.now(),   // nomor unik dari waktu sekarang
      title: title,
      content: content,
      subject: subject,
      isFavorite: false,
      date: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    });
  } else {
    // Edit catatan yang sudah ada
    const note = notes.find(n => n.id === editingId);
    note.title = title;
    note.content = content;
    note.subject = subject;
  }

  saveToStorage();
  closeModal();
  render();
}

function toggleFavorite(id) {
  const note = notes.find(n => n.id === id);
  note.isFavorite = !note.isFavorite;
  saveToStorage();
  render();
}

function removeNote(id) {
  if (!confirm("Yakin mau menghapus catatan ini?")) return;
  notes = notes.filter(n => n.id !== id);
  saveToStorage();
  render();
}

// ===== MENGHUBUNGKAN TOMBOL =====
document.getElementById("btnNew").onclick = openNew;
document.getElementById("btnCancel").onclick = closeModal;
document.getElementById("btnSave").onclick = saveNote;
document.getElementById("search").oninput = renderNotes;

document.querySelectorAll(".tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    filter = tab.dataset.filter;
    renderNotes();
  };
});

// Jalankan saat halaman pertama kali dibuka
loadNotes();