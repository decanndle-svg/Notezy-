import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ===== KONFIGURASI FIREBASE =====
const firebaseConfig = {
  apiKey: "AIzaSyD2NJK_LMVK88360R3xV0ZRt5Ebg-2jO-c",
  authDomain: "notezy-d1fc0.firebaseapp.com",
  projectId: "notezy-d1fc0",
  storageBucket: "notezy-d1fc0.firebasestorage.app",
  messagingSenderId: "598005831577",
  appId: "1:598005831577:web:4e651d5e3b64afbfbee508"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// ===== DATA =====
let notes = [];            // semua catatan
let view = "home";         // home, all, favorit, mapel
let subjectFilter = "";    // mapel yang sedang dipilih
let editingId = null;      // null = catatan baru
let currentPhoto = "";     // foto di pop-up
let currentUser = null;
let stopListening = null;

const baseSubjects = [
  "Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "IPS",
  "Informatika", "PPKn", "Seni Budaya", "PJOK", "Pendidikan Agama"
];
const palette = ["#5b8def", "#a855f7", "#ec4899", "#34c58a", "#f59e0b", "#06b6d4", "#ef4444", "#8b5cf6"];

// ===== MATA PELAJARAN =====
function getCustomSubjects() {
  try { return JSON.parse(localStorage.getItem("notezy-custom-subjects")) || []; }
  catch (e) { return []; }
}

// Gabungan: bawaan + tambahan sendiri + yang dipakai di catatan
function getSubjects() {
  const all = [...baseSubjects, ...getCustomSubjects(), ...notes.map(n => n.subject)];
  return [...new Set(all.filter(s => s))];
}

// Warna tetap untuk tiap mapel
function colorFor(name) {
  const i = baseSubjects.indexOf(name);
  if (i >= 0) return palette[i % palette.length];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 1000;
  return palette[h % palette.length];
}

// ===== LOGIN & LOGOUT =====
document.getElementById("btnLogin").onclick = async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    alert("Login gagal: " + err.message);
  }
};
document.getElementById("btnLogout").onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (stopListening) { stopListening(); stopListening = null; }

  if (user) {
    document.getElementById("loginScreen").classList.add("is-hidden");
    document.getElementById("appBox").classList.remove("is-hidden");
    document.getElementById("userName").textContent = user.displayName || user.email;
    const photo = document.getElementById("userPhoto");
    if (user.photoURL) {
      photo.src = user.photoURL;
      photo.classList.remove("is-hidden");
    }
    startListening();
    offerImportOldNotes();
  } else {
    notes = [];
    document.getElementById("loginScreen").classList.remove("is-hidden");
    document.getElementById("appBox").classList.add("is-hidden");
  }
});

// ===== MEMANTAU DATABASE =====
function startListening() {
  const ref = collection(db, "users", currentUser.uid, "notes");
  stopListening = onSnapshot(ref, snapshot => {
    notes = snapshot.docs.map(d => d.data());
    notes.sort((a, b) => Number(a.id) - Number(b.id));
    render();
  }, err => {
    alert("Gagal membaca catatan: " + err.message);
  });
}

function noteRef(id) {
  return doc(db, "users", currentUser.uid, "notes", String(id));
}

// ===== IMPOR CATATAN LAMA =====
async function offerImportOldNotes() {
  const flag = "notezy-imported-" + currentUser.uid;
  const saved = localStorage.getItem("notezy-notes");
  if (!saved || localStorage.getItem(flag)) return;

  let oldNotes = [];
  try { oldNotes = JSON.parse(saved); } catch (e) { return; }
  if (oldNotes.length === 0) return;

  if (!confirm("Ada " + oldNotes.length + " catatan lama di browser ini. Pindahkan ke akunmu?")) return;

  try {
    for (const n of oldNotes) {
      n.id = String(n.id);
      await setDoc(noteRef(n.id), n);
    }
    localStorage.setItem(flag, "yes");
    alert("Catatan lama berhasil dipindahkan!");
  } catch (err) {
    alert("Gagal memindahkan: " + err.message);
  }
}

