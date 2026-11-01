import dotenv from "dotenv";
import express from "express";
import jwtBearer from "express-oauth2-jwt-bearer";
import QRCode from "qrcode";
import { findPass, insertPass } from "./db.ts";

dotenv.config({ quiet: true });

function singleParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function passJson(pass: {
  id: string;
  name: string;
  document: string;
  issuedAt: Date;
  status: string;
}) {
  return {
    id: pass.id,
    name: pass.name,
    document: pass.document,
    issuedAt: pass.issuedAt.toISOString(),
    status: pass.status,
  };
}

export function mountMachineApi(app: express.Express, baseURL: string): boolean {
  const audience = process.env.AUDIENCE?.trim();
  const issuerBaseURL = process.env.ISSUER_BASE_URL?.trim().replace(/\/+$/, "");
  if (!audience || !issuerBaseURL) {
    return false;
  }

  const checkJwt = jwtBearer.auth({ audience, issuerBaseURL });

  app.get(
    "/passes/:id",
    checkJwt,
    jwtBearer.requiredScopes("read:passes"),
    async (req, res) => {
      const pass = await findPass(singleParam(req.params.id));
      if (!pass) {
        res.status(404).json({ error: "Pass not found" });
        return;
      }
      res.json(passJson(pass));
    },
  );

  app.post(
    "/passes",
    checkJwt,
    jwtBearer.requiredScopes("create:passes"),
    express.json(),
    async (req, res) => {
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const document =
        typeof req.body?.document === "string" ? req.body.document.trim() : "";
      if (!name || !document) {
        res.status(400).json({ error: "name and document must be non-empty strings" });
        return;
      }

      const pass = await insertPass(name, document);
      const png = await QRCode.toBuffer(`${baseURL}/info/${pass.id}`);
      res
        .status(201)
        .type("png")
        .set("Location", `${baseURL}/passes/${pass.id}`)
        .send(png);
    },
  );

  return true;
}

export function apiErrorHandler(
  err: unknown,
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const status = typeof err === "object" && err !== null && "status" in err ? err.status : undefined;
  if (status === 401 || status === 403) {
    res.status(status).end();
    return;
  }
  next(err);
}
