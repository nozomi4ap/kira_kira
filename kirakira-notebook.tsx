import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, Paintbrush, BookOpen, Heart, Plane, Image as ImageIcon,
  Plus, X, Trash2, Check, Camera, Star, Sparkles, ChevronLeft, Eraser,
  PenLine, Brush, Palette, Undo2
} from "lucide-react";

const STORAGE_KEY = "kirakira-notebook-data";

const PLUSHIE_EMOJI = ["🧸", "🐰", "🐻", "🐱", "🐶", "🦄", "🐼", "🐨", "🦊", "🐥", "🐷", "🦁"];
const PLUSHIE_COLORS = [
  { name: "pink", bg: "#FFE1EC", text: "#B4436C" },
  { name: "peach", bg: "#FFE9DC", text: "#C06B3E" },
  { name: "lavender", bg: "#EDE3FF", text: "#7B5CB8" },
  { name: "mint", bg: "#DFF5E8", text: "#3E9A6B" },
  { name: "sky", bg: "#DFF0FF", text: "#3E7EC0" },
  { name: "lemon", bg: "#FFF6D6", text: "#B89A2E" },
];
const MOODS = ["😊", "🥰", "😢", "😡", "😴", "😲", "😆", "🥳"];
const DRAW_COLORS = [
  "#2D2A32", "#6B6B6B", "#FFFFFF",
  "#FF3D71", "#FF6FA5", "#FF9ECD", "#FF8CC6",
  "#FF8A3D", "#FFC46B", "#FFE066",
  "#B5E655", "#3DDC97", "#7CD6C0",
  "#4FD1E8", "#7FB8FF", "#5B7FFF",
  "#B99CFF", "#D68CFF", "#E8D4FF",
  "#A97155", "#D9A066",
  "#FF4D4D", "#FFB4B4", "#B4E3FF",
];
const PEN_TYPES = [
  { id: "pencil", label: "えんぴつ", icon: PenLine, mult: 1, alpha: 1, composite: "source-over" },
  { id: "brush", label: "ふで", icon: Brush, mult: 2.2, alpha: 1, composite: "source-over" },
  { id: "crayon", label: "クレヨン", icon: Palette },
  { id: "glitter", label: "きらきら", icon: Sparkles },
];

