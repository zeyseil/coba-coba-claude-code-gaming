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
- Pengecualian yang sudah disetujui: `@dnd-kit` (core + sortable + utilities)
  untuk reorder drag (mouse + touch + keyboard). Ini satu-satunya library di
  luar aturan default; penambahan lain tetap harus ditanyakan.

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
2026-07-16 (fitur Calendar View — keputusan out-of-scope sebelumnya dibalik
atas permintaan eksplisit, sesi terpisah setelah fitur Subtask; mengikuti
`.claude/Engineering-Spec-Calendar-View.md`).

## Sudah jadi

- Lapisan penyimpanan terisolasi di `src/lib/storage.js` (semua fungsi async).
- Task CRUD: tambah, edit (klik judul), toggle complete, hapus.
- Prioritas + deadline + status precedence (`src/lib/taskStatus.js`).
- Tag many-to-many (input + normalisasi di storage).
- Search + filter multi-dimensi via `getVisibleTasks` (`src/lib/getVisibleTasks.js`).
- Progress bar dari seluruh task + baris "Showing X of Y tasks".
- Token warna + komponen `Button`, dark mode, responsif (satu breakpoint `sm:`).
- Sort By: Manual / Priority / Deadline (`src/lib/sortTasks.js`).
- Reorder manual via `@dnd-kit` (pointer + touch + keyboard, DragOverlay); tombol
  ↑↓ dihapus. Aktif hanya saat Sort = Manual & tak terfilter.
- Tampilan deadline sesuai aturan "Deadline > Tampilan" (`formatDeadline`).
- Validasi/sanitasi bentuk tiap task di `readState()` (`sanitizeTask`): task
  rusak dibuang (tanpa id/title) atau di-coerce (field lain), tidak meng-crash
  app dan tidak menimpa data buruk.
- Trim input tag sebelum cek kosong (tag berisi spasi tidak lagi jadi chip yang
  hilang diam-diam saat disimpan).
- Semantik keyboard/tombol untuk judul yang diklik (a11y): `role="button"`,
  fokusabel, Enter/Space, `aria-label`.
- Konfirmasi hapus inline dua-langkah (Delete → Confirm/Cancel), state lokal
  per-baris di `TaskRow`.
- New task & Filters di balik tombol popup native `<dialog>` (Escape/backdrop
  close, focus-trap bawaan); tombol Filters punya indikator filter aktif; Sort
  By tetap terlihat di halaman. Token `--color-overlay` untuk backdrop.
- Undo hapus terakhir (`restoreTask`), memulihkan task ke posisi semula; baris
  Undo persisten sampai aksi task berikutnya.
- Drag ghost kustom = clone `RowOverlay` di `<DragOverlay>` (bukan native
  `setDragImage`); auto-scroll saat drag = default `@dnd-kit` (tidak diubah).
- Motion & transisi: token `--color-row-hover`, hover baris & tombol, transisi
  warna judul saat toggle complete, animasi buka `<dialog>`, fade/slide untuk
  undo bar & error. Semua dimatikan lewat guard `prefers-reduced-motion` di
  `src/index.css` (a11y). Tidak ada animasi enter/exit per-baris (sengaja).
- Multi-select + bulk actions: tombol "Select" masuk *selection mode* (checkbox
  seleksi + `SelectionBar`; drag & edit-on-click judul nonaktif). State
  `selectedIds` (Set) + `selectionMode` efemeral di `App`, beroperasi atas
  `visible`. Bulk delete (+undo array `lastDeleted`, loop `restoreTask`), bulk
  complete/uncomplete (loop `updateTask`). Semua loop bulk sekuensial `await`
  (bukan `Promise.all`) karena tiap fungsi storage read-modify-write sendiri;
  seleksi dikosongkan setelah tiap aksi. Konfirmasi hapus dua-langkah di
  `SelectionBar`.
- Halaman statistik: dialog popup yang menampilkan total/active/completed,
  breakdown per prioritas (high/medium/low), breakdown per tag dengan count.
  Dihitung dari **seluruh task** (bukan filtered) via `getTaskStats`
  (`src/lib/getTaskStats.js`). Komponen presentasional `StatsDialog.jsx`
  mengikuti pola `FilterControls`. Tombol "Statistics" di header, dialog native
  `<dialog>` dengan pola sama seperti Filters (backdrop-click, Escape, Done).
