const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { Resend } = require("resend");
const pool = require("../db");


const router = express.Router();

const RESET_TOKEN_DURATION_MINUTES = 30;

const GENERIC_MESSAGE =
  "Caso o e-mail esteja cadastrado, enviaremos as instruções.";

function getFrontendUrl() {
  return String(
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function getResendConfiguration() {
  return {
    apiKey: String(process.env.RESEND_API_KEY || "").trim(),
    from: String(
      process.env.RESEND_FROM ||
        "Campo Limpo RP <noreply@campolimporp.com.br>"
    ).trim(),
  };
}

function validateResendVariables() {
  const resend = getResendConfiguration();

  if (!resend.apiKey) {
    const error = new Error("Variável RESEND_API_KEY ausente.");
    error.stage = "RESEND_ENV_MISSING";
    throw error;
  }

  if (!resend.from) {
    const error = new Error("Remetente do Resend não configurado.");
    error.stage = "RESEND_FROM_MISSING";
    throw error;
  }
}

function createResendClient() {
  const resend = getResendConfiguration();
  return new Resend(resend.apiKey);
}

function logError(title, error) {
  console.error("========================================");
  console.error(title);
  console.error("DATA:", new Date().toISOString());
  console.error("STAGE:", error?.stage || "N/A");
  console.error("MENSAGEM:", error?.message);
  console.error("CÓDIGO:", error?.code);
  console.error("COMANDO:", error?.command);
  console.error("RESPOSTA:", error?.response);
  console.error("CÓDIGO DA RESPOSTA:", error?.responseCode);
  console.error("SQL:", error?.sql);
  console.error("SQL MESSAGE:", error?.sqlMessage);
  console.error("STACK:", error?.stack);
  console.error("========================================");
}

/*
 * Monta a resposta de debug de forma consistente.
 * Sempre inclui "stage" para sabermos em qual etapa o processo falhou:
 * DB_LOOKUP, RESEND_ENV_MISSING, RESEND_SEND, DB_TRANSACTION.
 */
function buildDebugPayload(error) {
  return {
    stage: error?.stage || "UNKNOWN",
    error: error?.message,
    code: error?.code,
    command: error?.command,
    response: error?.response,
    responseCode: error?.responseCode,
    sqlMessage: error?.sqlMessage,
  };
}

async function sendResetEmail(email, resetUrl) {
  validateResendVariables();

  const resendConfig = getResendConfiguration();
  const resend = createResendClient();

  console.log("========================================");
  console.log("PREPARANDO ENVIO DE RECUPERAÇÃO");
  console.log("PROVEDOR: RESEND");
  console.log("DESTINATÁRIO:", email);
  console.log("REMETENTE:", resendConfig.from);
  console.log("RESET_URL:", resetUrl);
  console.log("========================================");

  let result;

  try {
    result = await resend.emails.send({
      from: resendConfig.from,
      to: email,
      subject: "Redefinição de senha — Campo Limpo RP",

      text: [
        "Foi solicitada uma redefinição de senha para sua conta.",
        "",
        "Acesse o link abaixo para criar uma nova senha:",
        resetUrl,
        "",
        `O link é válido por ${RESET_TOKEN_DURATION_MINUTES} minutos.`,
        "",
        "Caso você não tenha solicitado a alteração, ignore este e-mail.",
      ].join("\n"),

      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
          <head>
            <meta charset="UTF-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />
            <title>Redefinição de senha</title>
          </head>

          <body
            style="
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
              font-family: Arial, sans-serif;
              color: #222222;
            "
          >
            <table
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="
                width: 100%;
                background-color: #f4f4f4;
                padding: 30px 15px;
              "
            >
              <tr>
                <td align="center">
                  <table
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="
                      width: 100%;
                      max-width: 600px;
                      background-color: #ffffff;
                      border-radius: 10px;
                      overflow: hidden;
                      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
                    "
                  >
                    <tr>
                      <td
                        style="
                          padding: 24px;
                          background-color: #111111;
                          color: #ffffff;
                          text-align: center;
                        "
                      >
                        <h1
                          style="
                            margin: 0;
                            font-size: 24px;
                            line-height: 1.3;
                          "
                        >
                          Campo Limpo RP
                        </h1>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding: 32px 28px;">
                        <h2
                          style="
                            margin: 0 0 18px;
                            font-size: 22px;
                            color: #111111;
                          "
                        >
                          Redefinição de senha
                        </h2>

                        <p
                          style="
                            margin: 0 0 16px;
                            font-size: 15px;
                            line-height: 1.6;
                          "
                        >
                          Foi solicitada uma redefinição de senha para sua
                          conta do painel administrativo.
                        </p>

                        <p
                          style="
                            margin: 0 0 24px;
                            font-size: 15px;
                            line-height: 1.6;
                          "
                        >
                          Clique no botão abaixo para cadastrar uma nova senha.
                        </p>

                        <table
                          cellpadding="0"
                          cellspacing="0"
                          border="0"
                          style="margin: 0 auto 26px;"
                        >
                          <tr>
                            <td
                              align="center"
                              style="
                                background-color: #111111;
                                border-radius: 6px;
                              "
                            >
                              <a
                                href="${resetUrl}"
                                target="_blank"
                                rel="noopener noreferrer"
                                style="
                                  display: inline-block;
                                  padding: 13px 22px;
                                  color: #ffffff;
                                  text-decoration: none;
                                  font-size: 15px;
                                  font-weight: bold;
                                "
                              >
                                Redefinir minha senha
                              </a>
                            </td>
                          </tr>
                        </table>

                        <p
                          style="
                            margin: 0 0 16px;
                            font-size: 14px;
                            line-height: 1.6;
                          "
                        >
                          Este link é válido por
                          <strong>
                            ${RESET_TOKEN_DURATION_MINUTES} minutos
                          </strong>.
                        </p>

                        <p
                          style="
                            margin: 0 0 12px;
                            font-size: 14px;
                            line-height: 1.6;
                          "
                        >
                          Caso o botão não funcione, copie e cole o endereço
                          abaixo no navegador:
                        </p>

                        <p
                          style="
                            margin: 0 0 22px;
                            padding: 12px;
                            background-color: #f2f2f2;
                            border-radius: 5px;
                            font-size: 12px;
                            line-height: 1.5;
                            word-break: break-all;
                            color: #444444;
                          "
                        >
                          ${resetUrl}
                        </p>

                        <p
                          style="
                            margin: 0;
                            font-size: 13px;
                            line-height: 1.6;
                            color: #666666;
                          "
                        >
                          Caso você não tenha solicitado a alteração,
                          ignore este e-mail. Sua senha continuará a mesma.
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td
                        style="
                          padding: 18px;
                          background-color: #eeeeee;
                          text-align: center;
                          font-size: 12px;
                          color: #666666;
                        "
                      >
                        Campo Limpo Roleplay
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });
  } catch (error) {
    error.stage = error.stage || "RESEND_SEND";
    throw error;
  }

  if (result?.error) {
    const error = new Error(
      result.error.message || "Erro ao enviar e-mail pelo Resend."
    );
    error.stage = "RESEND_SEND";
    error.code = result.error.name || result.error.statusCode;
    error.response = result.error;
    throw error;
  }

  console.log("========================================");
  console.log("E-MAIL ENVIADO COM SUCESSO PELO RESEND");
  console.log("ID:", result?.data?.id);
  console.log("========================================");

  return result?.data;
}

// Confirma se o arquivo e as variáveis foram carregados.
router.get("/debug-auth", (req, res) => {
  const resend = getResendConfiguration();

  return res.status(200).json({
    success: true,
    message: "Arquivo de autenticação carregado.",
    date: new Date().toISOString(),
    frontendUrl: getFrontendUrl(),

    resend: {
      apiKeyConfigured: Boolean(resend.apiKey),
      fromConfigured: Boolean(resend.from),
      from: resend.from,
    },
  });
});

// Teste da API do Resend.
// Use ?email=seuemail@dominio.com para enviar um e-mail real de teste.
router.get("/debug-resend", async (req, res) => {
  try {
    validateResendVariables();

    const email = String(req.query?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message:
          "Informe um e-mail na URL. Exemplo: /debug-resend?email=voce@dominio.com",
      });
    }

    const resendConfig = getResendConfiguration();
    const resend = createResendClient();

    console.log("========================================");
    console.log("INICIANDO TESTE RESEND");
    console.log("DESTINATÁRIO:", email);
    console.log("REMETENTE:", resendConfig.from);
    console.log("========================================");

    const result = await resend.emails.send({
      from: resendConfig.from,
      to: email,
      subject: "Teste de e-mail — Campo Limpo RP",
      text: "Se você recebeu este e-mail, a integração com o Resend está funcionando.",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Campo Limpo RP</h2>
          <p>Se você recebeu este e-mail, a integração com o Resend está funcionando.</p>
        </div>
      `,
    });

    if (result?.error) {
      const error = new Error(
        result.error.message || "Erro ao testar envio pelo Resend."
      );
      error.stage = "RESEND_SEND";
      error.code = result.error.name || result.error.statusCode;
      error.response = result.error;
      throw error;
    }

    console.log("Teste Resend concluído com sucesso.");
    console.log("ID:", result?.data?.id);

    return res.status(200).json({
      success: true,
      message: "E-mail de teste enviado com sucesso.",
      id: result?.data?.id,
      from: resendConfig.from,
      to: email,
    });
  } catch (error) {
    error.stage = error.stage || "RESEND_SEND";
    logError("ERRO NO TESTE DO RESEND", error);

    return res.status(500).json(buildDebugPayload(error));
  }
});

// Solicitar recuperação de senha.
router.post("/forgot-password", async (req, res) => {
  let connection;
  let transactionStarted = false;

  console.log("========================================");
  console.log("ENTROU NA ROTA FORGOT-PASSWORD");
  console.log("DATA:", new Date().toISOString());
  console.log("METHOD:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("ORIGIN:", req.headers.origin);
  console.log("CONTENT-TYPE:", req.headers["content-type"]);
  console.log("========================================");

  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Informe o e-mail.",
      });
    }

    if (email.length > 255) {
      return res.status(400).json({
        message: "O e-mail informado é inválido.",
      });
    }

    console.log("Consultando usuário pelo e-mail:", email);

    let users;
    try {
      [users] = await pool.execute(
        `
        SELECT id, email
        FROM users
        WHERE LOWER(email) = ?
        LIMIT 1
        `,
        [email]
      );
    } catch (dbError) {
      dbError.stage = "DB_LOOKUP";
      throw dbError;
    }

    console.log("Usuários encontrados:", users.length);

    // Não informa se o e-mail existe ou não.
    if (!users.length) {
      return res.status(200).json({
        message: GENERIC_MESSAGE,
      });
    }

    const user = users[0];

    const token = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_DURATION_MINUTES * 60 * 1000
    );

    try {
      connection = await pool.getConnection();

      await connection.beginTransaction();
      transactionStarted = true;

      // Invalida tokens anteriores ainda não utilizados.
      await connection.execute(
        `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = ?
          AND used_at IS NULL
        `,
        [user.id]
      );

      // Insere o novo token.
      await connection.execute(
        `
        INSERT INTO password_reset_tokens (
          user_id,
          token_hash,
          expires_at
        )
        VALUES (?, ?, ?)
        `,
        [user.id, tokenHash, expiresAt]
      );
    } catch (dbError) {
      dbError.stage = "DB_TRANSACTION_INSERT";
      throw dbError;
    }

    const resetUrl =
      `${getFrontendUrl()}/admin/redefinir-senha` +
      `?token=${encodeURIComponent(token)}`;

    console.log("URL de redefinição criada:", resetUrl);
    console.log("Iniciando envio do e-mail.");

    /*
     * Envia o e-mail antes do commit.
     * Caso o envio falhe, o token não será salvo.
     */
    await sendResetEmail(user.email, resetUrl);

    await connection.commit();
    transactionStarted = false;

    console.log("Recuperação de senha criada com sucesso.");

    return res.status(200).json({
      message: GENERIC_MESSAGE,
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
        transactionStarted = false;

        console.log("Rollback realizado com sucesso.");
      } catch (rollbackError) {
        logError(
          "ERRO AO DESFAZER SOLICITAÇÃO DE SENHA",
          rollbackError
        );
      }
    }

    logError("ERRO NO FORGOT-PASSWORD", error);

    return res.status(500).json({
      message: "Não foi possível enviar o e-mail de recuperação.",
      debug: buildDebugPayload(error),
    });
  } finally {
    if (connection) {
      connection.release();
      console.log("Conexão com o banco liberada.");
    }
  }
});

// Salvar a nova senha.
router.post("/reset-password", async (req, res) => {
  let connection;
  let transactionStarted = false;

  console.log("========================================");
  console.log("ENTROU NA ROTA RESET-PASSWORD");
  console.log("DATA:", new Date().toISOString());
  console.log("METHOD:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("========================================");

  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");

    if (!token) {
      return res.status(400).json({
        message: "Token de recuperação não informado.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "A senha deve ter pelo menos 8 caracteres.",
      });
    }

    if (password.length > 128) {
      return res.status(400).json({
        message: "A senha informada é muito longa.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    connection = await pool.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    const [tokens] = await connection.execute(
      `
      SELECT id, user_id
      FROM password_reset_tokens
      WHERE token_hash = ?
        AND used_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
      FOR UPDATE
      `,
      [tokenHash]
    );

    if (!tokens.length) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: "O link de recuperação é inválido ou expirou.",
      });
    }

    const resetToken = tokens[0];

    const passwordHash = await bcrypt.hash(password, 12);

    const [updateResult] = await connection.execute(
      `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
      `,
      [passwordHash, resetToken.user_id]
    );

    if (!updateResult.affectedRows) {
      throw new Error(
        "Usuário da recuperação não foi encontrado."
      );
    }

    // Marca o token atual como utilizado.
    await connection.execute(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE id = ?
      `,
      [resetToken.id]
    );

    // Invalida qualquer outro token ativo do usuário.
    await connection.execute(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = ?
        AND used_at IS NULL
      `,
      [resetToken.user_id]
    );

    await connection.commit();
    transactionStarted = false;

    console.log("Senha redefinida com sucesso.");

    return res.status(200).json({
      message: "Senha redefinida com sucesso.",
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
        transactionStarted = false;
      } catch (rollbackError) {
        logError(
          "ERRO AO DESFAZER ALTERAÇÃO DE SENHA",
          rollbackError
        );
      }
    }

    logError("ERRO NO RESET-PASSWORD", error);

    return res.status(500).json({
      message: "Não foi possível redefinir a senha.",
      debug: buildDebugPayload(error),
    });
  } finally {
    if (connection) {
      connection.release();
      console.log("Conexão com o banco liberada.");
    }
  }
});

module.exports = router;