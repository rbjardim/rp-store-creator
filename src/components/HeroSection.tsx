import heroBg from "@/assets/hero-bg.jpg";

const HeroSection = () => {
  const scrollToStore = () => {
    document.getElementById("store")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative flex h-[420px] items-center justify-center overflow-hidden">
      {/* Background */}
      <img
        src={heroBg}
        alt="Campo Limpo Roleplay cidade"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--gradient-hero)" }}
      />

      {/* Content */}
      <div className="relative z-10 text-center animate-fade-in-up">
        <h1 className="font-display text-5xl tracking-wider text-foreground md:text-7xl">
          Campo Limpo Roleplay
        </h1>
        <p className="mt-2 text-lg text-muted-foreground md:text-xl">
          A melhor experiência de GTA RP
        </p>
        <button
          onClick={scrollToStore}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95 animate-pulse-glow"
        >
          Ver produtos
          <span>→</span>
        </button>
      </div>
    </section>
  );
};

export default HeroSection;