function strokeStyled(ctx, style, color, size, path) {
  // path: array of {x,y}; draws either a straight line (2 points) or a smooth
  // quadratic curve through midpoints (3 points: from, control, to)
  ctx.save();
  ctx.globalAlpha = style.alpha;
  ctx.globalCompositeOperation = style.composite;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * style.mult;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (path.length === 2) {
    ctx.moveTo(path[0].x, path[0].y);
    ctx.lineTo(path[1].x, path[1].y);
  } else {
    ctx.moveTo(path[0].x, path[0].y);
    ctx.quadraticCurveTo(path[1].x, path[1].y, path[2].x, path[2].y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawCrayonSegment(ctx, color, size, from, to) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.floor(dist / 2));
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t + (Math.random() - 0.5) * size * 0.6;
    const y = from.y + (to.y - from.y) * t + (Math.random() - 0.5) * size * 0.6;
    ctx.globalAlpha = 0.3 + Math.random() * 0.35;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.45 * (0.6 + Math.random() * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSparkleShape(ctx, x, y, size, color) {
  const s = Math.max(9, size * 1.8) * (0.85 + Math.random() * 0.3);
  const rot = Math.random() * Math.PI;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s * 0.18, -s * 0.18, s, 0);
  ctx.quadraticCurveTo(s * 0.18, s * 0.18, 0, s);
  ctx.quadraticCurveTo(-s * 0.18, s * 0.18, -s, 0);
  ctx.quadraticCurveTo(-s * 0.18, -s * 0.18, 0, -s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
  ctx.restore();
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

function resizeImageFile(file, maxDim = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const defaultData = () => ({
  diaryEntries: [],
  gallery: [],
  plushies: [],
  travelTodos: [],
  travelMemories: [],
});

export default function KirakiraNotebook() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("home");
  const [toast, setToast] = useState("");
  const skipNextSave = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          setData(JSON.parse(res.value));
        } else {
          setData(defaultData());
        }
      } catch (err) {
        setData(defaultData());
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded || !data) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const t = setTimeout(async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(data), false);
      } catch (err) {
        console.error("save failed", err);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [data, loaded]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1600);
  }, []);

  const update = useCallback((fn) => {
    setData((prev) => {
      const next = { ...prev };
      fn(next);
      return next;
    });
  }, []);

  if (!loaded || !data) {
    return (
      <div style={{ fontFamily: "'Kiwi Maru','Zen Maru Gothic',sans-serif" }}
        className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="text-pink-400 text-sm flex flex-col items-center gap-3">
          <Sparkles className="animate-pulse" size={28} />
          よみこみちゅう…
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "home", label: "ホーム", icon: Home },
    { id: "draw", label: "おえかき", icon: Paintbrush },
    { id: "diary", label: "にっき", icon: BookOpen },
    { id: "plushies", label: "ぬいぐるみ", icon: Heart },
    { id: "travel", label: "たび", icon: Plane },
  ];

  return (
    <div
      style={{ fontFamily: "'Kiwi Maru','Zen Maru Gothic',sans-serif", minHeight: "100dvh" }}
      className="min-h-screen bg-pink-50 flex justify-center"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&family=Kiwi+Maru:wght@400;500&display=swap');
        * { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #FBCFE8; border-radius: 10px; }
      `}</style>
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative shadow-xl" style={{ minHeight: "100dvh", height: "100dvh", overflow: "hidden" }}>
        <Header tab={tab} />
        <main className="flex-1 overflow-y-auto pb-20 bg-pink-50">
          {tab === "home" && (
            <HomeTab
              data={data}
              setTab={setTab}
              onAddPhoto={(dataUrl) => {
                update((d) => {
                  d.gallery.unshift({ id: uid(), type: "photo", dataUrl, date: todayStr(), plushieId: null, caption: "" });
                });
                showToast("しゃしんをついかしたよ 📷");
              }}
            />
          )}
          {tab === "draw" && (
            <DrawTab
              onSave={(dataUrl) => {
                update((d) => {
                  d.gallery.unshift({ id: uid(), type: "drawing", dataUrl, date: todayStr(), plushieId: null, caption: "" });
                });
                showToast("おえかきをほぞんしたよ ✨");
                setTab("home");
              }}
            />
          )}
          {tab === "diary" && (
            <DiaryTab data={data} update={update} showToast={showToast} />
          )}
          {tab === "plushies" && (
            <PlushiesTab data={data} update={update} showToast={showToast} />
          )}
          {tab === "travel" && (
            <TravelTab data={data} update={update} showToast={showToast} />
          )}
        </main>
        <NavBar tabs={tabs} active={tab} setTab={setTab} />
        {toast && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-pink-400 text-white text-xs px-4 py-2 rounded-full shadow-lg z-30">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ tab }) {
  const titles = {
    home: "きらきらノート",
    draw: "おえかき",
    diary: "にっき",
    plushies: "ぬいぐるみフォルダー",
    travel: "たびの記録",
  };
  return (
    <div
      className="relative overflow-hidden px-5 pt-3 pb-4"
      style={{ background: "linear-gradient(135deg, #FFD9E8 0%, #FFF0F5 60%, #FFFFFF 100%)" }}
    >
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full" style={{ background: "#FFC7DE", opacity: 0.6 }} />
      <div className="absolute top-6 -left-8 w-14 h-14 rounded-full" style={{ background: "#FFE1EC", opacity: 0.7 }} />
      <Star className="absolute top-2 right-14 text-pink-200" size={13} fill="#FBCFE8" />
      <div className="relative">
        <p className="text-[10px] text-pink-400 tracking-wide mb-0.5">かわいいをあつめよう</p>
        <h1 className="text-xl text-pink-700" style={{ fontFamily: "'Kiwi Maru',sans-serif" }}>{titles[tab]}</h1>
      </div>
    </div>
  );
}

function NavBar({ tabs, active, setTab }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-pink-100 flex justify-around items-center py-1.5 px-1 z-20">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-2xl transition-colors"
            style={{ color: isActive ? "#DB2777" : "#D1A6BC", backgroundColor: isActive ? "#FCE7F3" : "transparent" }}
          >
            <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
            <span className="text-[9px]">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-3xl p-3 shadow-sm border border-pink-100 ${className}`}>
      {children}
    </div>
  );
}

function EmptyState({ text, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-4 text-pink-300">
      <Icon size={22} className="mb-1" />
      <p className="text-[11px]">{text}</p>
    </div>
  );
}

