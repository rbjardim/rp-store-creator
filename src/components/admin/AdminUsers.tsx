import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Trash2,
  UserPlus,
  ShieldCheck,
  Loader2,
  Mail,
  Lock,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";

type AdminUser = {
  id: string;
  login: string;
  email: string;
  role: string;
  active: number;
  created_at?: string;
};

const AdminUsers = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("token");

  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data: admins = [], isLoading, error } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => []);

      if (!res.ok) {
        throw new Error(data.message || "Erro ao carregar usuários");
      }

      return data;
    },
    enabled: !!token,
  });

  const resetForm = () => {
    setLogin("");
    setEmail("");
    setPassword("");
  };

  const createUser = useMutation({
    mutationFn: async () => {
      if (password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }

      const res = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          login,
          email,
          password,
          role: "admin",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Erro ao criar usuário");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Sucesso",
        description: `Usuário ${login} cadastrado como administrador.`,
      });
      resetForm();
      setShowForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Erro ao excluir usuário");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Acesso removido",
        description: "O usuário perdeu as permissões de admin.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
              <Users className="h-6 w-6 text-red-500" />
              Gerenciar Administradores
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Cadastre, visualize e remova administradores com acesso ao painel.
            </p>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            <UserPlus className="h-4 w-4" />
            Novo Administrador
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLoadingCreate(true);
            createUser.mutate(undefined, {
              onSettled: () => setLoadingCreate(false),
            });
          }}
          className="card-gradient rounded-lg border border-border p-6 space-y-4"
        >
          <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <UserPlus className="h-4 w-4 text-primary" />
            Cadastrar Novo Admin
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Nome de Login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full rounded-md border border-border bg-secondary pl-10 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-secondary pl-10 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-secondary pl-10 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loadingCreate}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 border border-border bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
            >
              {loadingCreate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Criar Administrador
            </button>

            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 border border-border text-foreground hover:bg-accent transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Equipe com acesso ao painel
        </h3>

        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-4 flex gap-2 items-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando lista...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-card p-4 text-sm text-destructive">
            Erro ao carregar usuários.
          </div>
        ) : (
          <div className="grid gap-3">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {admin.login || "Sem login"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {admin.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (confirm(`Remover acesso de ${admin.login}?`)) {
                      deleteUser.mutate(admin.id);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </button>
              </div>
            ))}

            {admins.length === 0 && (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Nenhum administrador cadastrado.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;