- Favorite/pin task: field `favorite` (boolean) di model task, di-sanitasi di
  `sanitizeTask` dan default `false` di `createTask` (`src/lib/storage.js`),
  pola sama persis dengan `completed`. Toggle lewat tombol bintang di
  `TaskRow.jsx` (dekat checkbox complete), pakai `onUpdate` generic yang sudah
  ada — tidak ada fungsi storage baru. Favorit **selalu mengambang ke atas**
  di ketiga mode Sort By (Manual/Priority/Deadline): `sortTasks.js` mempartisi
  task jadi favorit/non-favorit dulu, lalu mengurutkan tiap partisi dengan
  logika sort yang sama seperti sebelumnya. Ini keputusan sadar: favorit bukan
  opsi Sort By ke-4, tapi pin yang berlaku di semua mode. Belum ada filter
  "Favorites only" dan belum ada bulk action favorite di `SelectionBar` —
  sengaja ditunda (lihat Backlog).
- Folder: keputusan "Tidak ada fitur Folder" sebelumnya **dibalik atas
  permintaan eksplisit** — bukan tebakan. Desain: satu folder per task (field
  `folderId`, bukan many-to-many seperti tag), folder adalah entity terkelola
  (`folders` di storage, CRUD lewat dialog "Manage Folders" — tombol baru di
  header), dan tampil sebagai filter exclusive (radio All/No folder/per
  folder) di `FilterControls`, bukan grouping/section di list. Schema
  localStorage naik ke versi 2 (`{ version, tasks, folders }`); task lama
  tanpa `folderId` dapat default `null` lewat `sanitizeTask` (tidak perlu
  migrasi terpisah). Hapus folder = unassign semua task di dalamnya
  (`folderId: null`), task-nya sendiri tidak ikut terhapus — satu write di
  `deleteFolder` (`src/lib/storage.js`). Rename folder di dialog Manage
  Folders memakai pola sama seperti edit judul task (klik untuk edit inline);
  hapus folder pakai pola konfirmasi dua-langkah yang sama seperti hapus task.
  Belum ada breakdown per-folder di Statistik dan belum ada drag-drop urutan
  folder — sengaja ditunda (lihat Backlog).
- Subtask: keputusan "Tidak ada fitur Subtask" sebelumnya **dibalik atas
  permintaan eksplisit**. Desain: checklist sederhana di dalam task, bukan
  task bersarang — field baru `subtasks: Subtask[]` di Task, tiap `Subtask`
  cuma `{ id, title, completed }` (tanpa priority/deadline/tag sendiri).
  Schema localStorage naik ke versi 3; migrasi dilakukan dengan menerima
  payload versi 2 sebagai kompatibel di `readState()` (`src/lib/storage.js`)
  supaya data lama tidak hilang — task lama otomatis dapat `subtasks: []`
  lewat `sanitizeTask` (pola sama seperti `folderId` saat migrasi ke v2).
  Tidak ada fungsi storage baru untuk operasi subtask individual: mengikuti
  pola tags — caller menghitung array `subtasks` baru lalu memanggil
  `updateTask(id, { subtasks })`, dinormalisasi oleh `normalizeSubtasks` (mirip
  `normalizeTags`, tapi title tidak di-lowercase karena bukan dedupe key).
  UI: `TaskRow.jsx` punya tombol expand/collapse (state `expanded`, default
  tertutup) + badge progress "x/y" yang selalu terlihat begitu ada subtask;
  tombol ini di luar mode edit judul jadi checklist tetap bisa dioperasikan
  (add/toggle/rename/delete) baik task sedang di-edit atau tidak — sama
  seperti toggle complete/favorite yang langsung aktif. Checklist sendiri ada
  di komponen baru `SubtaskList.jsx`, mengikuti pola 3-state (view / renaming
  / confirming-delete) yang sama seperti dialog "Manage Folders": klik judul
  subtask untuk rename inline, hapus pakai konfirmasi dua-langkah. Belum ada
  subtask yang match ke search/filter, belum ada breakdown subtask di
  Statistik, belum ada drag-reorder subtask, belum ada bulk action subtask di
  SelectionBar — sengaja ditunda (lihat Backlog).
