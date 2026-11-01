import { writeFile } from "node:fs/promises";

export async function getToken(
  authority: string,
  audience: string,
  clientId: string,
  clientSecret: string,
  scope: string,
): Promise<string> {
  const tokenUrl = new URL("/oauth/token", authority.endsWith("/") ? authority : `${authority}/`);
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience,
      scope,
    }),
  });
  if (!response.ok) {
    throw new Error(`Token request failed with status ${response.status}`);
  }

  const body = (await response.json()) as { access_token?: unknown };
  if (typeof body.access_token !== "string" || body.access_token.length === 0) {
    throw new Error(`Token request failed with status ${response.status}`);
  }
  return body.access_token;
}

// POST /passes
export async function issuePass(
  url: string,
  token: string,
  name: string,
  document: string,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name, document }),
  });
  if (!response.ok) {
    throw new Error(`Issuing a pass failed with status ${response.status}`);
  }

  const location = response.headers.get("location");
  if (!location) {
    throw new Error(`Issuing a pass failed with status ${response.status}: missing Location header`);
  }
  const id = new URL(location, url).pathname.split("/").filter(Boolean).at(-1);
  if (!id) {
    throw new Error(
      `Issuing a pass failed with status ${response.status}: Location has no pass identifier`,
    );
  }

  await writeFile(`${id}.png`, Buffer.from(await response.arrayBuffer()));
}
