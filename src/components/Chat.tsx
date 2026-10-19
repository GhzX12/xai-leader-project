"use client";

import { useEffect, useRef, useState } from "react";
import { api, sleep } from "@/lib/client-api";
import { LEADER_NAME, LEADER_ROLE, TYPING_BUFFER_MS, welcomeBubbles } from "@/lib/experiment";
import type { AppState, ChatMessage } from "@/lib/types";

type Group = {
  key: string;
  role: "user" | "assistant";
  bubbles: string[];
  questionNo: number | null;
  pending?: boolean;
};

const MAX_CHARS = 1500;

const toGroup = (m: ChatMessage): Group => ({
  key: `m${m.id}`,
  role: m.role,
  bubbles: m.bubbles,
  questionNo: m.questionNo,
});

/** Time a bubble "takes to type", so long answers arrive as a natural sequence of messages. */
const bubbleDelay = (text: string) => Math.min(2600, Math.max(800, 500 + text.length * 15));
const randomBuffer = () => TYPING_BUFFER_MS.min + Math.random() * (TYPING_BUFFER_MS.max - TYPING_BUFFER_MS.min);

function welcomeSeenKey(code: string) {
  return `xai-welcome-${code}`;
}
function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* storage unavailable — the welcome simply animates again next time */
  }
}

