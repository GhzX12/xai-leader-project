// Everything a researcher may want to tweak about the experiment lives here:
// limits, the five dataset versions, the answer key, and the texts shown to
// participants. Source: "UPDATED GUIDELINE UNTUK TIM" + "XAI Leader Prototype v1.1".

export const EXPERIMENT_TITLE = "Simulasi Pengambilan Keputusan — Performance Marketing";
export const LEADER_NAME = "XAI Leader";
export const LEADER_ROLE = "Acting General Manager";
export const MODULE_VERSION = "v1.1";

/** Teams may ask XAI Leader as many questions as they like. */
export const MAX_QUESTIONS_DB_GUARD = 1_000_000;

/** Each team has exactly one session row; its group code is "<Team>-1". */
export const SESSION_SUFFIX = "-1";
export const teamCode = (teamName: string) => `${teamName}${SESSION_SUFFIX}`;
export const teamLabel = (code: string) => (code.endsWith(SESSION_SUFFIX) ? code.slice(0, -SESSION_SUFFIX.length) : code);

/** Minimum pages of the proposal PDF (one page per required section). */
export const MIN_PDF_PAGES = 5;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/**
 * The in-chat evaluation rubric (section 6 of the prototype) can show a numeric
 * score. Off by default: a per-campaign score lets a team probe for the answer
 * ("D dapat 55, E dapat 90"), which breaks the "no direct answer" rule.
 */
export const SHOW_SCORE_IN_CHAT = false;

/** Minimum "thinking" buffer before the first bubble appears (ms). */
export const TYPING_BUFFER_MS = { min: 2500, max: 5000 };

export type CampaignId = "A" | "B" | "C" | "D" | "E";

export type CampaignRow = {
  campaign: CampaignId;
  clicks: number;
  impressions: number;
  ctr: number; // %
  conversions: number;
  cpa: number; // $
  convRate: number; // %
};

// ---------------------------------------------------------------------------
// Session start label — "DD/MM/YY: HH.MM", typed (or confirmed) at login
// ---------------------------------------------------------------------------

const SESSION_LABEL_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}):?\s*(\d{1,2})[.:](\d{2})$/;

/** Normalises user input to "DD/MM/YY: HH.MM" and derives the batch ("DD/MM/YY · HH.00"). Null if invalid. */
export function parseSessionLabel(input: string): { label: string; batch: string } | null {
  const m = SESSION_LABEL_RE.exec(input.trim());
  if (!m) return null;
  const [dd, mm, yy, hh, min] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || hh > 23 || min > 59) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return { label: `${p(dd)}/${p(mm)}/${p(yy)}: ${p(hh)}.${p(min)}`, batch: `${p(dd)}/${p(mm)}/${p(yy)} · ${p(hh)}.00` };
}

// ---------------------------------------------------------------------------
// Texts shown to participants (Tahap 2 briefing)
// ---------------------------------------------------------------------------

export const CONTEXT_LINES = [
  "Bayangkan kalian adalah tim Performance Marketing di sebuah brand fashion retail dengan harga yang ramah di kantong.",
  "Saat ini ada 5 campaign SEM yang berjalan bersamaan.",
  "Sayangnya budget terbatas: cukup untuk scale up satu campaign saja.",
];

export const OBJECTIVE = "Dapatkan conversion sebanyak mungkin dengan biaya serendah mungkin.";

export const CARD_RULES = [
  "Tiap anggota mendapat 1 kartu informasi secara acak. Isinya penjelasan tentang satu metrik performance marketing.",
  "Kartu itu hanya boleh dilihat oleh pemegangnya sendiri.",
  "Jangan tunjukkan kartu secara fisik ke teman satu tim.",
  "Jelaskan isinya dengan kata-kata sendiri ke anggota tim yang lain.",
];

export const CARD_PURPOSE =
  "Kenapa dibuat begini? Supaya terasa seperti kerja tim sungguhan, di mana informasi tersebar di banyak orang dan harus dikomunikasikan dengan jelas.";

export const DISCUSSION_RULES = [
  "Setiap anggota menjelaskan isi kartunya ke tim.",
  "Tim bebas bertanya ke XAI Leader. Tapi diskusikan dulu di antara kalian, karena kualitas pertanyaan ikut dinilai.",
  "XAI Leader memberi insight, bukan keputusan akhir.",
  "Tim memilih 1 campaign untuk di-scale up.",
  "Keputusan harus berdasarkan data dan sejalan dengan objective.",
];