- Calendar View: keputusan "Tidak ada fitur Kalender" sebelumnya **dibalik
  atas permintaan eksplisit**, mengikuti
  `.claude/Engineering-Spec-Calendar-View.md`. Murni view layer di atas Task
  yang ada — tidak ada model/entity Calendar baru, tidak ada penyimpanan
  terpisah. Toggle halaman List ↔ Calendar lewat state baru `activeView` di
  `App.jsx` (bukan dialog popup seperti fitur lain) karena Calendar adalah
  tampilan penuh (month grid + navigasi), bukan panel kecil. Grid bulan (6
  minggu x 7 hari, Minggu-first) dihitung murni dari `Date` bawaan — tidak ada
  date library baru — di `getMonthGrid` (`src/lib/groupTasksByDate.js`), yang
  otomatis benar untuk tahun kabisat & pergantian tahun/bulan. Task
  dikelompokkan ke tanggal lokal (bukan UTC, aturan sama seperti
  `lib/deadline.js`) lewat `groupTasksByDate` di file yang sama; task tanpa
  deadline tidak pernah dikelompokkan (tidak muncul di kalender). Komponen
  `CalendarView.jsx` murni presentasional (pola sama seperti `StatsDialog`):
  header navigasi (prev/next month via `Button`, tombol Today), grid 42 sel
  dengan maks 3 judul task per sel lalu `+N more`, dan panel per-tanggal di
  bawah grid. Klik task di panel me-render ulang komponen `TaskRow` yang
  sama persis dengan List (reuse penuh inline edit mode termasuk field
  deadline serta indikator overdue dari `getTaskStatus`) — tidak ada
  komponen editor baru, dan edit deadline lewat kalender memakai jalur
  `updateTask` yang sama seperti edit biasa. Kalender **mengabaikan filter**
  List (Status/Priority/Tag/Folder/Search) — keputusan sadar agar mental
  model tetap sederhana: kalender selalu menampilkan seluruh task berdeadline
  terlepas dari filter yang aktif di List. Tombol "Select" dan "Sort by" hanya
  tampil saat `activeView === "list"` (tidak relevan untuk kalender). Belum
  ada drag-and-drop antar sel kalender untuk pindah deadline (edit hanya lewat
  inline edit `TaskRow`) — sengaja tidak dikerjakan, sesuai spec §12.

## Backlog (belum dikerjakan — catatan, bukan janji)

- Animasi enter/exit per-baris task (butuh presence-tracking; ditunda).
- Wrapper batch opsional di `storage.js` (`deleteTasks`/`restoreTasks`/
  `updateTasks`, satu tulisan per aksi) kalau list membesar — sekarang loop
  sekuensial sudah cukup.
- Filter "Favorites only" di `FilterControls`/`getVisibleTasks` (dimensi baru,
  AND dengan filter lain) — ditunda sampai diminta.
- Bulk action "Favorite/Unfavorite selected" di `SelectionBar` (mirror pola
  bulk complete/uncomplete) — ditunda sampai diminta.
- Breakdown per-folder di halaman Statistik (`getTaskStats`/`StatsDialog`) —
  ditunda sampai diminta.
- Drag-and-drop urutan folder di dialog Manage Folders — ditunda sampai diminta.
- Subtask match ke search/filter — ditunda sampai diminta.
- Breakdown subtask di halaman Statistik — ditunda sampai diminta.
- Drag-reorder subtask di dalam checklist — ditunda sampai diminta.
- Bulk action subtask (mis. "complete all subtasks") di `SelectionBar` —
  ditunda sampai diminta.

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
  favorite    boolean
  folderId    string | null   (uuid folder, atau null = tanpa folder)
  subtasks    Subtask[]       (boleh kosong)
  order       number
  createdAt   string   (ISO 8601)
}

Subtask {
  id          string   (uuid)
  title       string   (wajib, tidak boleh kosong/whitespace)
  completed   boolean
}

Folder {
  id          string   (uuid)
  name        string   (wajib, tidak boleh kosong/whitespace)
  order       number
  createdAt   string   (ISO 8601)
}
```

Data disimpan di localStorage dengan **versi skema**:

```
{ "version": 3, "tasks": [...], "folders": [...] }
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
- Tag disimpan sebagai array string di dalam task.

## Folder

- **Satu folder per task** (bukan many-to-many seperti tag). Field `folderId`
  di task: string (uuid folder) atau `null` (tanpa folder).
