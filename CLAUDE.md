# To-Do List Modern

Aplikasi to-do list bergaya aplikasi produktivitas (Microsoft To Do / Todoist),
versi sederhana. Ini **proyek latihan pribadi**, bukan tugas kuliah dan bukan
aplikasi produksi.

## Tujuan proyek

Saya sedang melatih kemampuan mengarahkan AI membangun proyek secara iteratif.
Artinya:

- **Saya harus paham setiap baris yang masuk ke repo ini.** Kalau ada pilihan
  antara kode yang pintar dan kode yang jelas, pilih yang jelas.
- **Jangan bangun fitur yang belum saya minta di sesi ini.** Kalau kamu melihat
  sesuatu yang perlu dikerjakan nanti, sebut di akhir jawaban — jangan kerjakan.
- Kalau spec di file ini bertentangan dengan permintaan saya, **berhenti dan
  tanya**. Jangan tebak.
- Kalau ada requirement yang ambigu, tanya sebelum menulis kode.

## Stack

- React (function component + hooks)
- Tailwind CSS
- Vite
- Penyimpanan: localStorage (untuk sekarang)
- Tanpa library state management. useState/useReducer + context kalau perlu.
- **Jangan tambah dependency baru tanpa tanya dulu.** Termasuk date library dan
  drag-and-drop library.

## Cara menjalankan

- Dev: `npm run dev`
- Build: `npm run build`

## Konvensi

- Komentar dan nama variabel bahasa Inggris; penjelasan ke saya bahasa Indonesia.
- Komponen: satu file per komponen, PascalCase.
- Jangan buat abstraksi sebelum ada 3 pemakai nyata.
- Jangan bikin folder `utils/` berisi campuran. Fungsi tinggal dekat pemakainya.

## Aturan arsitektur yang tidak bisa ditawar

**Semua akses penyimpanan lewat satu modul `src/lib/storage.js`.**
Tidak ada komponen yang boleh memanggil `localStorage` langsung.
Alasannya: penyimpanan mungkin dimigrasikan ke database nanti. Kalau lapisan ini
terisolasi, migrasi = mengganti isi satu file. Kalau tidak, migrasi = tulis ulang
aplikasi.

Semua fungsi di `storage.js` ditulis dengan asumsi **suatu saat jadi async**.

---

# Status implementasi

Catatan status (bukan bagian spec — spec di bawah tidak berubah). Diperbarui
2026-07-16.

## Sudah jadi

- Lapisan penyimpanan terisolasi di `src/lib/storage.js` (semua fungsi async).
- Task CRUD: tambah, edit (klik judul), toggle complete, hapus.
- Prioritas + deadline + status precedence (`src/lib/taskStatus.js`).
- Tag many-to-many (input + normalisasi di storage).
- Search + filter multi-dimensi via `getVisibleTasks` (`src/lib/getVisibleTasks.js`).
- Progress bar dari seluruh task + baris "Showing X of Y tasks".
- Token warna + komponen `Button`, dark mode, responsif (satu breakpoint `sm:`).
- Sort By: Manual / Priority / Deadline (`src/lib/sortTasks.js`).
- Reorder manual: drag & drop native + tombol ↑↓ (aktif hanya saat Manual).
- Tampilan deadline sesuai aturan "Deadline > Tampilan" (`formatDeadline`).

## Backlog (belum dikerjakan — catatan, bukan janji)

- Validasi/sanitasi bentuk tiap task saat dibaca di `readState()` supaya data
  localStorage yang rusak tidak meng-crash app.
- Trim input tag sebelum cek kosong (tag berisi spasi kini masuk lalu hilang
  diam-diam saat disimpan).
- Semantik keyboard/tombol untuk span judul yang diklik untuk edit (a11y).

---

# Spesifikasi

Spec ini sudah diputuskan. Jangan diubah tanpa saya minta.

## Model data

```
Task {
  id          string   (uuid)
  title       string   (wajib, tidak boleh kosong/whitespace)
  priority    "high" | "medium" | "low"   (default "medium")
  deadline    string | null   (ISO 8601, atau null kalau tidak ada)
  tags        string[]        (boleh kosong)
  completed   boolean
  order       number
  createdAt   string   (ISO 8601)
}
```

