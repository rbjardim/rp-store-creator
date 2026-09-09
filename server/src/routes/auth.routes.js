const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");
const pool = require("../db");

const router = express.Router();

const RESET_TOKEN_DURATION_MINUTES = 30;

const GENERIC_RESET_MESSAGE =
  "Caso o e-mail esteja cadastrado, enviaremos as instruções.";

function getFrontendUrl() {
  return String(
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/$/, "");
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

function createResendClient() {
  const config = getResendConfiguration();

  if (!config.apiKey) {
    throw new Error("RESEND_API_KEY não está configurada.");
  }

  return new Resend(config.apiKey);
}

async function sendPasswordResetEmail({ email, login, resetUrl }) {
  const config = getResendConfiguration();
  const resend = createResendClient();

  console.log("PREPARANDO ENVIO DE RECUPERAÇÃO");
  console.log("PROVEDOR: RESEND");
  console.log("DESTINATÁRIO:", email);
  console.log("REMETENTE:", config.from);

  const result = await resend.emails.send({
    from: config.from,
    to: email,
    subject: "Recuperação de senha — Campo Limpo RP",
    text: [
      `Olá, ${login}.`,
      "",
      "Recebemos uma solicitação para redefinir sua senha do painel administrativo.",
      "",
      "Acesse o endereço abaixo para criar uma nova senha:",
      resetUrl,
      "",
      `Este link expira em ${RESET_TOKEN_DURATION_MINUTES} minutos.`,
      "",
      "Caso você não tenha solicitado a redefinição, ignore este e-mail.",
    ].join("\n"),
    html: `
      <div
        style="
          background-color: #f3f4f6;
          padding: 32px 16px;
          font-family: Arial, Helvetica, sans-serif;
          color: #111827;
        "
      >
        <div
          style="
            max-width: 560px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            padding: 32px;
            border: 1px solid #e5e7eb;
          "
        >
          <h1
            style="
              margin: 0 0 20px;
              font-size: 24px;
              text-align: center;
            "
          >
            Recuperação de senha
          </h1>

          <p>Olá, <strong>${login}</strong>.</p>

          <p>
            Recebemos uma solicitação para redefinir a senha da sua conta
            no painel administrativo.
          </p>

          <p style="text-align: center; margin: 32px 0;">
            <a
              href="${resetUrl}"
              style="
                display: inline-block;
                padding: 13px 22px;
                border-radius: 7px;
                background-color: #111827;
                color: #ffffff;
                text-decoration: none;
                font-weight: bold;
              "
            >
              Redefinir minha senha
            </a>
          </p>

          <p>
            Este link é válido por
            <strong>${RESET_TOKEN_DURATION_MINUTES} minutos</strong>.
          </p>

          <p style="font-size: 13px; color: #6b7280;">
            Caso você não tenha solicitado essa alteração, ignore este
            e-mail. Sua senha atual continuará funcionando.
          </p>

          <hr
            style="
              border: 0;
              border-top: 1px solid #e5e7eb;
              margin: 24px 0;
            "
          />

          <p style="font-size: 12px; color: #9ca3af;">
            Campo Limpo RP
          </p>
        </div>
      </div>
    `,
  });

  if (result?.error) {
    const error = new Error(
      result.error.message || "Erro ao enviar e-mail pelo Resend."
    );
    error.code = result.error.name || result.error.statusCode;
    error.response = result.error;
    throw error;
  }

  console.log("E-MAIL ENVIADO COM SUCESSO PELO RESEND");
  console.log("ID:", result?.data?.id);

  return result?.data;
}

/**
 * LOGIN
 */
router.post("/login", async (req, res) => {
  try {
    const login = String(req.body?.login || "").trim();
    const password = String(req.body?.password || "");

    if (!login || !password) {
      return res.status(400).json({
        message: "Login e senha são obrigatórios.",
      });
    }

    const [rows] = await pool.execute(
      `
      SELECT
        id,
        login,
        email,
        password_hash,
        role,
        active
      FROM users
      WHERE login = ?
      LIMIT 1
      `,
      [login]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({
        message: "Usuário ou senha inválidos.",
      });
    }

    if (!user.active) {
      return res.status(403).json({
        message: "Usuário inativo.",
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        message: "Usuário ou senha inválidos.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET não está configurado.");
    }

    const token = jwt.sign(
      {
        id: user.id,
        login: user.login,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "12h",
      }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Erro real no login:", error);

    return res.status(500).json({
      message: "Erro interno no login.",
    });
  }
});

/**
 * USUÁRIO ATUAL
 */
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Token não informado.",
      });
    }

    const token = authHeader.substring(7);

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET não está configurado.");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.execute(
      `
      SELECT
        id,
        login,
        email,
        role,
        active
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [decoded.id]
    );

    const user = rows[0];

    if (!user || !user.active) {
      return res.status(401).json({
        message: "Usuário não encontrado ou inativo.",
      });
    }

    return res.json({
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(401).json({
      message: "Token inválido ou expirado.",
    });
  }
});

/**
 * SOLICITAR RECUPERAÇÃO
 */
router.post("/forgot-password", async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Informe o e-mail.",
      });
    }

    const [users] = await pool.execute(
      `
      SELECT
        id,
        login,
        email,
        active
      FROM users
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [email]
    );

    const user = users[0];

    if (!user || !user.active) {
      return res.json({
        message: GENERIC_RESET_MESSAGE,
      });
    }

    const token = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_DURATION_MINUTES * 60 * 1000
    );

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    await connection.execute(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = ?
        AND used_at IS NULL
      `,
      [user.id]
    );

    await connection.execute(
      `
      INSERT INTO password_reset_tokens (
        user_id,
        token_hash,
        expires_at
      )
      VALUES (?, ?, ?)
      `,
      [
        user.id,
        tokenHash,
        expiresAt,
      ]
    );

    const resetUrl =
      `${getFrontendUrl()}/admin/redefinir-senha` +
      `?token=${encodeURIComponent(token)}`;

    await sendPasswordResetEmail({
      email: user.email,
      login: user.login,
      resetUrl,
    });

    await connection.commit();
    transactionStarted = false;

    return res.json({
      message: GENERIC_RESET_MESSAGE,
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Erro no rollback:", rollbackError);
      }
    }

    console.error("Erro no forgot-password:", error);

    return res.status(500).json({
      message: "Não foi possível enviar o e-mail de recuperação.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * REDEFINIR SENHA
 */
router.post("/reset-password", async (req, res) => {
  let connection;
  let transactionStarted = false;

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
      SELECT
        prt.id,
        prt.user_id,
        u.active
      FROM password_reset_tokens prt
      INNER JOIN users u
        ON u.id = prt.user_id
      WHERE prt.token_hash = ?
        AND prt.used_at IS NULL
        AND prt.expires_at > NOW()
      LIMIT 1
      FOR UPDATE
      `,
      [tokenHash]
    );

    const resetToken = tokens[0];

    if (!resetToken) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: "O link de recuperação é inválido ou expirou.",
      });
    }

    if (!resetToken.active) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(403).json({
        message: "Este usuário está inativo.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [updateUserResult] = await connection.execute(
      `
      UPDATE users
      SET
        password_hash = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        passwordHash,
        resetToken.user_id,
      ]
    );

    if (!updateUserResult.affectedRows) {
      throw new Error("Usuário não encontrado.");
    }

    await connection.execute(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE id = ?
      `,
      [resetToken.id]
    );

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

    return res.json({
      message: "Senha redefinida com sucesso.",
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Erro no rollback:", rollbackError);
      }
    }

    console.error("Erro no reset-password:", error);

    return res.status(500).json({
      message: "Não foi possível redefinir a senha.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;