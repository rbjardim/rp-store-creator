import { useCart } from "@/contexts/CartContext";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

const Checkout = () => {
  const { items, total } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [discordUser, setDiscordUser] = useState<any>(null);

  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const formatPrice = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // 🔥 SALVAR FORMULÁRIO
  const saveForm = () => {
    localStorage.setItem(
      "checkout_form",
      JSON.stringify({
        customerName,
        customerEmail,
        characterId,
        coupon,
      })
    );
  };

  // 🔥 CARREGAR DADOS + DISCORD
  useEffect(() => {
    // carregar form salvo
    const savedForm = localStorage.getItem("checkout_form");

    if (savedForm) {
      try {
        const data = JSON.parse(savedForm);
        setCustomerName(data.customerName || "");
        setCustomerEmail(data.customerEmail || "");
        setCharacterId(data.characterId || "");
        setCoupon(data.coupon || "");
      } catch {
        localStorage.removeItem("checkout_form");
      }
    }

    // carregar discord salvo
    const savedDiscord = localStorage.getItem("checkout_discord_user");

    if (savedDiscord) {
      try {
        setDiscordUser(JSON.parse(savedDiscord));
      } catch {
        localStorage.removeItem("checkout_discord_user");
      }
    }

    // pegar retorno da URL
    const params = new URLSearchParams(window.location.search);

    const discordId = params.get("discord_id");
    const discordUsername = params.get("discord_username");

    if (discordId && discordUsername) {
      const user = {
        id: discordId,
        username: discordUsername,
      };

      localStorage.setItem("checkout_discord_user", JSON.stringify(user));
      setDiscordUser(user);

      params.delete("discord_id");
      params.delete("discord_username");

      window.history.replaceState({}, "", "/checkout");
    }
  }, []);

  const connectDiscord = () => {
    saveForm();

    const returnUrl = encodeURIComponent(
      `${window.location.origin}/checkout`
    );

    window.location.href = `${API_URL}/discord/login?returnUrl=${returnUrl}`;
  };

  const applyCoupon = async () => {
    try {
      const res = await fetch(`${API_URL}/coupons/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: coupon }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.message);

      setAppliedCoupon(data);
    } catch (err: any) {
      alert(err.message || "Cupom inválido");
      setAppliedCoupon(null);
    }
  };

  const discount = appliedCoupon
    ? total * (appliedCoupon.discount_percent / 100)
    : 0;

  const finalTotal = total - discount;

  const handleCheckout = async () => {
    if (!customerName) return alert("Informe seu nome");
    if (!customerEmail) return alert("Informe seu email");
    if (!characterId) return alert("Informe o ID do personagem");
    if (!discordUser) return alert("Conecte seu Discord");

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/checkout/create-preference`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            image_url: i.image_url,
          })),
          couponCode: coupon || null,
          customer: {
            name: customerName,
            email: customerEmail,
            characterId: characterId,
            discordId: discordUser.id,
            discordUsername: discordUser.username,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.message);

      window.location.href = data.init_point;
    } catch (err: any) {
      alert(err.message || "Erro no checkout");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="p-10 text-center text-white">
        Carrinho vazio
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-background opacity-95" />
      <div className="absolute inset-0 backdrop-blur-md" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-5xl rounded-2xl border border-border bg-card/95 p-6 shadow-2xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl text-foreground">
                Finalizar Doação
              </h1>
              <p className="text-sm text-muted-foreground">
                Confira seus produtos e preencha os dados para continuar.
              </p>
            </div>

            <button
              onClick={() => (window.location.href = "/")}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Voltar para loja
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-background p-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Produto(s)
                </h2>

                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {item.image_url && (
                          <img
                            src={
                              item.image_url.startsWith("http")
                                ? item.image_url
                                : `${API_URL.replace(/\/api$/, "")}${item.image_url}`
                            }
                            alt={item.name}
                            className="h-14 w-14 rounded-md object-cover"
                          />
                        )}

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {item.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Quantidade: {item.quantity}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-foreground">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(item.price)} cada
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Cupom de desconto
                </h2>

                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Digite seu cupom"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                />

                <button
                  onClick={applyCoupon}
                  className="mt-2 w-full rounded-md bg-secondary py-2 text-sm font-semibold text-secondary-foreground hover:opacity-90"
                >
                  Aplicar cupom
                </button>

                {appliedCoupon && (
                  <p className="mt-2 text-xs text-green-400">
                    Cupom aplicado: {appliedCoupon.discount_percent}% OFF
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Seus dados
              </h2>

              <div className="space-y-3">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                />

                <input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                />

                <input
                  value={characterId}
                  onChange={(e) => setCharacterId(e.target.value)}
                  placeholder="ID do personagem"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                />

                {!discordUser ? (
                  <button
                    onClick={connectDiscord}
                    className="w-full rounded-md bg-[#5865F2] py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Conectar Discord
                  </button>
                ) : (
                  <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-400">
                    Discord conectado: <strong>{discordUser.username}</strong>
                  </div>
                )}
              </div>

              <div className="my-5 border-t border-border" />

              <div className="space-y-2 text-sm text-foreground">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatPrice(total)}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-green-400">
                    <span>Desconto</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatPrice(finalTotal)}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading}
                className="mt-5 w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Processando..." : "Pagar agora"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;