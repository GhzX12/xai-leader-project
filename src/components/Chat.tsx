"use client";

import { useEffect, useRef, useState } from "react";
import { api, sleep } from "@/lib/client-api";
import { LEADER_NAME, LEADER_ROLE, REPLY_DELAY_MS, typingMs, welcomeBubbles } from "@/lib/experiment";
import type { AppState, ChatMessage } from "@/lib/types";

type Group = {
  key: string;
  role: "user" | "assistant";
  bubbles: string[];
  pending?: boolean;
};

const MAX_CHARS = 1500;

const toGroup = (m: ChatMessage): Group => ({ key: `m${m.id}`, role: m.role, bubbles: m.bubbles });

const replyDelay = () => REPLY_DELAY_MS.min + Math.random() * (REPLY_DELAY_MS.max - REPLY_DELAY_MS.min);

function welcomeSeenKey(code: string) {
  return `cl-welcome-${code}`;
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
  const welcome = welcomeBubbles(state.picName, state.groupName);
  const animateWelcome = state.messages.length === 0;

  const [welcomeShown, setWelcomeShown] = useState<string[]>(animateWelcome ? [] : welcome);
  const [groups, setGroups] = useState<Group[]>(() => state.messages.map(toGroup));
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>(state.messages);

  // Opening message: arrives after a short pause, once per team; shown instantly afterwards.
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
      await sleep(REPLY_DELAY_MS.min);
      for (let i = 0; i < welcome.length; i++) {
        if (cancelled) return;
        setTyping(true);
        await sleep(typingMs(welcome[i]));
        if (cancelled) return;
        setTyping(false);
        setWelcomeShown((w) => [...w, welcome[i]]);
      }
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
    if (!text || busy) return;
    setError(null);
    setBusy(true);
    setInput("");
    const pendingKey = `p${Date.now()}`;
    setGroups((g) => [...g, { key: pendingKey, role: "user", bubbles: [text], pending: true }]);

    // The other side does not react at once: nothing happens for a few seconds, then they start typing.
    const pause = sleep(replyDelay());
    const res = await api<{ messages: ChatMessage[]; questionsUsed: number }>("/api/chat", { json: { message: text } });
    await pause;

    if (!res.ok) {
      setGroups((g) => g.filter((x) => x.key !== pendingKey));
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      setInput(text);
      setError(res.error);
      setBusy(false);
      return;
    }

    const [userMsg, leaderMsg] = res.data.messages;
    setGroups((g) => g.map((x) => (x.key === pendingKey ? toGroup(userMsg) : x)));

    // Reveal the answer bubble by bubble; every bubble is "typed" for a while first.
    const leaderKey = `m${leaderMsg.id}`;
    for (let i = 0; i < leaderMsg.bubbles.length; i++) {
      setTyping(true);
      await sleep(typingMs(leaderMsg.bubbles[i]));
      setTyping(false);
      const shown = leaderMsg.bubbles.slice(0, i + 1);
      setGroups((g) =>
        g.some((x) => x.key === leaderKey)
          ? g.map((x) => (x.key === leaderKey ? { ...x, bubbles: shown } : x))
          : [...g, { ...toGroup(leaderMsg), bubbles: shown }],
      );
    }
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
        <div className="avatar" role="img" aria-label={LEADER_NAME} />
        <div>
          <div className="title">{LEADER_NAME.toUpperCase()}</div>
          <div className="sub">
            <span className="dot-online" /> {LEADER_ROLE} · online
          </div>
        </div>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {welcomeShown.length > 0 && (
          <div className="msg-group leader">
            <div className="avatar" />
            <div className="msg-stack">
              {welcomeShown.map((b, i) => (
                <div key={i} className="bubble">
                  {b}
                </div>
              ))}
            </div>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.key} className={`msg-group ${g.role === "user" ? "user" : "leader"}`}>
            {g.role !== "user" && <div className="avatar" />}
            <div className="msg-stack">
              {g.bubbles.map((b, i) => (
                <div key={i} className={`bubble ${g.pending ? "pending" : ""}`}>
                  {b}
                </div>
              ))}
            </div>
          </div>
        ))}

        {typing && (
          <div className="msg-group leader">
            <div className="avatar" />
            <div className="msg-stack">
              <div className="bubble typing" aria-label={`${LEADER_NAME} sedang mengetik`}>
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="chat-foot">
        {error && <div className="alert error">{error}</div>}
        <div className="composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={onKeyDown}
            placeholder="Tulis pesan di sini…"
            disabled={busy}
            rows={2}
          />
          <button className="btn" onClick={() => void send()} disabled={busy || !input.trim()}>
            Kirim
          </button>
        </div>
        <div className="composer-hint">
          <span>Enter untuk kirim · Shift+Enter baris baru</span>
          <span>
            {input.length}/{MAX_CHARS}
          </span>
        </div>
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
