// Everything a researcher may want to tweak about the experiment lives here:
// limits, the five dataset versions, the answer key, and the texts shown to
// participants. Source: "UPDATED GUIDELINE UNTUK TIM" + "XAI Leader Prototype v1.1".

export const EXPERIMENT_TITLE = "Simulasi Pengambilan Keputusan — Performance Marketing";
export const LEADER_NAME = "XAI Leader";
export const LEADER_ROLE = "Acting General Manager";
export const MODULE_VERSION = "v1.1";

/** Aturan Diskusi #2: tim boleh bertanya maksimal 5 pertanyaan kepada pemimpin. */
export const MAX_QUESTIONS = 5;

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
// Texts shown to participants (Tahap 2 briefing)
// ---------------------------------------------------------------------------

export const CONTEXT_LINES = [
  "Anda adalah tim Performance Marketing di perusahaan retail fashion harga terjangkau.",
  "Perusahaan menjalankan 5 campaign SEM secara paralel.",
  "Budget terbatas dan hanya cukup untuk scale up 1 campaign saja.",
];

export const OBJECTIVE = "Mendapatkan conversion sebanyak mungkin dengan biaya serendah mungkin.";

export const CARD_RULES = [
  "Setiap anggota tim menerima 1 kartu informasi secara acak, berisi penjelasan tentang salah satu metrik performance marketing.",
  "Anda hanya boleh melihat kartu Anda sendiri.",
  "Anda tidak boleh menunjukkan kartu secara fisik ke anggota lain.",
  "Anda harus menjelaskan isi kartu Anda dengan kata-kata sendiri kepada tim.",
];

export const CARD_PURPOSE =
  "Tujuan: mensimulasikan kondisi kerja di mana informasi terdistribusi dan perlu dikomunikasikan secara efektif dalam tim.";

export const DISCUSSION_RULES = [
  "Setiap anggota wajib menjelaskan isi kartunya ke tim.",
  `Tim boleh bertanya maksimal ${MAX_QUESTIONS} pertanyaan kepada pemimpin (XAI Leader).`,
  "Pemimpin hanya memberi insight, bukan keputusan final.",
  "Tim harus memilih 1 campaign untuk di-scale.",
  "Keputusan harus berbasis data dan selaras dengan objective.",
];

export const LEADER_DOS = [
  "Menjelaskan istilah, rumus, dan konsep performance marketing (Education Mode).",
  "Mengevaluasi reasoning/keputusan yang tim ajukan: objective, metrik yang relevan, trade-off, dan risiko (Strategic Mode).",
  "Mengklarifikasi tugas, aturan, dan objective perusahaan.",
];

export const LEADER_DONTS = [
  "Tidak memberi tahu campaign mana yang terbaik atau harus dipilih.",
  "Tidak membenarkan/menyalahkan pilihan tim dan tidak membuat ranking campaign.",
  "Tidak menghitung, menyusun analisis, atau menulis proposal untuk tim.",
  "Tidak memberi langkah, tips, atau contoh jawaban.",
];

export const PARTICIPANT_RULES = [
  `Setiap pesan yang dikirim ke XAI Leader dihitung sebagai 1 pertanyaan (maksimal ${MAX_QUESTIONS} per tim).`,
  "Diskusikan dulu di dalam tim sebelum bertanya — kualitas pertanyaan ikut dinilai.",
  "Meminta jawaban langsung atau mencoba mengubah peran XAI Leader akan ditolak dan dicatat.",
  "Seluruh percakapan direkam untuk keperluan penelitian.",
];

export const EVALUATION_FOCUS = [
  "Kualitas komunikasi antar anggota",
  "Kemampuan mengintegrasikan informasi berbeda",
  "Kualitas pertanyaan ke pemimpin",
  "Argumentasi berbasis data",
  "Strategi pemilihan campaign",
];

export const MISSION_QUESTION =
  "Campaign mana yang akan tim Anda pilih untuk di-scale up dengan budget yang tersedia — dan mengapa?";

/** Tahap 3 — what the PDF must contain (one page per section). */
export const SUBMISSION_SECTIONS = [
  { title: "Campaign yang dipilih", hint: "Sebutkan 1 campaign yang tim pilih untuk di-scale." },
  {
    title: "Rasionalisasi berbasis data",
    hint: "Mengapa campaign itu? Kutip metrik dan angka dari tabel yang mendukung keputusan.",
  },
  { title: "Risiko dari keputusan", hint: "Risiko apa yang muncul jika campaign ini di-scale?" },
  {
    title: "Mengapa campaign lain tidak dipilih",
    hint: "Jelaskan pertimbangan tim terhadap campaign lainnya.",
  },
  {
    title: "Kecukupan informasi & penutup",
    hint: "Apakah informasi dari tim dan XAI Leader sudah cukup? Tambahkan informasi lain atau penutup.",
  },
];

/** Static opening message (identical for every group → controlled condition). */
export function welcomeBubbles(picName: string, groupCode: string): string[] {
  return [
    `Selamat datang, ${picName} — Kelompok ${groupCode}. Sesi eksperimen Anda telah dimulai.`,
    `Saya adalah ${LEADER_NAME}, ${LEADER_ROLE} tim performance marketing di perusahaan ini. Dalam sesi ini, saya akan mengevaluasi proposal dan keputusan yang Anda ajukan berdasarkan data dan standar penilaian yang objektif.`,
    "Situasinya ada di panel Misi: 5 campaign SEM berjalan paralel, dan budget hanya cukup untuk scale up 1 campaign. Objective kita: conversion sebanyak mungkin dengan biaya serendah mungkin.",
    `Tim Anda punya maksimal ${MAX_QUESTIONS} pertanyaan untuk saya. Saya memberi insight dan menjelaskan reasoning, bukan keputusan final. Bila ada istilah atau konsep yang ingin dipahami, silakan tanya secara langsung.`,
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