Data disimpan di localStorage dengan **versi skema**:

```
{ "version": 1, "tasks": [...] }
```

Kalau skema berubah nanti, `storage.js` yang menangani migrasi. Jangan sampai
data lama bikin aplikasi crash.

## Status task — precedence

Urutan pengecekan wajib persis seperti ini:

```
if (task.completed)        -> "completed"
else if (!task.deadline)   -> "upcoming"
else if (deadline < now)   -> "overdue"
else                       -> "upcoming"
```

**Task tanpa deadline TIDAK PERNAH overdue.** Guard `!task.deadline` wajib ada
sebelum perbandingan. Task yang sudah selesai TIDAK PERNAH overdue.

## Deadline

- Deadline = **tanggal + jam**.
- Kalau user hanya mengisi tanggal, jam default `23:59` di zona waktu lokal.
- Disimpan sebagai ISO string.
- Tampilan: tanggal saja kalau jamnya 23:59, tanggal + jam kalau bukan.

## "Today"

- "Today" = tanggal lokal pengguna, dari `00:00:00` sampai `23:59:59`.
  Bukan "24 jam ke depan".
- "Today" adalah **kategori tanggal**. "Overdue" adalah **status waktu**.
  Satu task bisa keduanya sekaligus (deadline hari ini jam 09:00, sekarang 14:00).

## Urutan & drag and drop

- Urutan default = **manual**, ditentukan field `order`.
- Prioritas **bukan** penentu urutan. Prioritas hanya: warna label, filter,
  dan salah satu opsi sort.
- Task baru masuk di **paling atas** (order terkecil).
- Sort By hanya 3 opsi: `Manual` (default), `Priority`, `Deadline`.
- **Drag & drop hanya aktif saat Sort By = Manual.** Di mode lain, handle drag
  disembunyikan sepenuhnya (bukan disabled diam-diam).

## Filter — struktur

Filter terdiri dari **dimensi yang saling tegak lurus** dan digabung dengan **AND**:

- **Status** (eksklusif, pilih satu): All / Active / Completed
- **Prioritas** (opsional, bisa multi): High / Medium / Low
- **Tanggal** (opsional, pilih satu): Any / Today / Overdue
- **Tag** (opsional, bisa multi)
- **Search** (teks bebas, cocokkan ke `title`, case-insensitive)

Semua digabung AND. Contoh: Status=Active AND Priority in [high] AND Tag in
[kuliah] AND title contains "react".

Ini semua diselesaikan di satu fungsi murni `getVisibleTasks(tasks, filters)`.
Satu sumber kebenaran. Jangan sebar logika filter ke komponen.

## Progress bar

- Selalu dihitung dari **seluruh task**, tidak terpengaruh filter.
- `progress = completed / total`. Kalau `total === 0`, tampilkan 0% (jangan NaN).
- Info hasil filter dipisah jadi teks sendiri: `Showing 7 of 12 tasks`.

## Tag

- Many-to-many. Satu task boleh punya banyak tag.
- **Tidak ada fitur Folder.** Sudah dibuang dari scope. Jangan tambahkan.
- Tag disimpan sebagai array string di dalam task.

## Dark mode

- Bukan fitur tempelan. Semua warna pakai token/CSS variable sejak awal.
- Jangan pernah hardcode warna di komponen.
- Pilihan tema disimpan di localStorage.

## Responsif

Harus nyaman di HP, tablet, laptop. Desain mobile-first.

---

# Di luar scope

Jangan bangun ini kecuali saya minta eksplisit:
pengingat/notifikasi, kalender, favorit, halaman statistik, login,
sinkronisasi database, folder, subtask, recurring task.

---

# Cara kerja yang saya harapkan

1. Untuk tugas apa pun yang lebih dari sepele: **rencana dulu, kode belakangan.**
   Tunggu saya setujui rencananya.
2. Satu fitur per sesi. Jangan lari ke depan.
3. Setelah selesai, beri tahu saya **cara memverifikasinya secara manual** —
   langkah konkret, bukan "silakan dicoba".
4. Kalau saya tanya kenapa kamu menulis sesuatu, jelaskan sejujurnya. Termasuk
   kalau itu pilihan yang lemah.