// ===== FOTO =====
function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const maxSize = 600;
      let w = img.width;
      let h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function showPreview() {
  const preview = document.getElementById("preview");
  const btnRemove = document.getElementById("btnRemovePhoto");
  if (currentPhoto) {
    preview.src = currentPhoto;
    preview.classList.remove("is-hidden");
    btnRemove.classList.remove("is-hidden");
  } else {
    preview.src = "";
    preview.classList.add("is-hidden");
    btnRemove.classList.add("is-hidden");
  }
}

// ===== MENAMPILKAN =====
function esc(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function show(id, yes) {
  document.getElementById(id).classList.toggle("is-hidden", !yes);
}

function render() {
  renderSidebar();
  renderMain();
}

function renderSidebar() {
  // Menu atas
  document.querySelectorAll(".menu-item").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view && !subjectFilter);
  });

  // Daftar pelajaran di samping
  const box = document.getElementById("sideSubjects");
  box.innerHTML = "";
  getSubjects().forEach(s => {
    const div = document.createElement("div");
    div.className = "side-subject" + (subjectFilter === s ? " active" : "");
    div.innerHTML = `<span class="dot" style="background:${colorFor(s)}"></span>${esc(s)}`;
    div.onclick = () => {
      subjectFilter = (subjectFilter === s) ? "" : s;
      if (view !== "mapel") view = "all";
      document.getElementById("search").value = "";
      render();
    };
    box.appendChild(div);
  });
}

function renderSubjectGrid() {
  const box = document.getElementById("subjectGrid");
  box.innerHTML = "";
  getSubjects().forEach(s => {
    const count = notes.filter(n => n.subject === s).length;
    const div = document.createElement("div");
    div.className = "subject-card" + (subjectFilter === s ? " active" : "");
    div.innerHTML = `<span class="dot" style="background:${colorFor(s)}"></span>
      <b>${esc(s)}</b><small>${count} catatan</small>`;
    div.onclick = () => {
      subjectFilter = (subjectFilter === s) ? "" : s;
      render();
    };
    box.appendChild(div);
  });
}

function renderMain() {
  const keyword = document.getElementById("search").value.toLowerCase().trim();
  const searching = keyword !== "";
  const isHome = view === "home" && !searching && !subjectFilter;
  const showList = !(view === "mapel" && !subjectFilter && !searching);

  show("hero", isHome);
  show("banner", isHome);
  show("btnNewSmall", !isHome);
  show("subjectGrid", view === "mapel" && !searching);
  show("listHead", showList);
  show("noteList", showList);
  renderSubjectGrid();
  if (!showList) return;

  // Judul daftar
  let title = "Semua Catatan";
  if (searching) title = "Hasil Pencarian";
  else if (subjectFilter) title = subjectFilter;
  else if (view === "favorit") title = "Favorit";
  else if (view === "home") title = "Catatan Terbaru";
  document.getElementById("listTitle").textContent = title;

  // Menyaring catatan
  let list = notes.filter(n => {
    if (view === "favorit" && !n.isFavorite) return false;
    if (subjectFilter && n.subject !== subjectFilter) return false;
    const text = (n.title + " " + n.content + " " + n.subject).toLowerCase();
    return text.includes(keyword);
  });
  list = list.slice().reverse();          // terbaru di atas
  if (isHome) list = list.slice(0, 4);    // beranda: 4 terbaru

  const box = document.getElementById("noteList");
  if (list.length === 0) {
    box.innerHTML = '<p class="empty">Belum ada catatan.</p>';
    return;
  }

  box.innerHTML = list.map(n => {
    const c = colorFor(n.subject);
    return `
      <div class="card">
        <div class="card-top">
          <span class="tag" style="color:${c};background:${c}22">${esc(n.subject)}</span>
          <div class="card-actions">
            <button onclick="openEdit('${n.id}')" title="Edit">✏️</button>
            <button onclick="removeNote('${n.id}')" title="Hapus">🗑️</button>
          </div>
        </div>
        ${n.photo ? `<img class="card-photo" src="${n.photo}" alt="Foto catatan">` : ""}
        <h4>${esc(n.title)}</h4>
        <p>${esc(n.content)}</p>
        <div class="card-bottom">
          <span>🕒 ${esc(n.date)}</span>
          <button class="star" onclick="toggleFavorite('${n.id}')">${n.isFavorite ? "⭐" : "☆"}</button>
        </div>
      </div>`;
  }).join("");
}

