import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const API_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast({
        title: "E-mail obrigatório",
        description: "Informe o e-mail cadastrado no painel.",
        variant: "destructive",
      });
      return;
    }

    if (!API_URL) {
      toast({
        title: "Erro de configuração",
        description: "A URL da API não está configurada.",
        variant: "destructive",
      });

      console.error("VITE_API_URL não está configurada.");
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = `${API_URL}/api/auth/forgot-password`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      let data: { message?: string } = {};

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const responseText = await response.text();

        console.error("A API retornou uma resposta que não é JSON:", {
          endpoint,
          status: response.status,
          contentType,
          responseText,
        });

        throw new Error(
          `A API retornou uma resposta inválida. Código: ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Não foi possível solicitar a recuperação."
        );
      }

      toast({
        title: "Solicitação enviada",
        description:
          data.message ||
          "Caso o e-mail esteja cadastrado, você receberá as instruções.",
      });

      setEmail("");
    } catch (error) {
      console.error("Erro ao solicitar recuperação de senha:", error);

      toast({
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível solicitar a recuperação.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border p-8 card-gradient">
        <h1 className="mb-2 text-center font-display text-3xl text-foreground">
          Recuperar senha
        </h1>

        <p className="mb-6 text-center text-sm text-muted-foreground">
          Informe o e-mail cadastrado no painel.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm text-muted-foreground"
            >
              E-mail
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-primary py-2.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Enviando..." : "Enviar link de recuperação"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link
            to="/admin/login"
            className="text-sm text-primary hover:underline"
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;