import { useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const API_URL = String(
  import.meta.env.VITE_API_URL || "https://api.campolimporp.com.br"
)
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!token) {
      toast({
        title: "Link inválido",
        description: "O token de recuperação não foi informado.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Senha inválida",
        description: "A senha deve ter pelo menos 8 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas diferentes",
        description: "As senhas informadas não são iguais.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = `${API_URL}/api/auth/reset-password`;

      console.log("Endpoint de redefinição:", endpoint);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const responseText = await response.text();

      console.log("Resposta da redefinição:", {
        endpoint,
        responseUrl: response.url,
        status: response.status,
        contentType: response.headers.get("content-type"),
        responseText,
      });

      let data: {
        message?: string;
      } = {};

      try {
        data = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        throw new Error(
          `A API retornou uma resposta inválida. Código: ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Não foi possível redefinir a senha."
        );
      }

      toast({
        title: "Senha alterada",
        description:
          data.message || "Sua senha foi redefinida com sucesso.",
      });

      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        navigate("/admin/login", {
          replace: true,
        });
      }, 1200);
    } catch (error) {
      console.error("Erro ao redefinir senha:", error);

      toast({
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível redefinir a senha.",
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
          Redefinir senha
        </h1>

        <p className="mb-6 text-center text-sm text-muted-foreground">
          Digite e confirme sua nova senha.
        </p>

        {!token && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            Este link de recuperação é inválido ou está incompleto.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm text-muted-foreground"
            >
              Nova senha
            </label>

            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || !token}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              required
              minLength={8}
              maxLength={128}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm text-muted-foreground"
            >
              Confirmar nova senha
            </label>

            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading || !token}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              required
              minLength={8}
              maxLength={128}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !token}
            className="w-full rounded-md bg-primary py-2.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Alterando..." : "Redefinir senha"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;