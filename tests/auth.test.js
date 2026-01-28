process.env.NODE_ENV = "test";
process.env.DB_FILE = ":memory:";
process.env.SESSION_SECRET = "test-secret";

const request = require("supertest");
const app = require("../server");

describe("Auth", () => {
  test("register -> login", async () => {
    // register salesperson
    const r1 = await request(app)
      .post("/register")
      .type("form")
      .send({
        firstName: "Jan",
        lastName: "Kowalski",
        email: "jan@example.com",
        role: "sales",
        salesNumber: "H001",
        password: "abcdef"
      });
    expect(r1.status).toBe(302);

    // login
    const r2 = await request(app)
      .post("/login")
      .type("form")
      .send({ email: "jan@example.com", password: "abcdef" });

    expect(r2.status).toBe(302);
    expect(r2.headers.location).toBe("/projects");
  });
});
