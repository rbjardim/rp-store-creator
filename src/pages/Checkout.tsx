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
          })),
          couponCode: appliedCoupon?.code || null,
          customerName,
          customerEmail,
          characterId,
          discordId: discordUser.id,
          discordUsername: discordUser.username,
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
    <div className="mx-auto max-w-3xl p-6 text-white">
      <h1 className="mb-6 text-2xl font-bold">Finalizar compra</h1>

      {/* 🛒 Produtos */}
      <div className="mb-6 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between border p-3 rounded">
            <span>{item.name} x{item.quantity}</span>
            <span>{formatPrice(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>

      {/* 📋 Formulário */}
      <div className="space-y-3 mb-6">
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Nome completo"
          className="w-full p-2 rounded bg-black text-white border"
        />

        <input
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="Email"
          className="w-full p-2 rounded bg-black text-white border"
        />

        <input
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
          placeholder="ID do personagem"
          className="w-full p-2 rounded bg-black text-white border"
        />

        {!discordUser ? (
          <button
            onClick={connectDiscord}
            className="w-full bg-indigo-600 p-2 rounded"
          >
            Conectar Discord
          </button>
        ) : (
          <div className="bg-green-700 p-2 rounded">
            Discord conectado: {discordUser.username}
          </div>
        )}
      </div>

      {/* 🎟 Cupom */}
      <div className="mb-6">
        <input
          value={coupon}
          onChange={(e) => setCoupon(e.target.value)}
          placeholder="Cupom"
          className="w-full p-2 rounded bg-black text-white border"
        />
        <button
          onClick={applyCoupon}
          className="mt-2 w-full bg-gray-700 p-2 rounded"
        >
          Aplicar cupom
        </button>
      </div>

      {/* 💰 Total */}
      <div className="mb-4 flex justify-between">
        <span>Total:</span>
        <span>{formatPrice(finalTotal)}</span>
      </div>

      {/* 💳 Botão */}
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-green-600 p-3 rounded font-bold"
      >
        {loading ? "Processando..." : "Pagar"}
      </button>
    </div>
  );
};

export default Checkout;