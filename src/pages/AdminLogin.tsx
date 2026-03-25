import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const AdminLogin = () => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Carrega o login salvo se existir (mesma chave usada no AuthContext)
  useEffect(() => {
    const savedLogin = localStorage.getItem("rememberLogin");
    if (savedLogin) {
      setLogin(savedLogin);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Passamos o login, a senha e o estado do rememberMe para o context
      const { error } = await signIn(login, password, rememberMe);

      if (error) {
        console.error("Erro detalhado login:", error);
        toast({
          title: "Erro de Autenticação",
          description: error.message || "Login ou senha incorretos",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Login realizado com sucesso!",
        });
        navigate("/admin");
      }
    } catch (err) {
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao tentar entrar.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm card-gradient rounded-lg border border-border p-8">
        <h1 className="mb-6 text-center font-display text-3xl text-foreground">Painel Admin</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Usuário (Login)</label>
            <input
              type="text"
              placeholder="Digite seu usuário"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Senha</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border border-border accent-primary"
            />
            <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer">
              Lembrar meu usuário
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-primary py-2.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Autenticando..." : "Entrar no Painel"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;