export const LEADER_DOS = [
  "Menjelaskan istilah, rumus, dan konsep performance marketing (Education Mode).",
  "Menanggapi alur pikir dan keputusan yang kalian ajukan: objective, metrik yang relevan, trade-off, dan risikonya (Strategic Mode).",
  "Menjelaskan ulang tugas, aturan, dan objective perusahaan.",
];

export const LEADER_DONTS = [
  "Menyebut campaign mana yang terbaik atau harus dipilih.",
  "Membenarkan atau menyalahkan pilihan kalian, atau membuat ranking campaign.",
  "Menghitung, menganalisis, atau menulis proposal atas nama tim.",
  "Memberi langkah, tips, atau contoh jawaban.",
];

export const PARTICIPANT_RULES = [
  "Setiap pesan ke XAI Leader dihitung sebagai satu pertanyaan, dan jumlahnya tidak dibatasi.",
  "Biar efektif, diskusikan dulu bersama tim sebelum bertanya.",
  "Kalau kalian meminta jawaban langsung atau mencoba mengubah peran XAI Leader, permintaannya akan ditolak dan dicatat.",
  "Seluruh percakapan direkam untuk keperluan penelitian.",
];

export const EVALUATION_FOCUS = [
  "Kualitas komunikasi antar anggota",
  "Kemampuan menggabungkan informasi yang berbeda-beda",
  "Kualitas pertanyaan ke pemimpin",
  "Argumentasi yang berbasis data",
  "Strategi memilih campaign",
];

export const MISSION_QUESTION =
  "Campaign mana yang akan kalian pilih untuk di-scale up dengan budget yang ada, dan kenapa?";

/** Tahap 3 — what the PDF must contain (one page per section). */
export const SUBMISSION_SECTIONS = [
  { title: "Campaign yang dipilih", hint: "Sebutkan 1 campaign yang kalian pilih untuk di-scale up." },
  {
    title: "Alasan berbasis data",
    hint: "Kenapa campaign itu? Kutip metrik dan angka dari tabel yang mendukung keputusan kalian.",
  },
  { title: "Risiko dari keputusan", hint: "Risiko apa yang mungkin muncul kalau campaign ini di-scale up?" },
  {
    title: "Kenapa campaign lain tidak dipilih",
    hint: "Ceritakan pertimbangan kalian terhadap campaign yang lain.",
  },
  {
    title: "Kecukupan informasi & penutup",
    hint: "Apakah informasi dari tim dan XAI Leader sudah cukup? Boleh tambahkan catatan lain sebagai penutup.",
  },
];

/** Static opening message (identical for every group → controlled condition). */
export function welcomeBubbles(picName: string, teamName: string): string[] {
  return [
    `Halo ${picName}, selamat datang di sesi ${teamName}. Senang bisa bekerja bareng kalian hari ini.`,
    `Saya ${LEADER_NAME}, ${LEADER_ROLE} di tim performance marketing ini. Peran saya mendampingi kalian berpikir: menjelaskan konsep dan mengulas alur pikir kalian berdasarkan data.`,
    "Situasinya ada di panel Misi: 5 campaign SEM berjalan bersamaan, tapi budget hanya cukup untuk scale up 1 campaign. Targetnya, conversion sebanyak mungkin dengan biaya serendah mungkin.",
    "Silakan tanya apa saja yang membantu kalian berpikir. Jumlah pertanyaannya tidak dibatasi. Satu catatan dari saya: jawabannya tidak akan saya tentukan, karena keputusan akhir ada di tangan kalian.",
  ];
}

/** Display formats follow the guideline table: CTR 1 decimal, CPA $x.xx, Conv. Rate 2 decimals. */
export const fmt = {
  int: (n: number) => n.toLocaleString("en-US"),
  ctr: (n: number) => `${n.toFixed(1)}%`,
  cpa: (n: number) => `$${n.toFixed(2)}`,
  convRate: (n: number) => `${n.toFixed(2)}%`,
};

export function datasetAsText(rows: CampaignRow[]): string {
  const header = "Campaign | Click | Impression | CTR (%) | Conversion | CPA ($) | Conv. Rate (%)";
  const lines = rows.map(
    (r) =>
      `${r.campaign} | ${fmt.int(r.clicks)} | ${fmt.int(r.impressions)} | ${fmt.ctr(r.ctr)} | ${r.conversions} | ${fmt.cpa(r.cpa)} | ${fmt.convRate(r.convRate)}`,
  );
  return [header, ...lines].join("\n");
}
