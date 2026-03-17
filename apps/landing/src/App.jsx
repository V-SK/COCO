import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
import { translations } from "./i18n";
import "./index.css";

// ─── Language Context ───
const LangContext = createContext();
function useLang() { return useContext(LangContext); }
function t(lang, key) { return translations[lang]?.[key] || translations.en[key] || key; }

// ─── Particle Canvas ───
function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animId;
    const isMobile = window.innerWidth < 768;
    const count = isMobile ? 20 : 40;
    const particles = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedY: -(Math.random() * 0.5 + 0.1),
        speedX: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.1,
        pulse: Math.random() * Math.PI * 2,
      });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.pulse += 0.02;
        const alpha = p.opacity * (0.5 + 0.5 * Math.sin(p.pulse));
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,185,11,${alpha})`;
        ctx.shadowBlur = 15;
        ctx.shadowColor = `rgba(240,185,11,${alpha * 0.5})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

// ─── Intersection Observer Hook ───
function useInView() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

// ─── Section Wrapper ───
function Section({ id, children, className = "" }) {
  const [ref, visible] = useInView();
  return (
    <section id={id} ref={ref} className={`relative z-10 py-20 px-4 md:px-8 ${className} ${visible ? "visible" : ""}`}>
      <div className="max-w-6xl mx-auto">{typeof children === "function" ? children(visible) : children}</div>
    </section>
  );
}

// ─── Navbar ───
function Navbar() {
  const { lang, setLang } = useLang();
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = [
    [t(lang, "nav_about"), "#capabilities"],
    [t(lang, "nav_plugins"), "#plugins"],
    [t(lang, "nav_architecture"), "#wallet"],
    [t(lang, "nav_community"), "#community"],
  ];
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${solid ? "navbar-solid" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 md:px-8 h-16">
        <a href="#" className="text-xl font-bold gold-text">COCO</a>
        <div className="hidden md:flex gap-6 items-center">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="text-sm text-gray-400 hover:text-gold transition-colors">{label}</a>
          ))}
          <button onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            className="lang-switch text-xs text-gray-500 border border-gray-700 rounded px-2 py-1 hover:border-gold/50">
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            className="md:hidden lang-switch text-xs text-gray-500 border border-gray-700 rounded px-2 py-1">
            {lang === "zh" ? "EN" : "中文"}
          </button>
          <a href="https://app.cocobnb.meme" target="_blank" rel="noopener" className="btn-gold text-black text-sm font-semibold px-4 py-2 rounded-lg">
            {t(lang, "nav_launch")}
          </a>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ───
function Hero() {
  const { lang } = useLang();
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden">
      <div className="absolute w-[500px] h-[500px] rounded-full breathing-glow" style={{
        background: "radial-gradient(circle, rgba(240,185,11,0.12) 0%, transparent 70%)",
        top: "50%", left: "50%", transform: "translate(-50%, -55%)",
      }} />
      <img src="/coco-welcome.jpg" alt="COCO" className="hero-character relative z-10 h-[45vh] max-h-[400px] object-contain drop-shadow-2xl"
        style={{ maskImage: "linear-gradient(to bottom, black 70%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent 100%)" }} />
      <h1 className="line-in line-in-1 text-6xl md:text-8xl font-black tracking-tight gold-text mt-4">COCO</h1>
      <p className="line-in line-in-2 text-lg md:text-xl text-gray-300 mt-3 font-light">{t(lang, "hero_subtitle")}</p>
      <p className="line-in line-in-3 text-sm text-gray-500 mt-2 max-w-md">{t(lang, "hero_tagline")}</p>
      <div className="line-in line-in-4 flex gap-4 mt-8">
        <a href="https://app.cocobnb.meme" target="_blank" rel="noopener" className="btn-gold text-black font-semibold px-6 py-3 rounded-lg text-sm">
          {t(lang, "hero_cta_launch")}
        </a>
        <a href="#capabilities" className="btn-gold-outline text-gold px-6 py-3 rounded-lg text-sm font-medium">
          {t(lang, "hero_cta_explore")}
        </a>
      </div>
    </section>
  );
}

