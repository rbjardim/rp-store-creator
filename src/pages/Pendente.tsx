import { Link } from "react-router-dom";

export default function Pendente() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <h1 className="text-3xl font-bold text-yellow-500 mb-4">
          Pagamento pendente
        </h1>

        <p className="text-muted-foreground mb-6">
          Seu pagamento ainda está aguardando confirmação. Assim que for aprovado,
          o sistema processará automaticamente.
        </p>

        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-primary-foreground font-semibold hover:opacity-90"
        >
          Voltar para a loja
        </Link>
      </div>
    </div>
  );
}