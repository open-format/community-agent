import { describe, expect, test } from "vitest";
import communitiesRoute from ".";
import { mockCommunity, mockUser } from "../../../../../tests/utils/mockData";

describe("Communities", () => {
  test("GET /communities returns mocked data", async () => {
    const res = await communitiesRoute.request("/", {
      headers: {
        "x-user-id": mockUser.did,
        authorization: `Bearer ${process.env.API_KEY}`,
      },
    });

    expect(res.status).toBe(200);
  });

  test("GET /communities/:id returns mocked data", async () => {
    const res = await communitiesRoute.request(`/${mockCommunity.id}`, {
      headers: {
        authorization: `Bearer ${process.env.API_KEY}`,
      },
    });

    expect(res.status).toBe(200);
  });
});
