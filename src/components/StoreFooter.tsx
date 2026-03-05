const StoreFooter = () => {
  return (
    <footer className="border-t border-border bg-background py-8">
      <div className="mx-auto max-w-7xl px-4 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary font-display text-sm text-primary-foreground">
            CL
          </div>
          <span className="font-display text-xl tracking-wide text-foreground">
            Campo Limpo Roleplay
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          © 2026 Campo Limpo Roleplay. Todos os direitos reservados.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Este site não é afiliado à Rockstar Games ou Take-Two Interactive.
        </p>
      </div>
    </footer>
  );
};

export default StoreFooter;
