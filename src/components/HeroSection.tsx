import heroBg from "@/assets/clvideo.mp4";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type StoreSettings = {
  hero_title?: string;
  hero_subtitle?: string;
};

const HeroSection = () => {
  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ["store-settings"],
    queryFn: async () => {
      return apiFetch<StoreSettings>("/settings");
    },
  });

  const scrollToStore = () => {
    document.getElementById("store")?.scrollIntoView({ behavior: "smooth" });
  };

  const title = settings?.hero_title || "Loja Oficial Campo Limpo";
  const subtitle =
    settings?.hero_subtitle || "O RP Paulista do Momento!";

  return (
      <section className="relative flex h-[420px] items-center justify-center overflow-hidden">
        {/* 🎬 VÍDEO */}
        <video
          src={heroBg}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* 🎨 GRADIENTE (mantém o seu) */}
        <div
          className="absolute inset-0"
          style={{ background: "var(--gradient-hero)" }}
        />

        {/* 📦 CONTEÚDO */}
        <div className="relative z-10 text-center animate-fade-in-up">
          <h1 className="font-display text-5xl tracking-wider text-foreground md:text-7xl">
            {title}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground md:text-xl">
            {subtitle}
          </p>
          <button
            onClick={scrollToStore}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-3 font-semibold text-accent-foreground transition-all hover:opacity-90 active:scale-95 animate-pulse-glow"
          >
            Ver produtos →
          </button>
        </div>
      </section>
  );
};

export default HeroSection;