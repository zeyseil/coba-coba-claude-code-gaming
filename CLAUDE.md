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
2026-07-17 (sesi kelima hari ini: Desktop Wrapper via Tauri v2 — tray +
scheduler reminder di proses Rust + autostart Windows, sehingga reminder muncul
walau window ditutup; `storage.js` TIDAK disentuh karena tray hanya butuh
`[{title, fireAt}]`, bukan database task — ini mengoreksi klaim lama di Backlog
bahwa fitur ini butuh pindah dari localStorage; `App.jsx` juga nol perubahan.
Lihat entri "Desktop Wrapper (Tauri)" di bawah. Sesi keempat hari ini: OS-level
Local Notification via Capacitor —
NotificationService sebagai satu-satunya pemanggil Capacitor, fungsi murni
baru `getScheduledReminders` di `reminder.js`, sync via satu `useEffect` di
`App.jsx`, scaffold native `android/` + AndroidManifest; mengikuti
`.claude/Engineering-Spec-Local-Notification.md`, offset tetap global sesuai
CLAUDE.md, lihat entri "Local Notification (Capacitor)" di bawah. Sesi ketiga
hari ini: reminder/pengingat in-app local-only —
engine murni `reminder.js` + modul preferensi `reminderPreference.js` +
banner due-soon + dropdown offset di `App.jsx`, plus vitest sebagai test
pertama di repo; keputusan "pengingat di luar scope" dibalik atas permintaan
eksplisit, lihat entri "Reminder / pengingat in-app" di bawah. Sesi kedua
hari ini: warna semantik untuk tombol Complete/
Delete/Uncomplete — 3 pasang token warna baru, lihat entri "Warna semantik
tombol aksi" di bawah. Sesi pertama hari ini: perapian interaksi UI — touch
target checkbox
seleksi (item Backlog terakhir dari audit, sekarang ditutup), hover/press
tombol subtask, checkbox complete jadi tombol Complete/Uncomplete berkonfirmasi,
perbaikan bug centering dialog, dan filter jadi draft sampai Done ditekan;
lihat entri "Perapian interaksi UI" di bawah. Sebelumnya, 2026-07-16 sesi
ketiga: audit UI seluruh app terhadap
`.claude/DESIGN_SYSTEM.md` — bukan fitur baru, murni perbaikan a11y &
konsistensi, lihat entri "Audit Design System" di bawah. Sesi kedua hari ini,
setelah fitur Recurring Task: breakdown
folder/subtask/recurring template di Statistik, plus perapian baris
`TaskRow` — drag handle permanen kiri dan checkbox complete/delete pindah ke
edit mode, lihat entri terkait di bawah; fitur Recurring Task sendiri —
keputusan out-of-scope sebelumnya dibalik atas permintaan eksplisit, sesi
terpisah setelah fitur Calendar View; mengikuti
`.claude/Engineering-Spec-Recurring-Task.md` sebagai referensi, bukan
kontrak kaku — beberapa gap di spec diselesaikan lewat konfirmasi eksplisit
ke user, lihat detail di bawah).

## Sudah jadi