- Folder adalah **entity terkelola**: daftar folder tersendiri (`folders` di
  storage), bisa dibuat/di-rename/dihapus lewat dialog "Manage Folders".
- **Hapus folder = unassign, bukan hapus task.** Task yang tadinya di folder
  itu jadi `folderId: null`, task-nya sendiri tetap ada.
- Folder tampil sebagai **filter exclusive** (radio: All / No folder / per
  folder) di `FilterControls`, sama seperti Status/Date — bukan sebagai
  grouping/section di list task.
- Belum ada drag-and-drop untuk urutan folder, dan belum ada breakdown folder
  di halaman Statistik — di luar scope sesi ini kecuali diminta.

## Subtask

- **Satu task boleh punya banyak subtask** (array `subtasks`), tapi subtask
  **tidak boleh bersarang** (tidak ada sub-subtask).
- Subtask hanya punya `title` + `completed`. **Tidak ada** priority/deadline/tag
  sendiri per subtask — dimensi-dimensi itu tetap milik task induk.
- Checklist subtask **collapsible** di `TaskRow`: default tertutup, ada tombol
  expand/collapse. Badge progress ("x/y") tampil begitu task punya minimal
  satu subtask.
- Menambah/toggle/rename/hapus subtask **selalu aktif**, tidak terkunci ke mode
  edit judul task.
- Status/completed task **tidak otomatis berubah** karena semua/sebagian
  subtask selesai — keduanya independen (task punya `completed` sendiri).

## Dark mode

- Bukan fitur tempelan. Semua warna pakai token/CSS variable sejak awal.
- Jangan pernah hardcode warna di komponen.
- Pilihan tema disimpan di localStorage.

## Responsif

Harus nyaman di HP, tablet, laptop. Desain mobile-first.

---

# Di luar scope

Jangan bangun ini kecuali saya minta eksplisit:
pengingat/notifikasi, login,
sinkronisasi database, recurring task.

(Kalender sudah dikerjakan — lihat "Status implementasi" di atas — sesuai
`.claude/Engineering-Spec-Calendar-View.md`.)

---

# Cara kerja yang saya harapkan

1. Untuk tugas apa pun yang lebih dari sepele: **rencana dulu, kode belakangan.**
   Tunggu saya setujui rencananya.
2. Satu fitur per sesi. Jangan lari ke depan.
3. Setelah selesai, beri tahu saya **cara memverifikasinya secara manual** —
   langkah konkret, bukan "silakan dicoba" jika memerlukan verifikasi secara manual oleh user, selain itu otomatis.
4. Kalau saya tanya kenapa kamu menulis sesuatu, jelaskan sejujurnya. Termasuk
   kalau itu pilihan yang lemah.
5. **PENTING: Setiap sesi selesai, perbarui bagian "Status implementasi" di file
   ini (CLAUDE.md).** Tambahkan fitur baru ke "Sudah jadi", hapus dari
   "Backlog" atau "Di luar scope" jika relevan, dan update tanggal di baris
   "Diperbarui". Ini menjaga CLAUDE.md tetap akurat sebagai single source of
   truth untuk apa yang sudah dikerjakan.

## Git Workflow

Setelah menyelesaikan setiap task atau perubahan yang diminta:

1. Pastikan seluruh perubahan telah selesai dan project tetap dapat dijalankan.
2. Jalankan lint, formatter, dan test yang tersedia.
3. Review kembali perubahan sebelum melakukan commit.
4. Buat commit dengan pesan yang jelas mengikuti Conventional Commits.
5. Push perubahan ke branch kerja (jangan langsung ke `main`).
6. Setelah push berhasil, buat Pull Request ke repository GitHub menggunakan GitHub CLI (`gh`) atau integrasi GitHub yang tersedia.
7. Isi Pull Request dengan:
   - Ringkasan perubahan
   - Alasan perubahan
   - Cara melakukan pengujian
   - Catatan tambahan jika ada
8. Setelah PR berhasil dibuat, tampilkan URL Pull Request kepada pengguna.

Jika pembuatan PR gagal karena izin, autentikasi, atau repository belum terhubung, hentikan proses tersebut dan jelaskan penyebabnya beserta langkah yang perlu dilakukan pengguna.

## Mandatory GitHub Pull Request

Setiap kali menyelesaikan implementasi fitur, bug fix, refactor, atau perubahan kode:

