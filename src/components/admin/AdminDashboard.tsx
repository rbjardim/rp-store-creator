import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  PackageCheck,
  ReceiptText,
  Search,
  ShoppingCart,
  Tag,
  TrendingUp,
} from "lucide-react";

type DashboardOrder = {
  id: string | number;
  order_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;

  subtotal?: number | null;
  discount_amount?: number | null;
  total?: number | null;
  paid_amount?: number | null;

  coupon_code?: string | null;
  coupon_discount?: number | null;

  created_at?: string | null;
  paid_at?: string | null;
  expires_at?: string | null;
};

type AdminDashboardResponse = {
  orders?: DashboardOrder[];
  totals?: {
    orders?: number;
    paid_orders?: number;
    total_payments?: number;
    sales_today?: number;
    coupons_used?: number;
    pending_orders?: number;
  };
};

const formatMoney = (value?: number | null) => {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const getStatusLabel = (order: DashboardOrder) => {
  const status = String(order.payment_status || order.status || "").toLowerCase();

  if (["paid", "approved", "pago", "approved_payment"].includes(status)) {
    return "Pago";
  }

  if (["cancelled", "canceled", "cancelado", "rejected"].includes(status)) {
    return "Cancelado";
  }

  if (["expired", "expirado"].includes(status)) {
    return "Expirado";
  }

  return "Pendente";
};

const getStatusClass = (order: DashboardOrder) => {
  const label = getStatusLabel(order);

  if (label === "Pago") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
  }

  if (label === "Cancelado") {
    return "border-red-500/20 bg-red-500/10 text-red-400";
  }

  if (label === "Expirado") {
    return "border-zinc-500/20 bg-zinc-500/10 text-zinc-400";
  }

  return "border-amber-500/20 bg-amber-500/10 text-amber-400";
};

const isPaid = (order: DashboardOrder) => {
  return getStatusLabel(order) === "Pago";
};

