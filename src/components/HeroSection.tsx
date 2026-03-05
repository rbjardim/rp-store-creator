import heroBg from "@/assets/hero-bg.jpg";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const HeroSection = () => {
  const { data: settings } = useQuery({
    queryKey: ["store-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_settings").select("*");
      if (error) throw error;
      return Object.fromEntries(data.map((s) => [s.key, s.value]));
    },
  });

  const scrollToStore = () => {
    document.getElementById("store")?.scrollIntoView({ behavior: "smooth" });
  };

  const title = settings?.hero_title || "Campo Limpo Roleplay";
  const subtitle = settings?.hero_subtitle || "A melhor experiência de GTA RP";

  return (
    <section className="relative flex h-[420px] items-center justify-center overflow-hidden">
      <img src={heroBg} alt="Cidade" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
      <div className="relative z-10 text-center animate-fade-in-up">
        <h1 className="font-display text-5xl tracking-wider text-foreground md:text-7xl">{title}</h1>
        <p className="mt-2 text-lg text-muted-foreground md:text-xl">{subtitle}</p>
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
