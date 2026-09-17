async function discordFetch(url, options = {}) {
  return fetch(`https://discord.com/api/v10${url}`, {
    ...options,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      ...(options.headers || {}),
    },
  });
}

async function financialApi(path, options = {}) {
  const baseUrl =
    process.env.FINANCIAL_API_URL || "https://api.campolimporp.com.br";

  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": process.env.INTERNAL_WEBHOOK_SECRET,
      ...(options.headers || {}),
    },
  });
}

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function buildFinancialPanel(summary, monthly) {
  const balance = Number(summary.balance || 0);
  const monthlyResult = Number(monthly.result || 0);

  return {
    embeds: [
      {
        title: "💰 Controle Financeiro",
        description:
          "**Campo Limpo Roleplay**\n" +
          "Acompanhamento financeiro da loja em tempo real.",

        color: balance >= 0 ? 5763719 : 15548997,

        fields: [
          {
            name: "💵 Saldo Atual",
            value: `**${formatBRL(balance)}**`,
            inline: false,
          },
          {
            name: "📈 Receita Total",
            value: formatBRL(summary.revenue),
            inline: true,
          },
          {
            name: "📉 Despesas",
            value: formatBRL(summary.expenses),
            inline: true,
          },
          {
            name: "🛒 Vendas Aprovadas",
            value: `${summary.salesCount || 0}`,
            inline: true,
          },
          {
            name: "📅 Entradas no Mês",
            value: formatBRL(monthly.revenue),
            inline: true,
          },
          {
            name: "📤 Saídas no Mês",
            value: formatBRL(monthly.expenses),
            inline: true,
          },
          {
            name: "📊 Resultado do Mês",
            value:
              `${monthlyResult >= 0 ? "+" : ""}` +
              formatBRL(monthlyResult),
            inline: true,
          },
          {
            name: "🧾 Vendas neste Mês",
            value: `${monthly.salesCount || 0}`,
            inline: true,
          },
          {
            name: "💸 Gastos Registrados",
            value: `${summary.expensesCount || 0}`,
            inline: true,
          },
        ],

        footer: {
          text: "Campo Limpo Roleplay • Controle Financeiro",
        },

        timestamp: new Date().toISOString(),
      },
    ],

    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 4,
            custom_id: "finance_expense",
            label: "Registrar Gasto",
            emoji: { name: "➖" },
          },
          {
            type: 2,
            style: 2,
            custom_id: "finance_history",
            label: "Histórico",
            emoji: { name: "📋" },
          },
          {
            type: 2,
            style: 2,
            custom_id: "finance_report",
            label: "Relatório",
            emoji: { name: "📊" },
          },
          {
            type: 2,
            style: 1,
            custom_id: "finance_refresh",
            label: "Atualizar",
            emoji: { name: "🔄" },
          },
        ],
      },
    ],
  };
}

export default async function handler(req, res) {
  try {
    /*
    |--------------------------------------------------------------------------
    | Segurança
    |--------------------------------------------------------------------------
    */

    const secret = req.headers["x-webhook-secret"];

    if (
      !process.env.INTERNAL_WEBHOOK_SECRET ||
      secret !== process.env.INTERNAL_WEBHOOK_SECRET
    ) {
      return res.status(401).json({
        success: false,
        message: "Não autorizado.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Somente POST
    |--------------------------------------------------------------------------
    */

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Método não permitido.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Canal financeiro
    |--------------------------------------------------------------------------
    */

    const channelId = process.env.DISCORD_FINANCE_CHANNEL_ID;

    if (!channelId) {
      return res.status(500).json({
        success: false,
        message: "DISCORD_FINANCE_CHANNEL_ID não configurado.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Buscar financeiro no Render
    |--------------------------------------------------------------------------
    */

    const financialResponse = await financialApi(
      "/api/financial/summary"
    );

    const financialData = await financialResponse.json();

    if (!financialResponse.ok || !financialData.success) {
      console.error(
        "Erro ao consultar API financeira:",
        financialData
      );

      return res.status(500).json({
        success: false,
        message: "Erro ao consultar financeiro.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Criar painel
    |--------------------------------------------------------------------------
    */

    const panel = buildFinancialPanel(
      financialData.summary,
      financialData.monthly
    );

    const discordResponse = await discordFetch(
      `/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(panel),
      }
    );

    const discordData = await discordResponse.json();

    if (!discordResponse.ok) {
      console.error(
        "Erro Discord ao criar painel:",
        discordData
      );

      return res.status(500).json({
        success: false,
        message: "Discord recusou a criação do painel.",
        discordError: discordData,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Sucesso
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,
      message: "Painel financeiro criado com sucesso.",
      channelId,
      messageId: discordData.id,
    });
  } catch (error) {
    console.error("ERRO FINANCIAL PANEL:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Erro interno.",
    });
  }
}