const AdminDashboard = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [couponFilter, setCouponFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const ORDERS_PER_PAGE = 10;

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiFetch<AdminDashboardResponse>("/admin/dashboard"),
    refetchInterval: 30000,
  });

  const orders = data?.orders || [];

  const calculatedTotals = useMemo(() => {
    const now = new Date();
    const todayKey = now.toLocaleDateString("pt-BR");

    const paidOrders = orders.filter(isPaid);

    const totalPayments = paidOrders.reduce(
      (sum, order) =>
        sum + Number(order.paid_amount ?? order.total ?? 0),
      0
    );

    const salesToday = paidOrders
      .filter((order) => {
        const dateValue = order.paid_at || order.created_at;
        if (!dateValue) return false;

        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return false;

        return date.toLocaleDateString("pt-BR") === todayKey;
      })
      .reduce(
        (sum, order) =>
          sum + Number(order.paid_amount ?? order.total ?? 0),
        0
      );

    return {
      orders: orders.length,
      paid_orders: paidOrders.length,
      total_payments: totalPayments,
      sales_today: salesToday,
      coupons_used: orders.filter((order) => Boolean(order.coupon_code)).length,
      pending_orders: orders.filter((order) => getStatusLabel(order) === "Pendente").length,
    };
  }, [orders]);

  const totals = {
    orders: data?.totals?.orders ?? calculatedTotals.orders,
    paid_orders: data?.totals?.paid_orders ?? calculatedTotals.paid_orders,
    total_payments:
      data?.totals?.total_payments ?? calculatedTotals.total_payments,
    sales_today: data?.totals?.sales_today ?? calculatedTotals.sales_today,
    coupons_used: data?.totals?.coupons_used ?? calculatedTotals.coupons_used,
    pending_orders:
      data?.totals?.pending_orders ?? calculatedTotals.pending_orders,
  };

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const status = getStatusLabel(order).toLowerCase();

      const matchesSearch =
        !term ||
        String(order.id).toLowerCase().includes(term) ||
        String(order.order_number || "").toLowerCase().includes(term) ||
        String(order.customer_name || "").toLowerCase().includes(term) ||
        String(order.customer_email || "").toLowerCase().includes(term) ||
        String(order.coupon_code || "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "paid" && status === "pago") ||
        (statusFilter === "pending" && status === "pendente") ||
        (statusFilter === "cancelled" && status === "cancelado") ||
        (statusFilter === "expired" && status === "expirado");

      const matchesCoupon =
        couponFilter === "all" ||
        (couponFilter === "with" && Boolean(order.coupon_code)) ||
        (couponFilter === "without" && !order.coupon_code);

      return matchesSearch && matchesStatus && matchesCoupon;
    }).sort((a, b) => {
      const aNumber = Number(a.order_number ?? a.id ?? 0);
      const bNumber = Number(b.order_number ?? b.id ?? 0);

      if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
        return aNumber - bNumber;
      }

      return String(a.order_number ?? a.id).localeCompare(
        String(b.order_number ?? b.id),
        "pt-BR",
        { numeric: true }
      );
    });
  }, [orders, searchTerm, statusFilter, couponFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / ORDERS_PER_PAGE)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedOrders = useMemo(() => {
    const start = (safeCurrentPage - 1) * ORDERS_PER_PAGE;
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [filteredOrders, safeCurrentPage]);

  const firstVisibleOrder =
    filteredOrders.length === 0
      ? 0
      : (safeCurrentPage - 1) * ORDERS_PER_PAGE + 1;

  const lastVisibleOrder = Math.min(
    safeCurrentPage * ORDERS_PER_PAGE,
    filteredOrders.length
  );

  const paidOrdersWithCoupons = useMemo(() => {
    return orders
      .filter((order) => isPaid(order) && Boolean(order.coupon_code))
      .sort((a, b) => {
        const aDate = new Date(a.paid_at || a.created_at || 0).getTime();
        const bDate = new Date(b.paid_at || b.created_at || 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 10);
  }, [orders]);

  const expiringOrders = useMemo(() => {
    return orders
      .filter((order) => {
        if (!order.expires_at || isPaid(order)) return false;

        const expiration = new Date(order.expires_at).getTime();
        return !Number.isNaN(expiration) && expiration >= Date.now();
      })
      .sort(
        (a, b) =>
          new Date(a.expires_at || 0).getTime() -
          new Date(b.expires_at || 0).getTime()
      )
      .slice(0, 8);
  }, [orders]);

  const cards = [
    {
      title: "Todos os pedidos",
      value: String(totals.orders),
      description: "Total de pedidos criados",
      icon: ShoppingCart,
    },
    {
      title: "Pedidos pagos",
      value: String(totals.paid_orders),
      description: "Pagamentos aprovados",
      icon: CheckCircle2,
    },
    {
      title: "Valor total recebido",
      value: formatMoney(totals.total_payments),
      description: "Somente pedidos pagos",
      icon: DollarSign,
    },
    {
      title: "Vendas de hoje",
      value: formatMoney(totals.sales_today),
      description: "Total recebido hoje",
      icon: TrendingUp,
    },
    {
      title: "Cupons utilizados",
      value: String(totals.coupons_used),
      description: "Pedidos com cupom aplicado",
      icon: Tag,
    },
    {
      title: "Pedidos pendentes",
      value: String(totals.pending_orders),
      description: "Aguardando pagamento",
      icon: Clock3,
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
              <BadgeDollarSign className="h-6 w-6 text-red-500" />
              Dashboard Administrativo
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              Acompanhe pedidos, pagamentos, cupons e vencimentos em um só lugar.
            </p>
          </div>

          <button
            onClick={() => refetch()}
            className="rounded-xl border border-white/10 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
          >
            Atualizar dados
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {card.title}
                  </p>

                  <p className="mt-3 text-2xl font-bold text-white">
                    {card.value}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {card.description}
                  </p>
                </div>

                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                  <Icon className="h-5 w-5 text-red-400" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="mb-5">
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <Tag className="h-5 w-5 text-red-400" />
              Pagamentos com cupom
            </h3>

            <p className="mt-1 text-sm text-zinc-400">
              Últimos pedidos pagos que utilizaram cupom.
            </p>
          </div>

          <div className="space-y-3">
            {paidOrdersWithCoupons.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950 p-6 text-center text-sm text-zinc-500">
                Nenhum pagamento com cupom encontrado.
              </div>
            ) : (
              paidOrdersWithCoupons.map((order) => (
                <div
                  key={String(order.id)}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      Pedido #{order.order_number || order.id}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {order.customer_name || order.customer_email || "Cliente não informado"}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400">
                        {order.coupon_code}
                      </span>

                      <span className="text-xs text-zinc-500">
                        Desconto: {formatMoney(order.discount_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-sm font-bold text-white">
                      {formatMoney(order.paid_amount ?? order.total)}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {formatDate(order.paid_at || order.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="mb-5">
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <CalendarClock className="h-5 w-5 text-amber-400" />
              Próximos vencimentos
            </h3>

            <p className="mt-1 text-sm text-zinc-400">
              Pedidos ainda não pagos ordenados pela data de expiração.
            </p>
          </div>

          <div className="space-y-3">
            {expiringOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950 p-6 text-center text-sm text-zinc-500">
                Nenhum pedido aguardando expiração.
              </div>
            ) : (
              expiringOrders.map((order) => (
                <div
                  key={String(order.id)}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Pedido #{order.order_number || order.id}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {order.customer_name || order.customer_email || "Cliente não informado"}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-xs font-medium text-amber-400">
                      Expira em
                    </p>

                    <p className="mt-1 text-sm text-white">
                      {formatDate(order.expires_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <ReceiptText className="h-5 w-5 text-red-400" />
              Todos os pedidos
            </h3>

            <p className="mt-1 text-sm text-zinc-400">
              Lista completa com status, cupom, valores, pagamento e expiração.
            </p>
          </div>

          <div className="grid w-full gap-3 md:grid-cols-3 xl:w-auto">
            <div className="relative md:min-w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

              <input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Pedido, cliente, e-mail ou cupom"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
            >
              <option value="all">Todos os status</option>
              <option value="paid">Pagos</option>
              <option value="pending">Pendentes</option>
              <option value="cancelled">Cancelados</option>
              <option value="expired">Expirados</option>
            </select>

            <select
              value={couponFilter}
              onChange={(event) => {
                setCouponFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
            >
              <option value="all">Todos os cupons</option>
              <option value="with">Com cupom</option>
              <option value="without">Sem cupom</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-white/10 bg-zinc-950 p-8 text-center text-sm text-zinc-400">
            Carregando dashboard...
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <p className="text-sm font-medium text-red-400">
              Não foi possível carregar os dados do dashboard.
            </p>

            <button
              onClick={() => refetch()}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950 p-8 text-center">
            <PackageCheck className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
            <p className="text-sm text-zinc-400">
              Nenhum pedido encontrado.
            </p>
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full table-fixed">
              <thead className="bg-zinc-950">
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-2.5 py-3">Pedido</th>
                  <th className="px-2.5 py-3">Cliente</th>
                  <th className="px-2.5 py-3">Status</th>
                  <th className="px-2.5 py-3">Cupom</th>
                  <th className="px-2.5 py-3">Desconto</th>
                  <th className="px-2.5 py-3">Valor</th>
                  <th className="px-2.5 py-3">Pagamento</th>
                  <th className="px-2.5 py-3">Criado em</th>
                  <th className="px-2.5 py-3">Pago em</th>
                  <th className="px-2.5 py-3">Expira em</th>
                </tr>
              </thead>

              <tbody>
                {paginatedOrders.map((order) => (
                  <tr
                    key={String(order.id)}
                    className="border-b border-white/5 bg-zinc-900/40 text-xs text-zinc-300 transition last:border-b-0 hover:bg-zinc-800/60"
                  >
                    <td className="px-2.5 py-3 align-top">
                      <p className="font-semibold text-white">
                        #{order.order_number || order.id}
                      </p>
                    </td>

                    <td className="px-2.5 py-3 align-top">
                      <p className="truncate font-medium text-white">
                        {order.customer_name || "Não informado"}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {order.customer_email || "Sem e-mail"}
                      </p>
                    </td>

                    <td className="px-2.5 py-3 align-top">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                          order
                        )}`}
                      >
                        {getStatusLabel(order)}
                      </span>
                    </td>

                    <td className="px-2.5 py-3 align-top">
                      {order.coupon_code ? (
                        <span className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400">
                          {order.coupon_code}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>

                    <td className="px-2.5 py-3 align-top">
                      {formatMoney(order.discount_amount)}
                    </td>

                    <td className="px-2.5 py-3 align-top font-semibold text-white">
                      {formatMoney(order.total)}
                    </td>

                    <td className="px-2.5 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-zinc-500" />
                        <span>{order.payment_method || "—"}</span>
                      </div>
                    </td>

                    <td className="px-2.5 py-3 align-top text-zinc-400">
                      {formatDate(order.created_at)}
                    </td>

                    <td className="px-2.5 py-3 align-top text-zinc-400">
                      {formatDate(order.paid_at)}
                    </td>

                    <td className="px-2.5 py-3 align-top">
                      <span
                        className={
                          !isPaid(order) && order.expires_at
                            ? "font-medium text-amber-400"
                            : "text-zinc-400"
                        }
                      >
                        {formatDate(order.expires_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs text-zinc-500">
            Exibindo {firstVisibleOrder}–{lastVisibleOrder} de {filteredOrders.length} pedido(s) filtrado(s).
            {filteredOrders.length !== orders.length && (
              <> Total geral: {orders.length}.</>
            )}
          </div>

          {filteredOrders.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage === 1}
                className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>

              <span className="px-2 text-xs text-zinc-400">
                Página {safeCurrentPage} de {totalPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={safeCurrentPage === totalPages}
                className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          )}

          <span className="text-xs text-zinc-500">
            Atualização automática a cada 30 segundos.
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