// ===== POP-UP =====
function fillSubjectSelect(selected) {
  const select = document.getElementById("subject");
  select.innerHTML = getSubjects()
    .map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  select.value = selected;
}

function openModal() { document.getElementById("modal").classList.remove("hidden"); }
function closeModal() { document.getElementById("modal").classList.add("hidden"); }

function openNew() {
  editingId = null;
  currentPhoto = "";
  document.getElementById("modalTitle").textContent = "Catatan Baru";
  document.getElementById("title").value = "";
  document.getElementById("content").value = "";
  fillSubjectSelect(subjectFilter || getSubjects()[0]);
  document.getElementById("photo").value = "";
  showPreview();
  openModal();
}

function openEdit(id) {
  const note = notes.find(n => String(n.id) === String(id));
  editingId = String(id);
  currentPhoto = note.photo || "";
  document.getElementById("modalTitle").textContent = "Edit Catatan";
  document.getElementById("title").value = note.title;
  document.getElementById("content").value = note.content;
  fillSubjectSelect(note.subject);
  document.getElementById("photo").value = "";
  showPreview();
  openModal();
}

// ===== SIMPAN / EDIT / HAPUS =====
async function saveNote() {
  const title = document.getElementById("title").value.trim();
  if (title === "") {
    alert("Judul tidak boleh kosong ya!");
    return;
  }
  if (currentPhoto.length > 700000) {
    alert("Fotonya terlalu besar. Pilih foto lain atau hapus fotonya.");
    return;
  }

  let note;
  if (editingId === null) {
    note = {
      id: String(Date.now()),
      isFavorite: false,
      date: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    };
  } else {
    note = { ...notes.find(n => String(n.id) === editingId) };
  }

  note.title = title;
  note.content = document.getElementById("content").value;
  note.subject = document.getElementById("subject").value;
  note.photo = currentPhoto;

  try {
    await setDoc(noteRef(note.id), note);
    closeModal();
  } catch (err) {
    alert("Gagal menyimpan: " + err.message);
  }
}

async function toggleFavorite(id) {
  const note = notes.find(n => String(n.id) === String(id));
  try {
    await setDoc(noteRef(id), { ...note, isFavorite: !note.isFavorite });
  } catch (err) {
    alert("Gagal mengubah favorit: " + err.message);
  }
}

async function removeNote(id) {
  if (!confirm("Yakin mau menghapus catatan ini?")) return;
  try {
    await deleteDoc(noteRef(id));
  } catch (err) {
    alert("Gagal menghapus: " + err.message);
  }
}

// Supaya tombol di dalam kartu bisa memanggil fungsi ini
window.toggleFavorite = toggleFavorite;
window.openEdit = openEdit;
window.removeNote = removeNote;

// ===== MENGHUBUNGKAN TOMBOL =====
document.getElementById("btnNew").onclick = openNew;
document.getElementById("btnNewSmall").onclick = openNew;
document.getElementById("btnCancel").onclick = closeModal;
document.getElementById("btnSave").onclick = saveNote;
document.getElementById("search").oninput = render;

// Menu dan kartu pintasan (semua yang punya data-view)
document.querySelectorAll("[data-view]").forEach(btn => {
  btn.onclick = () => {
    view = btn.dataset.view;
    subjectFilter = "";
    document.getElementById("search").value = "";
    render();
  };
});

// Tambah pelajaran baru
document.getElementById("btnAddSubject").onclick = () => {
  const name = (prompt("Nama pelajaran baru:") || "").trim();
  if (name === "") return;
  const custom = getCustomSubjects();
  if (!getSubjects().includes(name)) {
    custom.push(name);
    localStorage.setItem("notezy-custom-subjects", JSON.stringify(custom));
  }
  render();
};

document.getElementById("photo").onchange = function () {
  const file = this.files[0];
  if (!file) return;
  compressImage(file, result => {
    currentPhoto = result;
    showPreview();
  });
};

document.getElementById("btnRemovePhoto").onclick = () => {
  currentPhoto = "";
  document.getElementById("photo").value = "";
  showPreview();
};

// ===== SELESAI =====