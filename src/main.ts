import express from "express";
import oidc from "express-openid-connect";

const { auth, requiresAuth } = oidc;
import path from "node:path";
import { fileURLToPath } from "node:url";
import { missingOidcEnv, oidcConfig } from "./auth.ts";
import { apiErrorHandler, mountMachineApi } from "./machine.ts";
import {
  cancelPass,
  countActivePasses,
  countPasses,
  deletePass,
  findPass,
  listPasses,
} from "./db.ts";

const app = express();

function singleParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const dirname = path.dirname(fileURLToPath(import.meta.url));
app.set("views", path.join(dirname, "views"));
app.set("view engine", "pug");

const externalUrl = process.env.RENDER_EXTERNAL_URL?.replace(/\/+$/, "");
const port = externalUrl && process.env.PORT ? Number(process.env.PORT) : 4080;
const hostname = externalUrl ? "0.0.0.0" : "127.0.0.1";
const baseURL = externalUrl || `http://localhost:${port}`;
if (externalUrl) {
  app.set("trust proxy", 1);
}
const config = oidcConfig(baseURL);

if (config) {
  app.use(auth(config));
  app.post("/logout", async (req, res) => {
    await res.oidc.logout();
  });

  app.get("/manage", requiresAuth(), async (_req, res) => {
    const passes = await listPasses();
    res.render("manage", {
      title: "Propusnice",
      passes: passes.map((pass) => ({
        ...pass,
        issuedAt: pass.issuedAt.toISOString(),
      })),
    });
  });

  app.post("/manage/:id/cancel", requiresAuth(), async (req, res) => {
    const updated = await cancelPass(singleParam(req.params.id));
    if (!updated) {
      res.status(404).render("not-found", { title: "Propusnica nije pronađena" });
      return;
    }
    res.redirect("/manage");
  });

  app.post("/manage/:id/delete", requiresAuth(), async (req, res) => {
    const deleted = await deletePass(singleParam(req.params.id));
    if (!deleted) {
      res.status(404).render("not-found", { title: "Propusnica nije pronađena" });
      return;
    }
    res.redirect("/manage");
  });
}

app.get("/", async (req, res) => {
  const [total, active] = await Promise.all([
    countPasses(),
    countActivePasses(),
  ]);
  const username =
    config && req.oidc.isAuthenticated()
      ? (req.oidc.user?.name ?? req.oidc.user?.email ?? req.oidc.user?.sub)
      : undefined;
  res.render("index", {
    title: "Digitalne propusnice",
    total,
    active,
    username,
    authConfigured: Boolean(config),
  });
});


app.get("/info/:id", async (req, res) => {
  const pass = await findPass(req.params.id);
  if (!pass) {
    res.status(404).render("not-found", { title: "Propusnica nije pronađena" });
    return;
  }
  res.render("pass", {
    title: "Propusnica",
    pass,
    issuedAt: pass.issuedAt.toISOString(),
  });
});

const machineApi = mountMachineApi(app, baseURL);
app.use(apiErrorHandler);

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
  console.log(`OpenID Connect base URL: ${baseURL}`);
  if (!config) {
    console.log(`Auth0 login is off. Missing: ${missingOidcEnv().join(", ")}.`);
  }
  if (!machineApi) {
    console.log("Machine API is off. Set AUDIENCE to the Auth0 API identifier.");
  }
});