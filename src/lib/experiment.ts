// Everything a researcher may want to tweak about the experiment lives here:
// limits, the five dataset versions, the answer key, and the texts shown to
// participants. Source: "UPDATED GUIDELINE UNTUK TIM".

export const EXPERIMENT_TITLE = "Simulasi Pengambilan Keputusan — Performance Marketing";
export const LEADER_NAME = "Campaign Leader";
export const LEADER_ROLE = "Acting General Manager";
export const MODULE_VERSION = "v1.1";

/** Teams may ask Campaign Leader as many questions as they like. */
export const MAX_QUESTIONS_DB_GUARD = 1_000_000;

/** Each team has exactly one session; its group code is simply the team name, e.g. "Alpha-1". */
export const teamCode = (teamName: string) => teamName;
export const teamLabel = (code: string) => code;

/** Google Docs answer template (view only): teams make a copy, fill it in and download it as PDF. */
export const TEMPLATE_URL = "https://docs.google.com/document/d/1hiO_Ub0hhFPUAFpBzmvKc-IWitcGEhH7Dqqs7L7WY5s/edit?usp=sharing";

/** Minimum pages of the proposal PDF (one page per required section). */
export const MIN_PDF_PAGES = 5;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/**
 * The in-chat evaluation rubric (section 6 of the prototype) can show a numeric
 * score. Off by default: a per-campaign score lets a team probe for the answer
 * ("D dapat 55, E dapat 90"), which breaks the "no direct answer" rule.
 */
export const SHOW_SCORE_IN_CHAT = false;

/**
 * Human-like pacing. A reply is not "seen" instantly: wait this long (with a little jitter) before the typing
 * indicator even appears, then type for a time that grows with the length of each bubble.
 */
export const REPLY_DELAY_MS = { min: 5000, max: 6500 };
export const typingMs = (text: string) => Math.min(12000, Math.max(3000, 1800 + text.length * 45));

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
  "Tim bebas bertanya ke Campaign Leader. Tapi diskusikan dulu di antara kalian, karena kualitas pertanyaan ikut dinilai.",
  "Campaign Leader memberi insight, bukan keputusan akhir.",
  "Tim memilih 1 campaign untuk di-scale up.",
  "Keputusan harus berdasarkan data dan sejalan dengan objective.",
];

export const LEADER_DOS = [
  "Menjelaskan istilah, rumus, dan konsep performance marketing.",
  "Menanggapi alur pikir dan keputusan yang kalian ajukan: objective, metrik yang relevan, trade-off, dan risikonya.",
  "Menjelaskan ulang tugas, aturan, dan objective perusahaan.",
];

export const LEADER_DONTS = [
  "Menyebut campaign mana yang terbaik atau harus dipilih.",
  "Membenarkan atau menyalahkan pilihan kalian, atau membuat ranking campaign.",
  "Menghitung, menganalisis, atau menulis proposal atas nama tim.",
  "Memberi langkah, tips, atau contoh jawaban.",
];

export const PARTICIPANT_RULES = [
  "Setiap pesan ke Campaign Leader dihitung sebagai satu pertanyaan, dan jumlahnya tidak dibatasi.",
  "Biar efektif, diskusikan dulu bersama tim sebelum bertanya.",
  "Kalau kalian meminta jawaban langsung atau mencoba mengubah peran Campaign Leader, permintaannya akan ditolak dan dicatat.",
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
    title: "Kesan tentang Leader",
    hint: "Ceritakan kesan kalian tentang Campaign Leader: bagaimana persona dan caranya membantu, apakah terbantu atau tidak, serta kesan dan pesan kalian.",
  },
];

/**
 * Opening message. The first bubble is the same for everyone; the rest is one of 12 wordings, picked from the
 * team name so a team always sees the same text (on any device) while neighbouring teams differ.
 */
const WELCOME_VARIANTS: string[][] = [
  ["Senang bisa mulai bareng kalian. Di panel Misi ada situasi dan data campaign yang perlu kalian baca dulu.", "Kalau ada yang ingin ditanyakan atau dibahas, tulis saja di sini kapan pun kalian siap."],
  ["Semoga sesi ini berjalan lancar buat kalian. Pelan-pelan saja, mulai dari membaca misi dan tabel data di sebelah kiri.", "Begitu sudah ada gambaran, ceritakan pemikiran kalian ke saya atau tanyakan hal yang masih membingungkan."],
  ["Saya Campaign Leader, GM sementara di tim ini. Hari ini saya menemani kalian memutuskan satu campaign yang akan di-scale up.", "Silakan diskusi dulu bersama tim, lalu tanyakan apa saja yang bisa membantu kalian berpikir."],
  ["Terima kasih sudah bergabung. Tugas kalian hari ini: memilih satu campaign untuk di-scale up dengan budget yang terbatas.", "Datanya ada di panel Misi. Kalau ada yang mau didiskusikan, saya ada di sini."],
  ["Selamat bergabung di sesi ini. Sebelum ngobrol dengan saya, boleh banget kalian baca misi dan datanya dulu bersama-sama.", "Tidak perlu terburu-buru, tanya saja kapan kalian merasa siap."],
  ["Saya Campaign Leader, dan saya akan menemani kalian sepanjang sesi ini.", "Mulai dari panel Misi ya. Kalau ada istilah atau pertimbangan yang ingin dibahas, kirim saja pesannya di sini."],
  ["Senang kalian sudah masuk. Hari ini kalian punya satu keputusan besar: campaign mana yang layak diperbesar dengan budget yang ada.", "Pilihannya tetap di tangan kalian, tapi saya siap membantu kalian menimbang. Tanya apa saja ya."],
  ["Semoga kalian nyaman. Biasanya tim yang berdiskusi dulu sebelum bertanya akan lebih terarah, jadi silakan baca misi dan datanya bareng-bareng."],
  ["Selamat datang dan selamat bekerja. Situasi lengkapnya ada di panel Misi, termasuk data kelima campaign.", "Kalau sudah dibaca, kita bisa lanjut ngobrol. Soal konsep maupun cara berpikir, silakan tanya."],
  ["Saya senang kalian sudah siap. Kita mulai dengan memahami situasi di panel Misi dulu ya.", "Setelah itu, bagikan pemikiran kalian ke saya atau tanyakan hal yang masih kurang jelas."],
  ["Sesi ini santai tapi serius ya. Baca misi dan data campaign dengan teliti sebelum kalian mengambil keputusan.", "Saya menemani dari sini. Tulis saja kalau ada yang ingin dibahas."],
  ["Mari kita mulai. Misi dan data campaign sudah tersedia di panel sebelah kiri.", "Silakan luangkan waktu untuk membacanya. Kalau sudah siap, kirim pertanyaan atau pemikiran kalian di sini."],
];

const TEAM_CLASSES = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliett"];

export function welcomeVariant(teamName: string): number {
  const m = /^([A-Za-z]+)-(\d+)$/.exec(teamName);
  const c = m ? TEAM_CLASSES.indexOf(m[1].toLowerCase()) : -1;
  if (m && c >= 0) return (c * 8 + Number(m[2]) - 1) % WELCOME_VARIANTS.length;
  let h = 0;
  for (const ch of teamName) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % WELCOME_VARIANTS.length;
}

export function welcomeBubbles(picName: string, teamName: string): string[] {
  return [`${picName} dan tim ${teamName}, selamat datang di Sesi Simulasi.`, ...WELCOME_VARIANTS[welcomeVariant(teamName)]];
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
