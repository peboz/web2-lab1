import dotenv from "dotenv";
import type { ConfigParams } from "express-openid-connect";

dotenv.config({ quiet: true });

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

const oidcEnvNames = ["CLIENT_ID", "CLIENT_SECRET", "COOKIE_SECRET", "ISSUER_BASE_URL"] as const;

export function missingOidcEnv(): string[] {
  return oidcEnvNames.filter((name) => !envValue(name));
}

export function oidcConfig(baseURL: string): ConfigParams | undefined {
  const [clientID, clientSecret, cookieSecret, issuerBaseURL] = oidcEnvNames.map(envValue);
  if (!clientID || !clientSecret || !cookieSecret || !issuerBaseURL) {
    return undefined;
  }

  return {
    authRequired: false,
    idpLogout: true,
    secret: cookieSecret,
    baseURL: stripSlash(baseURL),
    clientID,
    clientSecret,
    issuerBaseURL: stripSlash(issuerBaseURL),
    authorizationParams: {
      response_type: "code",
      scope: "openid profile email",
    },
    routes: {
      logout: false,
      postLogoutRedirect: "/",
    },
  };
}
