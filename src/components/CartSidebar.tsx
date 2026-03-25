import { X, Minus, Plus, ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useState } from "react";
import { API_URL } from "@/lib/api";

const getImageUrl = (imageUrl?: string | null) => {
  if (!imageUrl) return "";

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  const base = API_URL.replace(/\/api$/, ""); // remove o /api do final

  return `${base}${imageUrl}`;
};

const CartSidebar = () => {
  const {
    items,
    removeItem,
    updateQuantity,
    total,
    itemCount,
    isOpen,
    setIsOpen,
    clearCart,
  } = useCart();

  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [loadingCoupon, setLoadingCoupon] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const formatPrice = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const applyCoupon = async () => {
    try {
      setLoadingCoupon(true);

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
    } finally {
      setLoadingCoupon(false);
    }
  };

  const handleCheckout = async () => {
  try {
    if (items.length === 0) {
      alert("Seu carrinho está vazio.");
      return;
    }

    setLoadingCheckout(true);

    const res = await fetch(`${API_URL}/checkout/create-preference`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: items.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        couponCode: appliedCoupon?.code || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || "Erro ao iniciar pagamento");
    }

    if (!data?.init_point) {
      throw new Error("Mercado Pago não retornou a URL de pagamento.");
    }

    window.location.href = data.init_point;
  } catch (err: any) {
    console.error("Erro checkout:", err);
    alert(err.message || "Erro ao finalizar compra");
  } finally {
    setLoadingCheckout(false);
  }
};

  const discount = appliedCoupon
    ? total * (appliedCoupon.discount_percent / 100)
    : 0;

  const finalTotal = total - discount;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="font-display text-xl text-foreground">
            Carrinho ({itemCount})
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
            <ShoppingCart className="mb-3 h-12 w-12 opacity-30" />
            <p>Carrinho vazio</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-md border border-border bg-background p-3"
                >
                  {item.image_url && (
                    <img
                      src={getImageUrl(item.image_url)}
                      alt={item.name}
                      className="h-16 w-16 rounded object-cover"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {item.name}
                    </p>

                    <p className="text-sm text-muted-foreground">
                      {formatPrice(item.price)}
                    </p>

                    <div className="mt-1 flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        className="rounded bg-secondary p-1 text-foreground hover:bg-accent"
                      >
                        <Minus className="h-3 w-3" />
                      </button>

                      <span className="text-sm text-foreground">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className="rounded bg-secondary p-1 text-foreground hover:bg-accent"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="px-4 pb-3">
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder="Cupom de desconto"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />

              <button
                onClick={applyCoupon}
                disabled={loadingCoupon}
                className="mt-2 w-full rounded-md bg-accent py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                {loadingCoupon ? "Aplicando..." : "Aplicar cupom"}
              </button>

              {appliedCoupon && (
                <p className="mt-2 text-xs text-green-400">
                  Cupom aplicado: {appliedCoupon.discount_percent}% OFF
                </p>
              )}
            </div>

            <div className="border-t border-border p-4">
              <div className="mb-2 flex justify-between text-sm text-foreground">
                <span>Subtotal:</span>
                <span>{formatPrice(total)}</span>
              </div>

              {appliedCoupon && (
                <div className="mb-2 flex justify-between text-sm text-green-400">
                  <span>Desconto:</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}

              <div className="mb-3 flex justify-between text-foreground">
                <span className="font-semibold">Total:</span>
                <span className="font-display text-xl">
                  {formatPrice(finalTotal)}
                </span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loadingCheckout}
                className="w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {loadingCheckout ? "Redirecionando..." : "Finalizar Compra"}
              </button>

              <button
                onClick={clearCart}
                className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar carrinho
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default CartSidebar;