// ─── Core Capabilities ───
function Capabilities() {
  const { lang } = useLang();
  const caps = [
    { icon: "🧠", titleKey: "cap_ai_title", descKey: "cap_ai_desc" },
    { icon: "⚡", titleKey: "cap_trade_title", descKey: "cap_trade_desc" },
    { icon: "🔗", titleKey: "cap_chain_title", descKey: "cap_chain_desc" },
    { icon: "🌐", titleKey: "cap_multi_title", descKey: "cap_multi_desc" },
  ];
  return (
    <Section id="capabilities">
      {(vis) => (
        <>
          <h2 className={`text-3xl md:text-4xl font-bold text-center gold-text mb-4 fade-in-up ${vis ? "visible" : ""}`}>
            {t(lang, "cap_title")}
          </h2>
          <p className={`text-center text-gray-500 mb-12 fade-in-up ${vis ? "visible" : ""}`} style={{ transitionDelay: "0.1s" }}>
            {t(lang, "cap_subtitle")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-children">
            {caps.map((c, i) => (
              <div key={i} className={`fade-in-up ${vis ? "visible" : ""} card-glow border border-dark-border rounded-xl p-6 bg-dark-card/50 backdrop-blur-sm transition-all duration-300 cursor-default`}
                style={{ transitionDelay: `${i * 0.1 + 0.15}s` }}>
                <div className="text-3xl mb-3">{c.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{t(lang, c.titleKey)}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{t(lang, c.descKey)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

// ─── Plugin Matrix ───
const PLUGIN_KEYS = [
  "price", "scan", "swap", "wallet", "nfa", "browser", "shell", "cron",
  "memory", "computeruse", "vision", "knowledge", "tts", "sql",
  "orchestrator", "chain_events", "alerts", "dex_agg", "webhook", "history",
  "nft", "news", "trust_score", "quant_signal", "auto_trade", "copy_trade",
  "whale_alert", "report", "polymarket", "ollama",
];

const PLUGIN_NAMES = {
  price: "price", scan: "scan", swap: "swap", wallet: "wallet", nfa: "nfa",
  browser: "browser", shell: "shell", cron: "cron", memory: "memory",
  computeruse: "computeruse", vision: "vision", knowledge: "knowledge",
  tts: "tts", sql: "sql", orchestrator: "orchestrator",
  chain_events: "chain-events", alerts: "alerts", dex_agg: "dex-agg",
  webhook: "webhook", history: "history", nft: "nft", news: "news",
  trust_score: "trust-score", quant_signal: "quant-signal",
  auto_trade: "auto-trade", copy_trade: "copy-trade",
  whale_alert: "whale-alert", report: "report", polymarket: "polymarket",
  ollama: "ollama",
};

function Plugins() {
  const { lang } = useLang();
  return (
    <Section id="plugins">
      {(vis) => (
        <>
          <h2 className={`text-3xl md:text-4xl font-bold text-center gold-text mb-4 fade-in-up ${vis ? "visible" : ""}`}>
            {t(lang, "plug_title")}
          </h2>
          <p className={`text-center text-gray-500 mb-12 fade-in-up ${vis ? "visible" : ""}`} style={{ transitionDelay: "0.1s" }}>
            {t(lang, "plug_subtitle")}
          </p>
          <div className="plugin-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {PLUGIN_KEYS.map((key, i) => (
              <div key={key} className={`fade-in-up ${vis ? "visible" : ""} group border border-dark-border rounded-lg p-3 bg-dark-card/30 hover:bg-dark-card/60 hover:border-gold/30 hover:shadow-[0_0_15px_rgba(240,185,11,0.1)] hover:scale-105 transition-all duration-300 cursor-default`}
                style={{ "--i": i, transitionDelay: `${i * 0.03 + 0.1}s` }}>
                <p className="text-xs font-mono text-gold/80 group-hover:text-gold transition-colors">{PLUGIN_NAMES[key]}</p>
                <p className="text-[10px] text-gray-500 mt-1 leading-tight group-hover:text-gray-400 transition-colors">
                  {t(lang, `p_${key}`)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

// ─── Wallet Architecture ───
function WalletSection() {
  const { lang } = useLang();
  const wallets = [
    { icon: "📝", nameKey: "w_unsigned", descKey: "w_unsigned_desc" },
    { icon: "🔑", nameKey: "w_delegated", descKey: "w_delegated_desc" },
    { icon: "⏱️", nameKey: "w_session", descKey: "w_session_desc" },
    { icon: "🏦", nameKey: "w_custodial", descKey: "w_custodial_desc" },
  ];
  return (
    <Section id="wallet">
      {(vis) => (
        <>
          <h2 className={`text-3xl md:text-4xl font-bold text-center gold-text mb-4 fade-in-up ${vis ? "visible" : ""}`}>
            {t(lang, "wallet_title")}
          </h2>
          <p className={`text-center text-gray-500 mb-12 fade-in-up ${vis ? "visible" : ""}`} style={{ transitionDelay: "0.1s" }}>
            {t(lang, "wallet_subtitle")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
            {wallets.map((w, i) => (
              <div key={i} className={`fade-in-up ${vis ? "visible" : ""} card-glow border border-dark-border rounded-xl p-5 bg-dark-card/50 text-center transition-all duration-300`}
                style={{ transitionDelay: `${i * 0.1 + 0.15}s` }}>
                <div className="text-2xl mb-3">{w.icon}</div>
                <h3 className="text-sm font-semibold text-white mb-1">{t(lang, w.nameKey)}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{t(lang, w.descKey)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

// ─── Contract + Platforms ───
function Contract() {
  const { lang } = useLang();
  const [copied, setCopied] = useState(false);
  const ca = "0xbab528425edb1e0e36d3719bc3307d9c8cce8888";
  const copy = useCallback(() => {
    navigator.clipboard.writeText(ca);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);
  const platforms = [
    ["MEXC", "https://www.mexc.com/exchange/COCO_USDT"],
    ["GeckoTerminal", "https://www.geckoterminal.com/bsc/pools/0x27762d5f39cd3a0c75ae77c401fd7e460d9e6d66"],
    ["CoinMarketCap", "https://dex.coinmarketcap.com/token/bsc/0x80f1ff15b887cb19295d88c8c16f89d47f6d8888/"],
    ["DexScreener", "https://dexscreener.com/bsc/0x27762d5F39CD3A0C75Ae77C401Fd7E460D9E6d66"],
    ["DexTools", "https://www.dextools.io/app/cn/bnb/pair-explorer/0x27762d5f39cd3a0c75ae77c401fd7e460d9e6d66"],
  ];
  return (
    <Section id="contract">
      {(vis) => (
        <div className={`fade-in-up ${vis ? "visible" : ""}`}>
          <div className="pulse-gold border border-dark-border rounded-xl p-6 bg-dark-card/50 backdrop-blur-sm text-center max-w-2xl mx-auto">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">{t(lang, "contract_label")}</p>
            <button onClick={copy} className="group flex items-center justify-center gap-2 mx-auto hover:opacity-80 transition-opacity">
              <code className="text-gold font-mono text-xs md:text-sm break-all">{ca}</code>
              <span className="text-gray-500 group-hover:text-gold transition-colors text-xs">
                {copied ? t(lang, "contract_copied") : t(lang, "contract_copy")}
              </span>
            </button>
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              <span className="text-xs text-gray-600">{t(lang, "contract_listed")}</span>
              {platforms.map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-gold transition-colors underline underline-offset-2 decoration-dark-border hover:decoration-gold">
                  {name}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── Community ───
function Community() {
  const { lang } = useLang();
  const socials = [
    ["Twitter", "https://x.com/COCO_DOGE", "𝕏"],
    ["Telegram", "https://t.me/coco_bsc1", "✈"],
  ];
  return (
    <Section id="community">
      {(vis) => (
        <>
          <h2 className={`text-3xl md:text-4xl font-bold text-center gold-text mb-12 fade-in-up ${vis ? "visible" : ""}`}>
            {t(lang, "community_title")}
          </h2>
          <div className="flex justify-center gap-6">
            {socials.map(([name, url, icon], i) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                className={`fade-in-up ${vis ? "visible" : ""} flex flex-col items-center gap-2 group`}
                style={{ transitionDelay: `${i * 0.15 + 0.2}s` }}>
                <div className="w-16 h-16 rounded-full border border-dark-border bg-dark-card/50 flex items-center justify-center text-2xl text-gold group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(240,185,11,0.2)] group-hover:border-gold/50 transition-all duration-300">
                  {icon}
                </div>
                <span className="text-xs text-gray-500 group-hover:text-gold transition-colors">{name}</span>
              </a>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

// ─── Footer ───
function Footer() {
  const { lang } = useLang();
  return (
    <footer className="relative z-10 py-12 text-center border-t border-dark-border">
      <p className="gold-text text-lg font-bold breathing-glow inline-block">COCO</p>
      <p className="text-xs text-gray-600 mt-2">{t(lang, "footer_rights")}</p>
    </footer>
  );
}

// ─── App ───
export default function App() {
  const [lang, setLang] = useState("zh");
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <ParticleCanvas />
      <Navbar />
      <Hero />
      <Capabilities />
      <Plugins />
      <WalletSection />
      <Contract />
      <Community />
      <Footer />
    </LangContext.Provider>
  );
}