- Desktop Wrapper (Tauri v2) — reminder muncul di Windows walau window ditutup.
  Melanjutkan Local Notification: Capacitor menutup Android, ini menutup desktop.
  **Tauri, bukan Electron** — dipilih user setelah perbandingan eksplisit
  (rekomendasi saya waktu itu Electron, karena proses main-nya JavaScript
  sehingga bisa direview user sendiri sesuai baris 1 CLAUDE.md; user memilih
  Tauri sadar akan biayanya: Rust di proses main + toolchain MSVC). Ternyata
  Rust + MSVC + WebView2 **sudah terpasang** di mesin dev, jadi tidak ada
  pengulangan derita toolchain sesi Android.
  **Keputusan terpenting: `storage.js` TIDAK disentuh sama sekali** — ini
  membalik klaim lama di Backlog bahwa fitur ini butuh memindahkan penyimpanan
  keluar dari localStorage. Klaim itu salah: proses tray tidak butuh database
  task, ia cuma butuh hasil `getScheduledReminders`, yaitu `[{title, fireAt}]`.
  Task tidak bisa berubah tanpa window terbuka, jadi renderer cukup mendorong
  daftar itu lewat IPC tiap kali berubah dan Rust menyimpannya ke satu file JSON
  kecil (`%APPDATA%\com.todolistmodern.desktop\reminders.json`). Cache tidak
  bisa basi. Konsekuensi: tidak ada field baru di Task, tidak ada bump schema
  (tetap v4), dan **`App.jsx` nol perubahan** — efek `[tasks, reminderOffset]`
  yang sudah ada otomatis menutup semua aksi task, dan banner "open Settings"
  otomatis inert karena permission desktop tidak pernah `"denied"`. Ini buah
  dari seam yang sudah benar di sesi Capacitor.
  Arsitektur: **`notificationService.js` tetap satu-satunya file yang tahu soal
  platform** — identitasnya melebar dari Capacitor-aware jadi platform-aware
  lewat `platform()` → `"capacitor"` | `"tauri"` | `"web"` (Tauri v2 dideteksi
  dari global `window.__TAURI_INTERNALS__`). Policy penjadwalan **dipakai ulang
  100%**: `getScheduledReminders` di `reminder.js` tidak diubah satu baris pun
  dan melayani Android maupun desktop. Di sisi Rust, satu-satunya aturan waktu
  ada di fungsi murni `partition_due(reminders, now_ms)`
  (`src-tauri/src/scheduler.rs`), terpisah dari Tauri supaya bisa dites;
  `lib.rs` cuma plumbing.
  **Polling, bukan timer per-reminder**: satu thread `std::thread` yang tidur
  30 detik lalu memeriksa `fire_at <= now_ms`. Ini sengaja — timer yang diset
  berjam-jam ke depan hilang saat mesin sleep, meleset saat jam/timezone
  berubah, dan diam-diam salah di atas plafon ~24 hari. Polling cuma "sadar" di
  tick berikutnya. Karena itu **tidak perlu power-monitor API** (Tauri tidak
  punya bawaannya) — sleep/resume tertangani gratis. Reminder yang terlewat saat
  mesin tidur **fire telat, bukan dibuang** (konsisten `allowWhileIdle` Android).
  Sengaja **tanpa `tokio`** (thread biasa, tidak ada async lain di app ini) dan
  **tanpa `chrono`**: `fireAt` dikirim sebagai epoch millis (`fireAt.getTime()`),
  bukan ISO string, sehingga Rust tidak pernah mem-parse tanggal dan aturannya
  jadi perbandingan integer.
  Tray: Open / "Start with Windows" (CheckMenuItem) / Quit. **Close = hide, bukan
  quit** (`CloseRequested` → `prevent_close` + `hide`) — kalau close mengakhiri
  proses, seluruh premis fitur ini gugur. `tauri-plugin-single-instance` dipakai
  karena autostart bisa balapan dengan launch manual, dan dua salinan akan
  menembakkan tiap reminder dua kali. Toggle autostart membaca balik
  `is_enabled()` setelah menulis, bukan mempercayai centangnya sendiri — checkbox
  yang berbohong lebih buruk daripada tidak ada.
  **Autostart ditulis sendiri di `src-tauri/src/autostart.rs`, BUKAN lewat
  `tauri-plugin-autostart`** — jangan "rapikan" ini kembali ke plugin. Plugin itu
  (lewat crate `auto-launch` 0.5.0) menulis Run key sebagai
  `format!("{} {}", app_path, args)` **tanpa kutip sama sekali**
  (`tauri-plugin-autostart-2.5.1/src/lib.rs:189` mengoper path mentah dari
  `current_exe()`, lalu `auto-launch-0.5.0/src/windows.rs` menggabungkannya
  begitu saja). Windows memecah value Run tanpa kutip di spasi pertama, jadi
  `C:\Users\M Sulthon R\AppData\Local\To-Do List Modern\app.exe --hidden` dibaca
  sebagai "jalankan `C:\Users\M`". Ini **terbukti di mesin dev**: entri muncul di
  Task Manager dengan nama **"M"**, bukan "To-Do List Modern", dan app tidak
  pernah menyala setelah restart. Username user *dan* folder instalasi
  dua-duanya berspasi, jadi tidak ada cara menghindarinya. Menyelipkan kutip ke
  dalam path yang dioper ke plugin juga bisa, tapi cuma dengan bergantung pada
  bug itu tidak pernah diperbaiki upstream (kalau diperbaiki → kutip ganda).
  Modul sendiri: `run_command()` (fungsi murni, selalu mengutip, dites termasuk
  kasus `C:\Users\M`), plus `enable`/`disable`/`is_enabled` langsung ke `winreg`.
  `is_enabled` mensyaratkan **dua** hal sekaligus — value Run ada DAN
  `StartupApproved\Run` tidak menonaktifkannya (byte 0: `0x02` = enabled,
  `0x03` = disabled; 8 byte terakhir = timestamp saat dinonaktifkan, nol kalau
  aktif) — sebab flag Task Manager menang atas keberadaan value Run.
  **Batas platform yang jujur: Windows TIDAK punya padanan `AlarmManager`.**
  Tidak ada alarm OS yang bisa dititipi lalu app boleh mati. Prosesnya **wajib
  hidup**, jadi tray + autostart di sini bukan pelengkap melainkan syarat mati —
  beda mendasar dari Android yang benar-benar menitipkan alarm ke OS.
  **Packaging dikerjakan** (membalik keputusan awal "tanpa packaging", yang
  diambil di konteks Electron): toast Windows butuh AppUserModelID terdaftar
  lewat shortcut Start Menu, dan binary `tauri dev` mentah tidak punya itu —
  terbukti terukur, `HKCU\Software\Classes\AppUserModelId\com.todolistmodern.desktop`
  kosong sebelum install. Autostart juga butuh binary stabil, bukan
  `target/debug/`. Bundler Tauri bawaan dan binary build lokal tidak kena
  SmartScreen, jadi kedua keberatan asli terhadap packaging tidak berlaku.
  Identifier `com.todolistmodern.desktop` sengaja **beda** dari Capacitor
  `com.todolistmodern.app` — app terpisah, AUMID terpisah.
  `vite.config.js` cuma dapat `server.strictPort: true` (nol dampak ke
  `vite build`, jadi build Android aman): tanpa itu vite diam-diam pindah port
  saat 5173 terpakai sementara `devUrl` menunjuk 5173, sehingga `tauri dev`
  memuat app lain yang menyamar sebagai app ini — sempat benar-benar terjadi
  saat sesi ini.
  **Dependency baru (disetujui eksplisit):** npm `@tauri-apps/api`, dev
  `@tauri-apps/cli`; Cargo `tauri` (feature `tray-icon`),
  `tauri-plugin-notification`, `tauri-plugin-single-instance`, `serde`,
  `serde_json`, `winreg`. `tauri-plugin-autostart` **dipakai lalu dibuang** —
  lihat alasan quoting di atas; `winreg` menggantikannya (net: tetap satu
  dependency, dan `winreg` sebelumnya sudah ikut transitif lewat plugin itu).
  `tauri-plugin-log` + `log` yang ditambahkan `tauri init` **dibuang** — tidak
  ditanyakan, dan `println!` sudah cukup. Test runner kedua: `npm run test:rust`
  (`cargo test`, 13 test: 8 untuk `partition_due` termasuk yang mengunci wire
  format `fireAt`, 5 untuk quoting autostart); `npm run test` tetap vitest
  18 test.
  **Verifikasi — SUDAH terbukti otomatis:** (1) rantai IPC penuh, di build dev
  maupun release (`reminders.json` dihapus → app dijalankan → file lahir kembali
  berisi `[]`, yang hanya mungkin kalau renderer termuat → `platform()`
  mengenali Tauri → `invoke` sampai ke command Rust → cache ditulis); (2) tick
  loop menembakkan reminder **tanpa renderer sama sekali** — vite dimatikan
  supaya renderer gagal memuat dan tidak bisa menimpa cache, reminder disuntik
  dengan `fireAt` 40 detik ke depan, lalu cache terkuras sendiri jadi `[]` tepat
  di tick pertama; ini persis skenario autostart-ke-tray; (3) 8 test `cargo test`
  untuk `partition_due` + 18 test vitest tetap hijau; (4) AUMID: terukur
  **kosong** sebelum install, dan setelah install shortcut Start Menu membawa
  `System.AppUserModel.ID = com.todolistmodern.desktop` — ini mengonfirmasi
  diagnosis bahwa `tauri dev` mentah tidak bisa menampilkan toast.
  **Terverifikasi user (sesi susulan):** toast Windows benar-benar TERLIHAT
  ("Task due soon" + judul task, di bawah header "To-Do List Modern"), dan tray
  Open/Quit berfungsi. **Autostart: bug ditemukan lalu diperbaiki** — lihat
  entri quoting di atas; perbaikannya belum diverifikasi user lewat restart
  sungguhan.
  **Pelajaran penting soal lingkungan verifikasi:** shell PowerShell yang saya
  pakai adalah anak dari Claude Desktop, yang ternyata aplikasi MSIX
  (`Claude_pzs8sxrjxfjjc`), sehingga **mewarisi virtualisasi paketnya** —
  `Start-Process` ke path asli melahirkan proses yang melaporkan dirinya di
  `...\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\...`, dan pembacaan
  `HKCU\...\Run` dari sana **tidak melihat registry asli** (entri autostart yang
  nyata-nyata ada tetap terbaca kosong berkali-kali). Ini sempat menyesatkan
  diagnosis ke arah yang salah dua kali (Wise Disk Cleaner, lalu BingSvc).
  Konsekuensi untuk sesi berikutnya: **apa pun yang menyangkut registry HKCU
  asli, path instalasi, atau perilaku boot TIDAK bisa diverifikasi dari shell —
  wajib lewat user.** Yang tetap sahih diverifikasi dari shell: `cargo test`,
  `npm run test`, build, dan file di bawah `%APPDATA%` (terbukti konsisten).
  Yang di luar scope: macOS/Linux, code signing, WinRT
  `ScheduledToastNotification` (satu-satunya jalan agar reminder fire dengan
  proses mati; butuh binding native).