/* ---------------- HOME ---------------- */
function HomeTab({ data, setTab, onAddPhoto }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const stats = [
    { label: "おえかき・しゃしん", value: data.gallery.length, icon: ImageIcon },
    { label: "にっき", value: data.diaryEntries.length, icon: BookOpen },
    { label: "ぬいぐるみ", value: data.plushies.length, icon: Heart },
  ];
  const recent = data.gallery.slice(0, 6);

  return (
    <div className="px-4 pt-3 space-y-2.5">
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <Card key={s.label} className="text-center py-2 px-2">
            <s.icon size={14} className="mx-auto text-pink-400 mb-0.5" />
            <p className="text-base text-pink-700 leading-none">{s.value}</p>
            <p className="text-[9px] text-pink-400 mt-1 leading-tight">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-pink-600">さいきんのギャラリー</p>
          <button onClick={() => setTab("draw")} className="text-[11px] text-pink-400 flex items-center gap-1">
            <Plus size={12} /> おえかき
          </button>
        </div>
        <button
          onClick={() => fileRef.current && fileRef.current.click()}
          disabled={busy}
          className="w-full mb-2 border-2 border-dashed border-pink-200 rounded-2xl py-2 text-xs text-pink-400 flex items-center justify-center gap-2"
        >
          <Camera size={14} /> {busy ? "とりこみちゅう…" : "しゃしんをついかする"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            setBusy(true);
            try {
              const dataUrl = await resizeImageFile(file);
              onAddPhoto(dataUrl);
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
        {recent.length === 0 ? (
          <EmptyState text="まだなにもないよ。おえかきかしゃしんをついかしてみよう！" icon={Sparkles} />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {recent.map((g) => (
              <div key={g.id} className="aspect-square rounded-xl overflow-hidden bg-pink-50 border border-pink-100">
                <img src={g.dataUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------- DRAW ---------------- */
function DrawTab({ onSave }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef([]);
  const stampAccRef = useRef(0);
  const undoStackRef = useRef([]);
  const [color, setColor] = useState(DRAW_COLORS[4]);
  const [size, setSize] = useState(6);
  const [erasing, setErasing] = useState(false);
  const [penType, setPenType] = useState("pencil");
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const pushUndoSnapshot = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    try {
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      undoStackRef.current.push(snapshot);
      if (undoStackRef.current.length > 20) undoStackRef.current.shift();
      setCanUndo(true);
    } catch (err) {
      // ignore
    }
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const snapshot = undoStackRef.current.pop();
    if (snapshot) {
      ctx.putImageData(snapshot, 0, 0);
    }
    setCanUndo(undoStackRef.current.length > 0);
  };

  const start = (e) => {
    e.preventDefault();
    pushUndoSnapshot();
    drawingRef.current = true;
    const pos = getPos(e);
    pointsRef.current = [pos];
    stampAccRef.current = 0;
    if (penType === "glitter" && !erasing) {
      const canvas = canvasRef.current;
      drawSparkleShape(canvas.getContext("2d"), pos.x, pos.y, size, color);
    }
  };

  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e);
    const pts = pointsRef.current;
    const prev = pts[pts.length - 1];
    pts.push(pos);
    if (pts.length > 3) pts.shift();
    const path = pts.length >= 3
      ? [
          { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
          pts[1],
          { x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2 },
        ]
      : [prev, pos];

    if (erasing) {
      strokeStyled(ctx, { alpha: 1, composite: "source-over", mult: 2.5 }, "#FFFFFF", size, path);
    } else if (penType === "glitter") {
      const spacing = Math.max(16, size * 2.6);
      const d = Math.hypot(pos.x - prev.x, pos.y - prev.y);
      stampAccRef.current += d;
      if (stampAccRef.current >= spacing) {
        stampAccRef.current = 0;
        drawSparkleShape(ctx, pos.x, pos.y, size, color);
      }
    } else if (penType === "crayon") {
      drawCrayonSegment(ctx, color, size, prev, pos);
    } else {
      const style = PEN_TYPES.find((p) => p.id === penType) || PEN_TYPES[0];
      strokeStyled(ctx, style, color, size, path);
    }
  };
  const end = () => { drawingRef.current = false; pointsRef.current = []; };

  const clearCanvas = () => {
    pushUndoSnapshot();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="px-4 pt-3 space-y-2">
      <Card className="p-2">
        <canvas
          ref={canvasRef}
          width={600}
          height={600}
          className="w-full rounded-2xl border border-pink-100 touch-none bg-white"
          style={{ aspectRatio: "1 / 1", maxHeight: "38vh" }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </Card>

      <Card className="p-2.5">
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-0.5">
          {PEN_TYPES.map((p) => {
            const Icon = p.icon;
            const active = !erasing && penType === p.id;
            return (
              <button
                key={p.id}
                onClick={() => { setPenType(p.id); setErasing(false); }}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl shrink-0"
                style={{ backgroundColor: active ? "#FCE7F3" : "#FFF7FA", border: active ? "2px solid #F472B6" : "1px solid #FBCFE8" }}
              >
                <Icon size={13} className="text-pink-500" />
                <span className="text-[8px] text-pink-500 leading-none">{p.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setErasing(true)}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl shrink-0"
            style={{ backgroundColor: erasing ? "#FCE7F3" : "#FFF7FA", border: erasing ? "2px solid #F472B6" : "1px solid #FBCFE8" }}
          >
            <Eraser size={13} className="text-pink-500" />
            <span className="text-[8px] text-pink-500 leading-none">けしごむ</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {DRAW_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setErasing(false); }}
              className="w-6 h-6 rounded-full border-2"
              style={{ backgroundColor: c, borderColor: !erasing && color === c ? "#DB2777" : "#F3D6E4" }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-pink-400 shrink-0">ふとさ</span>
          <input type="range" min="2" max="24" value={size} onChange={(e) => setSize(Number(e.target.value))} className="flex-1 accent-pink-400" />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex-1 py-2 rounded-xl text-xs flex items-center justify-center gap-1"
            style={{ backgroundColor: "#FFF0F5", color: canUndo ? "#DB2777" : "#F5C6DA", opacity: canUndo ? 1 : 0.6 }}
          >
            <Undo2 size={13} /> もどす
          </button>
          <button onClick={clearCanvas} className="flex-1 py-2 rounded-xl bg-pink-50 text-pink-500 text-xs flex items-center justify-center gap-1">
            <Trash2 size={13} /> けす
          </button>
          <button
            onClick={() => onSave(canvasRef.current.toDataURL("image/png"))}
            className="flex-1 py-2 rounded-xl bg-pink-400 text-white text-xs flex items-center justify-center gap-1"
          >
            <Check size={13} /> ほぞんする
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- DIARY ---------------- */
function DiaryTab({ data, update, showToast }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mood, setMood] = useState(MOODS[0]);
  const [plushieId, setPlushieId] = useState("");

  const addEntry = () => {
    if (!text.trim()) return;
    update((d) => {
      d.diaryEntries.unshift({ id: uid(), date: todayStr(), mood, text: text.trim(), plushieId: plushieId || null });
    });
    setText(""); setMood(MOODS[0]); setPlushieId("");
    setOpen(false);
    showToast("にっきをかいたよ 📖");
  };

  return (
    <div className="px-4 pt-4 space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full py-3 rounded-2xl bg-pink-400 text-white text-sm flex items-center justify-center gap-1 shadow-sm"
      >
        {open ? <X size={15} /> : <Plus size={15} />} {open ? "とじる" : "きょうのにっきをかく"}
      </button>

      {open && (
        <Card>
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {MOODS.map((m) => (
              <button
                key={m}
                onClick={() => setMood(m)}
                className="w-9 h-9 rounded-full text-lg flex items-center justify-center"
                style={{ backgroundColor: mood === m ? "#FCE7F3" : "#FFF7FA", border: mood === m ? "2px solid #F472B6" : "1px solid #FBCFE8" }}
              >
                {m}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="きょうあったことをかいてみよう"
            className="w-full h-24 p-3 rounded-2xl bg-pink-50 text-sm text-pink-800 placeholder-pink-300 outline-none resize-none mb-3"
          />
          {data.plushies.length > 0 && (
            <select
              value={plushieId}
              onChange={(e) => setPlushieId(e.target.value)}
              className="w-full mb-3 p-2.5 rounded-xl bg-pink-50 text-xs text-pink-600 outline-none"
            >
              <option value="">ぬいぐるみをえらぶ（にんい）</option>
              {data.plushies.map((p) => (
                <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
              ))}
            </select>
          )}
          <button onClick={addEntry} className="w-full py-2.5 rounded-2xl bg-pink-500 text-white text-sm">
            きろくする
          </button>
        </Card>
      )}

      {data.diaryEntries.length === 0 && !open && (
        <EmptyState text="にっきはまだないよ。きょうのできごとをかいてみよう！" icon={BookOpen} />
      )}

      <div className="space-y-2">
        {data.diaryEntries.map((e) => {
          const plushie = data.plushies.find((p) => p.id === e.plushieId);
          return (
            <Card key={e.id} className="relative">
              <button
                onClick={() => update((d) => { d.diaryEntries = d.diaryEntries.filter((x) => x.id !== e.id); })}
                className="absolute top-3 right-3 text-pink-200"
              >
                <Trash2 size={14} />
              </button>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg leading-none">{e.mood}</span>
                <span className="text-[11px] text-pink-300">{e.date}</span>
                {plushie && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#FCE7F3", color: "#BE185D" }}>
                    {plushie.emoji} {plushie.name}
                  </span>
                )}
              </div>
              <p className="text-sm text-pink-800 whitespace-pre-wrap leading-relaxed pr-4">{e.text}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- PLUSHIES ---------------- */
function PlushiesTab({ data, update, showToast }) {
  const [openNew, setOpenNew] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(PLUSHIE_EMOJI[0]);
  const [color, setColor] = useState(PLUSHIE_COLORS[0]);
  const [favoritePoint, setFavoritePoint] = useState("");
  const [selected, setSelected] = useState(null);
  const detailFileRef = useRef(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const addPlushie = () => {
    if (!name.trim()) return;
    update((d) => { d.plushies.unshift({ id: uid(), name: name.trim(), emoji, color: color.name, favoritePoint: favoritePoint.trim() }); });
    setName(""); setEmoji(PLUSHIE_EMOJI[0]); setColor(PLUSHIE_COLORS[0]); setFavoritePoint("");
    setOpenNew(false);
    showToast("フォルダーをつくったよ 🧸");
  };

  if (selected) {
    const p = data.plushies.find((x) => x.id === selected);
    if (!p) { setSelected(null); return null; }
    const colorDef = PLUSHIE_COLORS.find((c) => c.name === p.color) || PLUSHIE_COLORS[0];
    const photos = data.gallery.filter((g) => g.plushieId === p.id);
    const diary = data.diaryEntries.filter((e) => e.plushieId === p.id);
    return (
      <div className="px-4 pt-4 space-y-3">
        <button onClick={() => setSelected(null)} className="text-pink-400 text-xs flex items-center gap-1 mb-1">
          <ChevronLeft size={14} /> もどる
        </button>
        <Card className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: colorDef.bg }}>
            {p.emoji}
          </div>
          <div className="flex-1">
            <p className="text-base text-pink-700">{p.name}</p>
            <p className="text-[11px] text-pink-300">しゃしん・おえかき {photos.length}こ / にっき {diary.length}こ</p>
          </div>
          <button
            onClick={() => {
              update((d) => {
                d.plushies = d.plushies.filter((x) => x.id !== p.id);
                d.gallery.forEach((g) => { if (g.plushieId === p.id) g.plushieId = null; });
                d.diaryEntries.forEach((e) => { if (e.plushieId === p.id) e.plushieId = null; });
              });
              setSelected(null);
            }}
            className="text-pink-200"
          >
            <Trash2 size={16} />
          </button>
        </Card>

        <Card>
          <p className="text-xs text-pink-500 mb-2">おきにいりポイント 💕</p>
          <textarea
            value={p.favoritePoint || ""}
            onChange={(e) => update((d) => { d.plushies.find((x) => x.id === p.id).favoritePoint = e.target.value; })}
            placeholder="どこがすき？どんなところがかわいい？"
            className="w-full h-20 p-3 rounded-2xl bg-pink-50 text-sm text-pink-800 placeholder-pink-300 outline-none resize-none"
          />
        </Card>

        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-pink-500">ギャラリー</p>
          <button
            onClick={() => detailFileRef.current && detailFileRef.current.click()}
            disabled={detailBusy}
            className="text-[11px] text-pink-400 flex items-center gap-1"
          >
            <Camera size={12} /> {detailBusy ? "とりこみちゅう…" : "しゃしんをついか"}
          </button>
          <input
            ref={detailFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files && e.target.files[0];
              if (!file) return;
              setDetailBusy(true);
              try {
                const dataUrl = await resizeImageFile(file);
                update((d) => {
                  d.gallery.unshift({ id: uid(), type: "photo", dataUrl, date: todayStr(), plushieId: p.id, caption: "" });
                });
                showToast("しゃしんをついかしたよ 📷");
              } finally {
                setDetailBusy(false);
                e.target.value = "";
              }
            }}
          />
        </div>
        {photos.length === 0 ? (
          <EmptyState text="このフォルダーにはまだなにもないよ" icon={ImageIcon} />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((g) => (
              <div key={g.id} className="relative aspect-square rounded-xl overflow-hidden bg-pink-50 border border-pink-100 group">
                <img src={g.dataUrl} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => update((d) => { d.gallery = d.gallery.filter((x) => x.id !== g.id); })}
                  className="absolute top-1 right-1 bg-white/80 rounded-full p-0.5 text-pink-400"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {diary.length > 0 && (
          <>
            <p className="text-xs text-pink-500 px-1 pt-2">にっき</p>
            <div className="space-y-2">
              {diary.map((e) => (
                <Card key={e.id}>
                  <div className="flex items-center gap-2 mb-1">
                    <span>{e.mood}</span>
                    <span className="text-[11px] text-pink-300">{e.date}</span>
                  </div>
                  <p className="text-sm text-pink-800">{e.text}</p>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 space-y-3">
      <button
        onClick={() => setOpenNew((v) => !v)}
        className="w-full py-3 rounded-2xl bg-pink-400 text-white text-sm flex items-center justify-center gap-1 shadow-sm"
      >
        {openNew ? <X size={15} /> : <Plus size={15} />} {openNew ? "とじる" : "あたらしいフォルダー"}
      </button>

      {openNew && (
        <Card>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ぬいぐるみのなまえ"
            className="w-full p-3 rounded-2xl bg-pink-50 text-sm text-pink-800 placeholder-pink-300 outline-none mb-3"
          />
          <div className="flex gap-1.5 flex-wrap mb-3">
            {PLUSHIE_EMOJI.map((em) => (
              <button
                key={em}
                onClick={() => setEmoji(em)}
                className="w-9 h-9 rounded-full text-lg flex items-center justify-center"
                style={{ backgroundColor: emoji === em ? "#FCE7F3" : "#FFF7FA", border: emoji === em ? "2px solid #F472B6" : "1px solid #FBCFE8" }}
              >
                {em}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {PLUSHIE_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2"
                style={{ backgroundColor: c.bg, borderColor: color.name === c.name ? c.text : "transparent" }}
              />
            ))}
          </div>
          <button onClick={addPlushie} className="w-full py-2.5 rounded-2xl bg-pink-500 text-white text-sm">
            つくる
          </button>
        </Card>
      )}

      {data.plushies.length === 0 && !openNew && (
        <EmptyState text="ぬいぐるみのフォルダーをつくってみよう" icon={Heart} />
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {data.plushies.map((p) => {
          const colorDef = PLUSHIE_COLORS.find((c) => c.name === p.color) || PLUSHIE_COLORS[0];
          const count = data.gallery.filter((g) => g.plushieId === p.id).length;
          return (
            <button key={p.id} onClick={() => setSelected(p.id)} className="text-left">
              <Card className="flex flex-col items-center py-4 gap-1.5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ backgroundColor: colorDef.bg }}>
                  {p.emoji}
                </div>
                <p className="text-sm text-pink-700">{p.name}</p>
                <p className="text-[10px] text-pink-300">{count}こ</p>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- TRAVEL ---------------- */
function TravelTab({ data, update, showToast }) {
  const [todoText, setTodoText] = useState("");
  const [memOpen, setMemOpen] = useState(false);
  const [memTitle, setMemTitle] = useState("");
  const [memText, setMemText] = useState("");
  const [memPhoto, setMemPhoto] = useState(null);
  const fileRef = useRef(null);

  const addTodo = () => {
    if (!todoText.trim()) return;
    update((d) => { d.travelTodos.unshift({ id: uid(), text: todoText.trim(), done: false }); });
    setTodoText("");
  };

  const addMemory = () => {
    if (!memTitle.trim() && !memText.trim()) return;
    update((d) => {
      d.travelMemories.unshift({ id: uid(), title: memTitle.trim(), text: memText.trim(), photo: memPhoto, date: todayStr() });
    });
    setMemTitle(""); setMemText(""); setMemPhoto(null); setMemOpen(false);
    showToast("たびのおもいでをほぞんしたよ ✈️");
  };

  return (
    <div className="px-4 pt-4 space-y-4">
      <Card>
        <p className="text-sm text-pink-600 mb-2">やりたいことリスト</p>
        <div className="flex items-center gap-2 mb-3">
          <input
            value={todoText}
            onChange={(e) => setTodoText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            placeholder="たびでやりたいこと"
            className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-pink-50 text-sm text-pink-800 placeholder-pink-300 outline-none"
          />
          <button onClick={addTodo} className="w-11 h-11 rounded-xl bg-pink-400 text-white flex items-center justify-center shrink-0">
            <Plus size={16} />
          </button>
        </div>
        {data.travelTodos.length === 0 ? (
          <EmptyState text="やりたいことをついかしてみよう" icon={Plane} />
        ) : (
          <div className="space-y-1.5">
            {data.travelTodos.map((t) => (
              <div key={t.id} className="flex items-center gap-2 bg-pink-50 rounded-xl px-3 py-2">
                <button
                  onClick={() => update((d) => { d.travelTodos.find((x) => x.id === t.id).done = !t.done; })}
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: "#F472B6", backgroundColor: t.done ? "#F472B6" : "transparent" }}
                >
                  {t.done && <Check size={12} className="text-white" />}
                </button>
                <span className={`text-sm flex-1 ${t.done ? "line-through text-pink-300" : "text-pink-800"}`}>{t.text}</span>
                <button onClick={() => update((d) => { d.travelTodos = d.travelTodos.filter((x) => x.id !== t.id); })} className="text-pink-200">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <button
        onClick={() => setMemOpen((v) => !v)}
        className="w-full py-3 rounded-2xl bg-pink-400 text-white text-sm flex items-center justify-center gap-1 shadow-sm"
      >
        {memOpen ? <X size={15} /> : <Plus size={15} />} {memOpen ? "とじる" : "たのしかったおもいでをかく"}
      </button>

      {memOpen && (
        <Card>
          <input
            value={memTitle}
            onChange={(e) => setMemTitle(e.target.value)}
            placeholder="タイトル（どこにいった？）"
            className="w-full p-2.5 rounded-xl bg-pink-50 text-sm text-pink-800 placeholder-pink-300 outline-none mb-2"
          />
          <textarea
            value={memText}
            onChange={(e) => setMemText(e.target.value)}
            placeholder="たのしかったことをかいてみよう"
            className="w-full h-20 p-3 rounded-2xl bg-pink-50 text-sm text-pink-800 placeholder-pink-300 outline-none resize-none mb-2"
          />
          {memPhoto ? (
            <div className="relative mb-2 w-24 h-24 rounded-xl overflow-hidden border border-pink-100">
              <img src={memPhoto} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setMemPhoto(null)} className="absolute top-1 right-1 bg-white rounded-full p-0.5 text-pink-400">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current && fileRef.current.click()}
              className="w-full mb-2 border-2 border-dashed border-pink-200 rounded-2xl py-3 text-xs text-pink-400 flex items-center justify-center gap-2"
            >
              <Camera size={14} /> しゃしんをつける（にんい）
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files && e.target.files[0];
              if (!file) return;
              const dataUrl = await resizeImageFile(file);
              setMemPhoto(dataUrl);
              e.target.value = "";
            }}
          />
          <button onClick={addMemory} className="w-full py-2.5 rounded-2xl bg-pink-500 text-white text-sm">
            きろくする
          </button>
        </Card>
      )}

      {data.travelMemories.length === 0 && !memOpen && (
        <EmptyState text="たびのおもいでをきろくしてみよう" icon={Sparkles} />
      )}

      <div className="space-y-2.5">
        {data.travelMemories.map((m) => (
          <Card key={m.id} className="relative">
            <button
              onClick={() => update((d) => { d.travelMemories = d.travelMemories.filter((x) => x.id !== m.id); })}
              className="absolute top-3 right-3 text-pink-200"
            >
              <Trash2 size={14} />
            </button>
            <div className="flex gap-3">
              {m.photo && (
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-pink-100">
                  <img src={m.photo} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 pr-4">
                {m.title && <p className="text-sm text-pink-700 mb-0.5">{m.title}</p>}
                <p className="text-[11px] text-pink-300 mb-1">{m.date}</p>
                {m.text && <p className="text-xs text-pink-800 whitespace-pre-wrap leading-relaxed">{m.text}</p>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