- Wajib membuat commit.
- Wajib melakukan push ke branch aktif.
- Wajib membuat Pull Request ke branch target menggunakan GitHub CLI (`gh pr create`) atau integrasi GitHub yang tersedia.
- Jangan menganggap pekerjaan selesai sampai Pull Request berhasil dibuat atau terdapat kegagalan yang tidak dapat diatasi (misalnya autentikasi atau permission).
- Jika gagal membuat PR, laporkan penyebabnya dan tampilkan perintah yang harus dijalankan pengguna.

# Review & Discussion Response Style

Ketika pengguna meminta review, evaluasi, pendapat, brainstorming, atau diskusi (dan TIDAK meminta implementasi), gunakan alur berikut secara konsisten.

## 1. Identifikasi jenis permintaan

Awali dengan menjelaskan jenis permintaan.

Contoh:

- This is a review/discussion request, not an implementation task.
- This is a design review request.
- This is an architectural discussion.
- This is a planning discussion.

Jangan langsung melakukan implementasi, menulis kode, ataupun membuat rencana implementasi kecuali diminta.

---

## 2. Jangan melakukan eksplorasi kode

Untuk request review atau diskusi:

- jangan membaca banyak file hanya untuk mencari jawaban,
- jangan mengubah kode,
- jangan membuat commit,
- jangan membuat Pull Request,
- gunakan informasi yang sudah diketahui dari konteks proyek.

Hanya eksplorasi kode bila pengguna secara eksplisit meminta investigasi.

---

## 3. Jika pengguna meminta penilaian beberapa opsi

Selalu gunakan tabel.

Gunakan format berikut.

| Item | Direkomendasikan? | Alasan |
|------|-------------------|--------|
| ... | Ya / Tidak / Nanti | alasan singkat |

Alasan cukup 1–3 kalimat.

Hindari paragraf panjang untuk setiap item.

---

## 4. Berikan rekomendasi yang tegas

Setelah tabel, selalu buat bagian rekomendasi.

Format:

- kandidat terbaik dikerjakan sekarang
- kandidat yang sebaiknya ditunda
- kandidat yang sebaiknya dihindari
- alasan prioritas

Jangan hanya menjelaskan pro dan kontra tanpa mengambil kesimpulan.

---

## 5. Pertimbangkan dampak teknis

Saat memberi penilaian, pertimbangkan:

- kompleksitas implementasi
- perubahan arsitektur
- risiko bug
- dampak terhadap UX
- maintenance jangka panjang
- konsistensi dengan scope proyek
- effort vs value

Jelaskan secara ringkas.

---

## 6. Gunakan bahasa yang ringkas

Target:

- langsung ke inti
- bullet point bila perlu
- tabel untuk perbandingan
- hindari penjelasan berulang
- hindari paragraf yang terlalu panjang

Jawaban review harus mudah dipindai (scannable).

---

## 7. Jangan berubah menjadi implementasi

Review tetap review.

Jangan:

- menulis kode
- membuat pseudocode
- membuat TODO implementasi
- mengubah file
- membuat patch

Kecuali pengguna secara eksplisit meminta langkah implementasi.

---

## 8. Tutup dengan rekomendasi akhir

Akhiri dengan satu paragraf yang berisi keputusan akhir.

Contoh gaya:

- Jika hanya memilih satu fitur berikutnya, saya merekomendasikan ...
- Saya tidak menyarankan mengerjakan ... sekarang karena ...
- Setelah fitur ... selesai, baru pertimbangkan ...
- Urutan prioritas yang saya rekomendasikan adalah ...

Jawaban harus berakhir dengan rekomendasi yang jelas, bukan hanya analisis.

## Review Philosophy

Saat melakukan review:

- Bertindak sebagai senior software engineer yang sedang melakukan design review.
- Jangan hanya menjawab pertanyaan pengguna; lakukan evaluasi kritis.
- Berani mengatakan suatu ide tidak layak apabila memang memiliki biaya implementasi yang lebih besar daripada manfaatnya.
- Prioritaskan kesederhanaan, maintainability, dan konsistensi arsitektur dibanding menambah fitur.
- Jika terdapat satu opsi yang jelas lebih baik, rekomendasikan opsi tersebut secara eksplisit.
- Hindari jawaban yang terlalu diplomatis seperti "semuanya tergantung kebutuhan" apabila terdapat rekomendasi teknis yang lebih masuk akal.