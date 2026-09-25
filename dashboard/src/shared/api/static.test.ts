import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/mocks/server";

import { ApiError, NetworkError } from "./errors";
import { fetchStaticJson } from "./static";

describe("fetchStaticJson", () => {
  it("đọc JSON tĩnh", async () => {
    server.use(http.get("http://localhost/data/a.json", () => HttpResponse.json({ ok: 1 })));
    await expect(fetchStaticJson<{ ok: number }>("http://localhost/data/a.json")).resolves.toEqual({
      ok: 1,
    });
  });

  it("404 → ApiError; mất mạng → NetworkError", async () => {
    server.use(
      http.get("http://localhost/data/missing.json", () => new HttpResponse(null, { status: 404 })),
      http.get("http://localhost/data/down.json", () => HttpResponse.error())
    );
    await expect(fetchStaticJson("http://localhost/data/missing.json")).rejects.toMatchObject({
      status: 404,
      code: "client.static_not_found",
    });
    await expect(fetchStaticJson("http://localhost/data/missing.json")).rejects.toBeInstanceOf(
      ApiError
    );
    await expect(fetchStaticJson("http://localhost/data/down.json")).rejects.toBeInstanceOf(
      NetworkError
    );
  });
});