- Local Notification (Capacitor) — reminder tingkat OS, local-only. Melanjutkan
  reminder in-app: banner in-app hanya terlihat saat app dibuka; fitur ini
  menitipkan alarm ke OS lewat Capacitor Local Notifications sehingga reminder
  muncul walau app tertutup. Tetap local-only (tanpa server/FCM/APNs), jalur
  yang dulu dicatat di Backlog sebagai satu-satunya yang tidak menggugurkan
  premis proyek. Mengikuti `.claude/Engineering-Spec-Local-Notification.md`
  sebagai kontrak (Architecture Notes hanya sebagai alasan teknis). Keputusan
  penting: **konflik spec vs CLAUDE.md diselesaikan ke arah CLAUDE.md atas
  konfirmasi eksplisit user** — reminder **tetap offset global**, bukan
  per-task; konsekuensinya **tidak ada field baru di Task, tidak ada bump
  schema (tetap v4), `storage.js` tidak disentuh sama sekali**.
  Arsitektur: **`src/lib/notificationService.js` adalah satu-satunya file yang
  boleh import Capacitor** (memenuhi Constraint "UI tidak boleh memanggil
  Capacitor langsung") — komponen React tidak pernah menyentuh plugin. Policy
  penjadwalan (task mana, jam berapa) ada di fungsi murni baru
  `getScheduledReminders(tasks, now, offsetMs)` di `src/lib/reminder.js`
  (`fireAt = deadline − offsetMs`, hanya `fireAt > now`), berdampingan dengan
  `getDueSoonTasks` (banner) — keduanya `now`-injected, `getDueSoonTasks`
  tidak diubah. Sinkronisasi lewat **satu `useEffect([tasks, reminderOffset])`**
  di `App.jsx`: karena semua aksi task (complete/delete/edit/undo/bulk/recurring)
  bermuara ke state `tasks`, satu efek ini menutup **semua** Business Rule §1–5
  tanpa hook per-aksi. Strategi **cancel-all lalu reschedule-all** (offset
  global → perubahan apa pun menjadwal-ulang semua): getPending → cancel →
  schedule set baru. Karena set selalu dibangun ulang, **ID notifikasi cukup
  sekuensial 1..N** (tanpa hash UUID→int, tanpa risiko tabrakan) dan "tanpa
  duplikat" (Rule §5) terpenuhi secara struktural. Resync kedua saat
  `visibilitychange` (bukan `@capacitor/app`, agar tak nambah dependency)
  menutup edge case timezone/jam berubah/reboot. **Web = fallback**:
  `Capacitor.isNativePlatform()` false → semua fungsi service no-op, banner
  due-soon in-app yang sudah ada jadi fallback web-nya (sengaja TIDAK memakai
  Notification API browser — konsisten keputusan sesi sebelumnya). UI izin:
  saat native + offset≠off + izin ditolak, tampil banner "Open Settings"
  (`LocalNotifications.openSettings()`) + panduan battery optimization dengan
  tautan `https://dontkillmyapp.com` (Arch Notes). Permission diminta lazy
  (hanya setelah user menyalakan reminder), lewat `ensurePermission()`.
  Native: **scaffold `android/`** via `npx cap add android` +
  `capacitor.config.json` (appId `com.todolistmodern.app`, webDir `dist`);
  AndroidManifest ditambah `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`,
  `USE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`; `schedule.allowWhileIdle: true`
  memetakan ke `setExactAndAllowWhileIdle()`. **Dependency baru (disetujui
  eksplisit):** `@capacitor/core`, `@capacitor/local-notifications`,
  `@capacitor/android`, dev `@capacitor/cli`. Test baru untuk
  `getScheduledReminders` di `reminder.test.js` (fireAt, past-fire dibuang,
  completed/no-deadline dibuang, offset null). **Verifikasi Android — DIPERBARUI
  sesi susulan (masih 2026-07-17):** user memasang Android Studio (bundled JBR
  JDK 21) dan menyediakan emulator **LDPlayer 9**; Android SDK command-line
  tools (`platform-tools`, `platforms;android-34`, `build-tools;34.0.0`)
  dipasang lewat `sdkmanager` atas izin eksplisit user. Build sempat gagal
  `Unable to establish loopback connection` — bug JDK Windows saat
  `java.io.tmpdir`/`TMP`/`TEMP` menunjuk path panjang berspasi; diperbaiki
  dengan mengarahkan `TMP`/`TEMP` ke path pendek tanpa spasi (`C:\gradletmp`).
  Junction tanpa-spasi (`C:\jbr`, `C:\androidsdk`) juga dibuat karena beberapa
  script `.bat` Android SDK pecah kalau path mengandung spasi. `./gradlew.bat
  assembleDebug` **BUILD SUCCESSFUL**, `app-debug.apk` dihasilkan. Diinstal ke
  LDPlayer via `ldconsole.exe installapp`/`launchex` (koneksi ADB TCP standar
  ke port LDPlayer `2222` gagal — device selalu "offline" walau port terbuka
  dan versi adb cocok, root cause belum ditelusuri karena `ldconsole` sudah
  cukup untuk install/launch; akibatnya **logcat tidak bisa diambil** sesi
  ini). **AC "reminder muncul sesuai jadwal" TERVERIFIKASI on-device**: user
  menjadwalkan task dengan deadline ~1 jam ke depan + offset "1 hour before",
  dan notifikasi Android asli ("Task due soon" + judul task) muncul tepat
  waktu di LDPlayer. iOS **tetap tidak dikerjakan** (butuh macOS). Yang
  sengaja di luar scope sesuai spec Non-Goals: Push/FCM/APNs, Hybrid/Silent
  Push, Notification History, Snooze, AI Reminder, Cloud Sync.

- Reminder / pengingat in-app (local-only). Keputusan "Di luar scope" untuk
  pengingat/notifikasi **dibalik atas permintaan eksplisit user**. Sesi ini
  **tidak** membangun wrapper apa pun (tidak ada Electron/Tauri, Capacitor,
  Notification API, service worker) — hanya lapisan logika + tampilan in-app,
  karena itu bagian yang bernilai di semua skenario wrapper masa depan dan
  bisa dipakai ulang tanpa perubahan. Engine murni di `src/lib/reminder.js`
  (`REMINDER_OFFSETS`, `offsetMsFor`, `getDueSoonTasks`) mengikuti pola
  `taskStatus.js`/`recurringEngine.js`: no I/O, `now` di-inject caller.
  **Offset global (bukan per-task)** → tidak ada field baru di model Task,
  tidak ada bump schema (tetap v4), `storage.js` tidak disentuh — "due soon"
  diturunkan sepenuhnya dari `task.deadline` yang sudah ada. Window =
  `now <= deadline <= now + offset`. **Keputusan desain: task overdue TIDAK
  masuk banner** (sudah punya indikator "⚠ Overdue" sendiri; menjaga
  overdue & due-soon tegak lurus seperti Status vs Tanggal di filter);
  task completed juga tidak pernah due soon. Offset **bisa diatur user**
  lewat dropdown "Remind" (Off / 1 jam / 1 hari / 3 hari), dipersist lewat
  modul preferensi sendiri `src/lib/reminderPreference.js` (pola identik
  `sortPreference.js` — preferensi UI tidak lewat `storage.js`). UI = banner
  ringkas dekat progress bar (markup + animasi `fade-slide-in` sama seperti
  undo bar), bisa di-expand untuk menampilkan judul + deadline task; dihitung
  dari **seluruh `tasks`** (bukan `visible`) memakai `const now` yang sudah
  ada di blok derived `App.jsx` — **tanpa timer/interval/state waktu baru**,
  jadi banner refresh natural tiap render. Banner + dropdown tampil di List
  maupun Calendar (offset relevan di keduanya, jadi tidak di-gate
  `activeView` seperti Sort By). **Vitest ditambahkan** sebagai devDependency
  (disetujui eksplisit — CLAUDE.md wajibkan tanya; ini test pertama di repo):
  `src/lib/reminder.test.js` menguji batas window inklusif, exclusion
  overdue/completed/no-deadline, offset null, dan urutan hasil. Script baru
  `npm run test` (`vitest run`), environment node default (tanpa
  jsdom/testing-library — yang diuji fungsi murni).

- Warna semantik untuk tombol aksi (`Button.jsx`): Complete = hijau, Delete =
  merah, Uncomplete = abu-abu (beda dari abu-abu chip subtask). Sebelumnya
  Complete/Uncomplete memakai variant `secondary` (netral) dan Delete memakai
  `danger` yang cuma teks merah dengan border transparan (nyaris tak
  terlihat) — sekarang ketiganya **filled solid** (latar penuh warna),
  dikonfirmasi eksplisit ke user karena ini keputusan yang mengubah sistem
  token warna yang baru saja diaudit. **6 token warna baru** ditambah ke
  `index.css` (light+dark, plus re-export `@theme inline`, mengikuti pola
  pasangan `-bg`/`-fg` yang sudah ada seperti `priority-*`): `success-bg`/
  `success-fg` (hijau), `danger-bg`/`danger-fg` (merah — token terpisah dari
  `status-overdue` yang tetap dipakai untuk teks peringatan "⚠ Overdue" dan
  pesan error, bukan direplace), `neutral-bg`/`neutral-fg` (abu-abu, sengaja
  beda dari `progress-track` yang dipakai chip subtask/folder/recurring badge
  supaya dua elemen abu-abu itu tidak menyatu). Total token warna naik dari
  20 jadi 26. Variant `danger` di `Button.jsx` diubah jadi filled — ini
  **otomatis mengubah semua tombol Delete/Confirm-delete di app** (TaskRow,
  SubtaskList, Manage Folders, Recurring templates, bulk delete di
  `SelectionBar`), bukan cuma di TaskRow — dikonfirmasi eksplisit ke user
  supaya "satu variant, satu arti" konsisten di semua tempat, bukan
  exception khusus TaskRow. Tombol "Confirm" di dialog konfirmasi Complete
  juga diubah dari `primary` (biru) ke `success` (hijau) — bukan permintaan
  eksplisit, tapi keputusan mengikuti akal sehat karena tombol itu melakukan
  aksi semantik yang identik (menyelesaikan task) dengan tombol Complete
  yang memicunya. Tombol Save/Cancel dan variant `secondary`/`ghost` lain
  **tidak disentuh** — perubahan warna hanya untuk 3 aksi yang diminta.

- Perapian interaksi UI (bukan fitur baru; a11y + feedback + satu bug fix).
  Tanpa dependency, token, maupun komponen baru. Yang dikerjakan:
  (1) **Bug: dialog tidak center.** Kelima dialog ternyata nempel di pojok
  kiri-atas, bukan di tengah. Penyebabnya preflight Tailwind v4 yang me-reset
  `margin: 0` lewat rule universal `*` — dan karena author stylesheet selalu
  mengalahkan UA stylesheet tanpa memandang specificity, reset itu membunuh
  `margin: auto` milik UA untuk `dialog:modal`, sementara `position: fixed;
  inset: 0` dari UA tetap berlaku. Diperbaiki dengan satu rule
  `dialog:modal { margin: auto }` di `index.css` — sengaja di CSS, bukan
  `m-auto` di tiap class string, supaya berlaku otomatis untuk dialog
  berikutnya dan alasannya terdokumentasi di satu tempat;
  (2) **touch target** checkbox seleksi `TaskRow`: `size-5 sm:size-4` →
  `size-6` (24×24 di mobile DAN desktop) + `cursor-pointer`. Ini menutup item
  Backlog terakhir dari audit Design System. Dibuat 24px di desktop juga
  karena WCAG 2.5.8 berlaku di semua viewport — desktop yang 16px justru lebih
  parah dari mobile yang 20px, jadi memperbaiki mobile saja tidak menutup gap;
  (3) **feedback tombol subtask**: `cursor-pointer` + `hover:border-accent
  hover:text-text active:opacity-80`. Meniru idiom `Button` tanpa memakai
  komponennya — tombol ini chip kecil (`px-2 py-1 text-xs`), memaksakannya ke
  `Button` butuh ~6 override yang melawan BASE. Preseden: favorite star juga
  tombol manual;
  (4) **checkbox `Completed` → tombol Complete/Uncomplete**. Tombol menyatakan
  aksinya, bukan state-nya. Complete memunculkan dialog konfirmasi;
  Uncomplete langsung tanpa konfirmasi (arah yang berisiko cuma satu).
  Punya animasi tekan `enabled:active:scale-95` — `transform` ikut ditambahkan
  ke daftar `transition-[...]` di `Button.jsx` BASE, karena kalau ditaruh lewat
  `className` justru menimpa seluruh daftar property BASE dan malah membunuh
  transisi warna. Dialog konfirmasinya **lokal di `TaskRow`** (bukan singleton
  di `App` seperti lima dialog lain): konfirmasi ini row-scoped, dan pendekatan
  App akan memaksa threading prop lewat `CalendarView` yang juga merender
  `TaskRow`. Karena lokal, Complete dari Calendar ikut jalan tanpa satu baris
  pun perubahan di `CalendarView.jsx`. Dialog dirender sebagai **sibling**
  `<li>` (pola sama seperti `{expanded && <SubtaskList/>}`), tidak di dalam
  `<form>` — tombol di dalam dialog tetap ter-asosiasi ke `<form>` leluhurnya,
  jadi kalau di-nest Confirm akan men-submit form edit;
  (5) **filter jadi draft**: ini **membalik keputusan lama "filter apply-live"**
  yang dulu terdokumentasi eksplisit di komentar `App.jsx` — atas permintaan
  eksplisit user. Sekarang `draftFilters` di `App` yang di-edit dialog, dan
  baru masuk ke `filters` saat Done ditekan. Escape/backdrop cuma menutup;
  draft yang belum di-commit terbuang sendirinya karena di-sinkron ulang dari
  `filters` **saat dialog dibuka** — sengaja saat buka, bukan lewat handler
  `onClose`, sebab Done memicu `close` dan handler-nya akan membaca `filters`
  yang masih nilai lama dari closure render itu lalu menimpa draft.
  `FilterControls.jsx` **tidak diubah sama sekali** — ia sudah fully controlled
  (nol `useState`), jadi cukup mengganti apa yang di-wire ke sana.
  `filterActive` tetap dihitung dari `filters` yang sudah di-commit, sehingga
  indikator titik di tombol Filters dan gate `reorderable` otomatis benar.

- Audit Design System (audit UI seluruh app terhadap
  `.claude/DESIGN_SYSTEM.md`). Hasil audit: **nol hardcoded color** di seluruh
  `src/` (semua warna lewat 20 token di `index.css`, di-expose ke Tailwind v4
  lewat `@theme inline` — tidak ada `tailwind.config.*`), radius seragam
  `rounded-lg`, dan hanya satu `shadow-lg`. Yang diperbaiki:
  (1) **focus ring** — checkbox seleksi di `TaskRow` pakai `appearance-none`
  (perlu agar `rounded-full` dihormati) yang diam-diam ikut membuang focus
  ring native, jadi checkbox itu tidak terlihat sama sekali oleh pengguna
  keyboard; ring eksplisit sekarang wajib ada di sana. Ring yang sama
  ditambahkan ke checkbox complete (`TaskRow`), checkbox subtask
  (`SubtaskList`), dan 5 grup radio/checkbox di `FilterControls` supaya
  seluruh app punya satu indikator fokus;
  (2) `ThemeToggle` — sebelumnya satu-satunya tombol header yang di-style
  manual (tanpa ring, tanpa touch target 44px); sekarang render lewat
  komponen `Button` variant `secondary` — menutup gap sekaligus menghapus
  duplikasi class;
  (3) `Button` — `active:opacity-80` dan `hover:` tiap variant diberi prefix
  `enabled:` supaya tombol disabled tidak lagi merespons pointer, plus
  `disabled:cursor-not-allowed`;
  (4) `CalendarView` — chip task: `rounded` → `rounded-lg` (satu-satunya bare
  `rounded` di codebase) dan `text-[11px]` → `text-xs` (11px di luar skala
  tipografi Tailwind). Diverifikasi di preview: 42 sel kalender, nol overflow;
  (5) **touch target** — bintang favorit (15×18px) dan tombol expand subtask
  (tinggi 26px) di bawah 44px di mobile; diberi `min-h-11 sm:min-h-0`
  (pola yang sudah dipakai `Button`/`FIELD`, bukan pola baru) sehingga mobile
  44×44 dan desktop tetap ringkas. Ini temuan di luar rencana awal —
  dikerjakan atas konfirmasi eksplisit user.
  Konstanta `FIELD` di `TaskRow` dan `SubtaskList` **sengaja dibiarkan
  terduplikasi**: isinya sudah identik kecuali lebar, dan aturan "jangan
  abstraksi sebelum 3 pemakai nyata" belum terpenuhi.
  Tidak ada token baru, komponen baru, maupun dependency baru.

- Lapisan penyimpanan terisolasi di `src/lib/storage.js` (semua fungsi async).
- Task CRUD: tambah, edit (klik judul), toggle complete, hapus.
- Prioritas + deadline + status precedence (`src/lib/taskStatus.js`).
- Tag many-to-many (input + normalisasi di storage).
- Search + filter multi-dimensi via `getVisibleTasks` (`src/lib/getVisibleTasks.js`).
- Progress bar dari seluruh task + baris "Showing X of Y tasks".
- Token warna + komponen `Button`, dark mode, responsif (satu breakpoint `sm:`).
- Sort By: Manual / Priority / Deadline (`src/lib/sortTasks.js`).
- Reorder manual via `@dnd-kit` (pointer + touch + keyboard, DragOverlay); tombol
  ↑↓ dihapus. Aktif hanya saat Sort = Manual, tak terfilter, tidak sedang
  selection mode, dan baris tidak sedang dalam mode edit (dicegah drag tak
  sengaja saat mengetik). **Update:** slot drag handle sekarang permanen di
  posisi paling kiri baris (`TaskRow.jsx`) di kedua mode (view & edit) — saat
  drag nonaktif, ditampilkan placeholder kosong seukuran handle (bukan
  disembunyikan total seperti sebelumnya) supaya baris tidak geser saat ganti
  Sort By atau masuk mode edit. ini membalik keputusan lama "drag handle
  disembunyikan sepenuhnya saat non-draggable" — sengaja diubah atas
  permintaan eksplisit untuk merapikan baris.
- Tampilan deadline sesuai aturan "Deadline > Tampilan" (`formatDeadline`).
- Validasi/sanitasi bentuk tiap task di `readState()` (`sanitizeTask`): task
  rusak dibuang (tanpa id/title) atau di-coerce (field lain), tidak meng-crash
  app dan tidak menimpa data buruk.
- Trim input tag sebelum cek kosong (tag berisi spasi tidak lagi jadi chip yang
  hilang diam-diam saat disimpan).
- Semantik keyboard/tombol untuk judul yang diklik (a11y): `role="button"`,
  fokusabel, Enter/Space, `aria-label`.
- Konfirmasi hapus inline dua-langkah (Delete → Confirm/Cancel), state lokal
  per-baris di `TaskRow`. **Update:** toggle complete/uncomplete (waktu itu
  masih checkbox; kini tombol Complete/Uncomplete — lihat entri "Perapian
  interaksi UI") dan
  tombol Delete (dengan konfirmasi dua-langkah yang sama) dipindah dari baris
  view mode ke dalam form edit mode — baris normal (tidak sedang diedit)
  tidak lagi punya cara toggle complete atau hapus tanpa klik judul dulu
  untuk masuk edit. `confirmingDelete` di-reset baik saat masuk edit maupun
  saat keluar (Save/Cancel) supaya tidak nyangkut antar sesi edit. Favorite
  star dan tombol expand/collapse subtask **tidak berubah**, tetap
  always-visible di kedua mode. Checkbox seleksi (selection mode) juga tidak
  berubah posisi. Perubahan ini murni untuk merapikan baris yang dirasa
  terlalu banyak UI selalu tampil — atas permintaan eksplisit.
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
  breakdown per prioritas (high/medium/low), breakdown per tag dengan count,
  breakdown per folder (termasuk bucket "No folder"), breakdown subtask
  (total subtask, completed, jumlah task yang punya subtask — agregat, bukan
  per-task), dan breakdown recurring template (jumlah template
  active/paused, instance count per template, plus hitungan orphaned
  instance untuk task yang `templateId`-nya sudah tidak match template
  manapun karena template-nya dihapus). Dihitung dari **seluruh task**
  (bukan filtered) via `getTaskStats(tasks, folders, templates)`
  (`src/lib/getTaskStats.js`). Komponen presentasional `StatsDialog.jsx`
  mengikuti pola `FilterControls`, breakdown folder/recurring mengikuti pola
  chip yang sama seperti breakdown tag. Tombol "Statistics" di header, dialog
  native `<dialog>` dengan pola sama seperti Filters (backdrop-click, Escape,
  Done).
- Favorite/pin task: field `favorite` (boolean) di model task, di-sanitasi di
  `sanitizeTask` dan default `false` di `createTask` (`src/lib/storage.js`),
  pola sama persis dengan `completed`. Toggle lewat tombol bintang di
  `TaskRow.jsx` (dekat checkbox complete), pakai `onUpdate` generic yang sudah
  ada — tidak ada fungsi storage baru. Favorit **selalu mengambang ke atas**
  di ketiga mode Sort By (Manual/Priority/Deadline): `sortTasks.js` mempartisi
  task jadi favorit/non-favorit dulu, lalu mengurutkan tiap partisi dengan
  logika sort yang sama seperti sebelumnya. Ini keputusan sadar: favorit bukan
  opsi Sort By ke-4, tapi pin yang berlaku di semua mode. Filter "Favorites
  only" dan bulk action favorite/unfavorite di `SelectionBar` **sengaja
  tidak dikerjakan** (keputusan final, bukan ditunda) — favorit sudah selalu
  mengambang ke atas jadi filter terpisah dianggap tidak perlu, dan toggle
  favorit dianggap lebih cocok dilakukan satu-per-satu daripada bulk.
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
  Belum ada drag-drop urutan folder — sengaja ditunda (lihat Backlog).
  Breakdown per-folder di Statistik sudah dikerjakan (lihat entri Statistik
  di bawah).
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
- Recurring Task: keputusan "Tidak ada fitur Recurring Task" sebelumnya
  **dibalik atas permintaan eksplisit**, mengikuti
  `.claude/Engineering-Spec-Recurring-Task.md`. Spec itu punya beberapa gap
  terhadap kebutuhan nyata (RecurringTemplate di spec cuma
  `{title, recurrence, active}`, tanpa field tanggal maupun
  priority/tags/folder) — diselesaikan lewat konfirmasi eksplisit ke user
  sebelum implementasi, bukan tebakan:
  (1) instance mewarisi title + priority + tags + folderId dari template
  (bukan title-only seperti literal spec);
  (2) `RecurringTemplate` diberi field `startDate` sendiri sebagai anchor
  instance pertama; instance berikutnya dihitung dari deadline instance yang
  BARU SAJA di-complete + interval (bukan dari `startDate` template setiap
  kali), supaya edit manual deadline sebuah instance tidak bikin drift ke
  instance berikutnya — ini juga menyelesaikan edge case "lama offline" di
  spec §9: generate hanya terjadi saat user melakukan Complete
  (event-driven, bukan cron/time-based), jadi tidak perlu catch-up logic
  untuk periode yang terlewat saat app ditutup;
  (3) entry point-nya dialog terpisah "Recurring" di header (pola identik
  "Manage Folders", `src/App.jsx`), BUKAN toggle di New Task dialog — task
  instance tidak pernah dibuat manual lewat New Task, hanya lewat engine.
  Engine murni tanpa I/O di `src/lib/recurringEngine.js`
  (`computeNextDeadline`, `buildInstanceFromTemplate`) — tidak ada logika
  recurrence di komponen React (spec §10, §13), dan terpisah total dari
  Calendar (Calendar cuma baca `deadline` seperti task biasa, tidak ada
  kode kalender yang diubah). Schema localStorage naik ke versi 4
  (`{ version, tasks, folders, templates }`); migrasi mengikuti pola yang
  sudah ada di `storage.js` — tidak ada fungsi migrasi terpisah, `readState()`
  menerima versi lama sebagai kompatibel lalu `sanitizeTask` default
  `templateId: null` untuk task lama (pola sama seperti `folderId`/
  `subtasks` sebelumnya), plus `sanitizeTemplate` baru (pola sama seperti
  `sanitizeFolder`). Hapus template = unassign (`templateId: null`) di semua
  instance terkait, BUKAN cascade delete — instance lama (completed maupun
  belum) tetap ada, pola sama persis seperti `deleteFolder` (spec §5.6,
  §13 "Jangan reset task lama"). Edge case akhir bulan & tahun kabisat
  (spec §9) ditangani lewat clamp ke hari terakhir bulan tujuan di
  `computeNextDeadline` (mis. 31 Jan + 1 bulan → 28/29 Feb, bukan 3 Mar).
  Instance tampil sebagai task biasa + badge read-only "↻ Recurring" di
  `TaskRow.jsx` (spec §8) — tidak ada UI untuk edit recurrence dari task
  row, recurrence hanya bisa diubah lewat dialog "Recurring". Yang sengaja
  TIDAK dikerjakan sesuai spec §2/§13: Google Calendar Sync, Reminder/
  notifikasi, AI, RRULE kompleks (skip weekday-of-week rules dsb — hanya
  interval sederhana), multi-timezone, filter/bulk-action/statistik khusus
  recurring (konsisten dengan pola Favorite/Folder — ditunda, lihat
  Backlog), dan edit field template selain title/active setelah dibuat
  (priority/tags/folder/frequency/interval terkunci saat create; belum ada
  form edit penuh — sengaja ditunda).

## Backlog (belum dikerjakan — catatan, bukan janji)

- Animasi enter/exit per-baris task (butuh presence-tracking; ditunda).
- Wrapper batch opsional di `storage.js` (`deleteTasks`/`restoreTasks`/
  `updateTasks`, satu tulisan per aksi) kalau list membesar — sekarang loop
  sekuensial sudah cukup.
- Drag-and-drop urutan folder di dialog Manage Folders — ditunda sampai diminta.
- Subtask match ke search/filter — ditunda sampai diminta.
- Drag-reorder subtask di dalam checklist — ditunda sampai diminta.
- Bulk action subtask (mis. "complete all subtasks") di `SelectionBar` —
  ditunda sampai diminta.
- Form edit penuh untuk recurring template (priority/tags/folder/frequency/
  interval setelah dibuat; sekarang hanya title yang rename-able dan
  active/paused yang bisa di-toggle) — ditunda sampai diminta.
- Filter "Recurring only" / bulk action recurring di `SelectionBar` —
  ditunda sampai diminta.
- **Desktop wrapper — SUDAH DIKERJAKAN** (Tauri v2; lihat entri "Desktop Wrapper
  (Tauri v2)" di "Sudah jadi"). Catatan lama di sini memperkirakan fitur ini
  butuh "memindahkan penyimpanan keluar dari localStorage karena proses tray
  perlu baca data saat window ditutup" — **itu terbukti salah**: tray tidak
  butuh database task, cuma `[{title, fireAt}]`, jadi `storage.js` tidak
  disentuh sama sekali. Perkiraan bahwa reminder engine bisa dipakai ulang tanpa
  perubahan **terbukti benar**: `reminder.js` nol perubahan. Sisa yang memang
  masih terbuka: macOS/Linux (butuh mesin lain, perilaku tray/autostart beda).
- **Mobile background notification — jalur Android SUDAH dikerjakan** (lihat
  entri "Local Notification (Capacitor)" di "Sudah jadi"): Capacitor Local
  Notifications, app menitipkan alarm ke OS lalu boleh mati, reschedule
  otomatis lewat satu `useEffect` di `App.jsx`. Yang **tersisa**: (1) build &
  verifikasi Android di device nyata (butuh JDK 17 + Android SDK; belum ada di
  mesin dev) — kode & manifest sudah siap, tinggal `npx cap sync android` lalu
  run; (2) **iOS** (butuh macOS + Xcode; belum disentuh sama sekali); (3) batas
  platform yang tetap berlaku: iOS berplafon 64 notifikasi pending per app, dan
  Android OEM (battery optimization) boleh menunda/membatalkan alarm — panduan
  dontkillmyapp.com sudah ditampilkan. Notifikasi yang benar-benar andal
  (bukan best-effort) tetap butuh **push server**, dan itu menggugurkan
  "local-only" — tetap di luar scope.

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
  templateId  string | null   (uuid RecurringTemplate, atau null = task biasa)
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

RecurringTemplate {
  id          string   (uuid)
  title       string   (wajib, tidak boleh kosong/whitespace)
  priority    "high" | "medium" | "low"   (default "medium")
  tags        string[]        (boleh kosong)
  folderId    string | null   (uuid folder, atau null = tanpa folder)
  recurrence  { frequency: "daily"|"weekly"|"monthly"|"yearly", interval: number (>=1) }
  startDate   string   (ISO 8601, deadline instance pertama)
  active      boolean  (default true; nonaktif = tidak generate instance baru)
  order       number
  createdAt   string   (ISO 8601)
}
```

Data disimpan di localStorage dengan **versi skema**:

```
{ "version": 4, "tasks": [...], "folders": [...], "templates": [...] }
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

## Reminder / pengingat

- **Offset global**, bukan per-task: satu ambang waktu berlaku untuk semua
  task. Konsekuensinya tidak ada field baru di model Task — "due soon"
  diturunkan dari `deadline` yang sudah ada.
- Sebuah task **due soon** jika `now <= deadline <= now + offset`. Task
  completed dan task tanpa deadline tidak pernah due soon.
- **Task overdue TIDAK termasuk due soon** — overdue adalah status waktu
  tersendiri (punya indikator "⚠ Overdue"), tegak lurus dengan due-soon,
  sama seperti Status vs Tanggal di filter.
- Offset bisa diatur user (Off / 1 jam / 1 hari / 3 hari), dipersist sebagai
  preferensi UI (tidak lewat `storage.js`).
- Logika diselesaikan di satu fungsi murni `getDueSoonTasks(tasks, now,
  offsetMs)` (`src/lib/reminder.js`), `now` di-inject. Local-only: tidak ada
  Notification API / push / service worker.

## Dark mode

- Bukan fitur tempelan. Semua warna pakai token/CSS variable sejak awal.
- Jangan pernah hardcode warna di komponen.
- Pilihan tema disimpan di localStorage.

## Responsif

Harus nyaman di HP, tablet, laptop. Desain mobile-first.

---

# Di luar scope

Jangan bangun ini kecuali saya minta eksplisit:
login, sinkronisasi database.

(Kalender dan Recurring Task sudah dikerjakan — lihat "Status implementasi"
di atas — sesuai `.claude/Engineering-Spec-Calendar-View.md` dan
`.claude/Engineering-Spec-Recurring-Task.md`. Pengingat/notifikasi in-app
juga sudah dikerjakan — lihat "Reminder / pengingat in-app" di "Sudah jadi".
Wrapper untuk notifikasi di luar browser juga sudah dikerjakan di kedua sisi:
Android lewat Capacitor, Windows desktop lewat Tauri — lihat entri
"Local Notification (Capacitor)" dan "Desktop Wrapper (Tauri v2)". Yang tersisa
cuma iOS dan macOS/Linux, keduanya terhalang ketersediaan mesin.)

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

# Failure Handling & Recovery Policy

Apabila suatu pekerjaan tidak dapat diselesaikan karena keterbatasan environment, tooling, permission, jaringan, autentikasi, atau keterbatasan Claude Code, jangan berhenti hanya dengan menampilkan error.

Selalu lakukan langkah berikut.

## 1. Identifikasi penyebab

Jelaskan secara spesifik:

- apa yang gagal
- pada langkah mana gagal
- penyebab paling mungkin
- apakah penyebab berasal dari:
  - tooling
  - permission
  - environment
  - dependency
  - konfigurasi
  - bug aplikasi
  - atau faktor eksternal

Jangan hanya menampilkan pesan error mentah.

---

## 2. Tentukan apakah dapat diperbaiki otomatis

Jika dapat diperbaiki sendiri:

- lakukan perbaikan
- ulangi proses

Jangan meminta bantuan user.

---

## 3. Jika membutuhkan tindakan manual

Jika memang membutuhkan tindakan pengguna, tampilkan:

### Manual Action Required

berisi langkah-langkah yang harus dilakukan user secara berurutan.

Contoh:

1. Login ulang GitHub CLI
2. Jalankan `gh auth login`
3. Pilih HTTPS
4. Verifikasi akun
5. Jalankan kembali task

---

## 4. Berikan alasan

Setelah langkah manual, jelaskan:

- mengapa langkah tersebut diperlukan
- mengapa Claude tidak dapat melakukannya sendiri
- keterbatasan apa yang sedang terjadi

---

## 5. Berikan dampak

Jelaskan:

- apakah pekerjaan sudah aman
- apakah data berubah
- apakah perubahan sudah tersimpan
- apakah user bisa melanjutkan tanpa kehilangan pekerjaan

---

## 6. Berikan langkah selanjutnya

Selalu akhiri dengan:

Next Action

berisi satu tindakan yang paling direkomendasikan setelah user selesai melakukan langkah manual.

---

## 7. Format jawaban

Gunakan format berikut.

❌ Problem

...

🔍 Cause

...

✅ Automatic Recovery

...

👤 Manual Action Required

1.
2.
3.

💡 Why

...

➡ Next Action

...

## Error Classification

Kelompokkan setiap kegagalan ke salah satu kategori berikut.

- Tool Limitation
- Environment Limitation
- Permission Issue
- Authentication Issue
- Dependency Issue
- Configuration Issue
- Build Error
- Runtime Error
- Test Failure
- Lint Failure
- Browser Automation Failure
- Unknown

Gunakan kategori tersebut saat menjelaskan penyebab.

Claude tidak boleh mengakhiri pekerjaan hanya dengan menampilkan error.

Sebelum mengakhiri respons, Claude WAJIB memberikan:

- diagnosis
- penyebab
- solusi otomatis yang sudah dicoba
- solusi manual jika diperlukan
- alasan mengapa solusi manual diperlukan
- langkah berikutnya

Apabila tidak ada solusi yang diketahui, jelaskan secara eksplisit mengapa tidak ada solusi yang dapat diberikan.