export default function Chat({
  state,
  onState,
  onSubmit,
}: {
  state: AppState;
  onState: (s: AppState) => void;
  onSubmit: () => void;
}) {
  const welcome = welcomeBubbles(state.picName, state.groupCode);
  const animateWelcome = state.messages.length === 0;

  const [welcomeShown, setWelcomeShown] = useState<string[]>(animateWelcome ? [] : welcome);
  const [groups, setGroups] = useState<Group[]>(() => state.messages.map(toGroup));
  const [questionsUsed, setQuestionsUsed] = useState(state.questionsUsed);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>(state.messages);

  const remaining = state.maxQuestions - questionsUsed;
  const exhausted = remaining <= 0;

  // Opening message: typed out once per group, shown instantly afterwards.
  useEffect(() => {
    if (!animateWelcome) return;
    const key = welcomeSeenKey(state.groupCode);
    if (readFlag(key)) {
      setWelcomeShown(welcome);
      return;
    }
    let cancelled = false;
    void (async () => {
      setBusy(true);
      for (let i = 0; i < welcome.length; i++) {
        setTyping(true);
        await sleep(i === 0 ? 1200 : bubbleDelay(welcome[i]));
        if (cancelled) return;
        setWelcomeShown((w) => [...w, welcome[i]]);
      }
      setTyping(false);
      setBusy(false);
      writeFlag(key);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [groups, welcomeShown, typing]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy || exhausted) return;
    setError(null);
    setBusy(true);
    setInput("");
    const pendingKey = `p${Date.now()}`;
    setGroups((g) => [...g, { key: pendingKey, role: "user", bubbles: [text], questionNo: questionsUsed + 1, pending: true }]);
    setTyping(true);

    const minWait = sleep(randomBuffer());
    const res = await api<{ messages: ChatMessage[]; questionsUsed: number }>("/api/chat", { json: { message: text } });
    await minWait;

    if (!res.ok) {
      setTyping(false);
      setGroups((g) => g.filter((x) => x.key !== pendingKey));
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      if (typeof res.data?.questionsUsed === "number") setQuestionsUsed(res.data.questionsUsed);
      if (res.status !== 429) setInput(text);
      setError(res.error);
      setBusy(false);
      return;
    }

    const [userMsg, leaderMsg] = res.data.messages;
    setQuestionsUsed(res.data.questionsUsed);
    setGroups((g) => g.map((x) => (x.key === pendingKey ? toGroup(userMsg) : x)));

    // Reveal the answer bubble by bubble, with a typing indicator in between.
    const leaderKey = `m${leaderMsg.id}`;
    for (let i = 0; i < leaderMsg.bubbles.length; i++) {
      if (i > 0) {
        setTyping(true);
        await sleep(bubbleDelay(leaderMsg.bubbles[i]));
      }
      setTyping(false);
      const shown = leaderMsg.bubbles.slice(0, i + 1);
      setGroups((g) =>
        g.some((x) => x.key === leaderKey)
          ? g.map((x) => (x.key === leaderKey ? { ...x, bubbles: shown } : x))
          : [...g, { ...toGroup(leaderMsg), bubbles: shown }],
      );
    }
    setTyping(false);
    setBusy(false);

    messagesRef.current = [...messagesRef.current, ...res.data.messages];
    onState({ ...state, messages: messagesRef.current, questionsUsed: res.data.questionsUsed });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <section className="card chat" aria-label={`Chat dengan ${LEADER_NAME}`}>
      <div className="chat-head">
        <div className="avatar">XL</div>
        <div>
          <div className="title">{LEADER_NAME}</div>
          <div className="sub">
            <span className="dot-online" /> {LEADER_ROLE}
          </div>
        </div>
        <div className="quota" aria-live="polite">
          Sisa pertanyaan: <b>{Math.max(remaining, 0)}</b> / {state.maxQuestions}
          <div className="pips">
            {Array.from({ length: state.maxQuestions }, (_, i) => (
              <span key={i} className={`pip ${i < questionsUsed ? "used" : ""}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {welcomeShown.length > 0 && (
          <div className="msg-group leader">
            <div className="avatar">XL</div>
            <div className="msg-stack">
              {welcomeShown.map((b, i) => (
                <div key={i} className="bubble">
                  {b}
                </div>
              ))}
            </div>
          </div>
        )}

        {groups.map((g) =>
          g.role === "user" ? (
            <div key={g.key} className="msg-group user">
              <div className="msg-stack">
                <div className="msg-meta">
                  Tim · Pertanyaan {g.questionNo}/{state.maxQuestions}
                  {g.pending ? " · mengirim…" : ""}
                </div>
                {g.bubbles.map((b, i) => (
                  <div key={i} className={`bubble ${g.pending ? "pending" : ""}`}>
                    {b}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div key={g.key} className="msg-group leader">
              <div className="avatar">XL</div>
              <div className="msg-stack">
                {g.bubbles.map((b, i) => (
                  <div key={i} className="bubble">
                    {b}
                  </div>
                ))}
              </div>
            </div>
          ),
        )}

        {typing && (
          <div className="msg-group leader">
            <div className="avatar">XL</div>
            <div className="bubble typing" aria-label={`${LEADER_NAME} sedang mengetik`}>
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      <div className="chat-foot">
        {error && <div className="alert error">{error}</div>}
        {exhausted ? (
          <div className="alert warn">
            Kuota {state.maxQuestions} pertanyaan sudah habis. Lanjutkan diskusi tim, lalu kumpulkan proposal.
          </div>
        ) : (
          <>
            <div className="composer">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={onKeyDown}
                placeholder={busy ? `${LEADER_NAME} sedang menjawab…` : "Tulis pertanyaan tim untuk XAI Leader…"}
                disabled={busy}
                rows={2}
              />
              <button className="btn" onClick={() => void send()} disabled={busy || !input.trim()}>
                Kirim
              </button>
            </div>
            <div className="composer-hint">
              <span>Enter untuk kirim · Shift+Enter baris baru · setiap pesan = 1 pertanyaan</span>
              <span>
                {input.length}/{MAX_CHARS}
              </span>
            </div>
          </>
        )}
        <div className="submit-cta">
          <span className="small muted">Sudah selesai berdiskusi dan menyusun PDF?</span>
          <button className="btn accent" onClick={onSubmit} disabled={busy}>
            Kumpulkan Proposal →
          </button>
        </div>
      </div>
    </section>
  );
}
