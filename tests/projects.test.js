process.env.NODE_ENV = "test";
process.env.DB_FILE = ":memory:";
process.env.SESSION_SECRET = "test-secret";

const request = require("supertest");
const app = require("../server");

async function registerAndLoginSales() {
  await request(app).post("/register").type("form").send({
    firstName: "Sales",
    lastName: "User",
    email: "sales@example.com",
    role: "sales",
    salesNumber: "S01",
    password: "abcdef"
  });

  const agent = request.agent(app);
  await agent.post("/login").type("form").send({ email: "sales@example.com", password: "abcdef" });
  return agent;
}

describe("Projects", () => {
  test("sales can create project and see it", async () => {
    const agent = await registerAndLoginSales();

    // create project
    const r1 = await agent.post("/projects/new").type("form").send({
      clientName: "Klient A",
      branchCity: "Warszawa",
      voivodeship: "Mazowieckie",
      endCustomer: "Klient docelowy A",
      product: "REGAŁY",
      details: "Szczegóły...",
      calculatorPerson: "",
      turnover: "1000.50",
      offerMonth: "2026-01",
      status: "1"
    });
    expect(r1.status).toBe(302);
    expect(r1.headers.location).toBe("/projects");

    // list contains project
    const r2 = await agent.get("/projects");
    expect(r2.status).toBe(200);
    expect(r2.text).toContain("Klient A");
    expect(r2.text).toContain("REGAŁY");
  });

  test("designer cannot create project", async () => {
    await request(app).post("/register").type("form").send({
      firstName: "Des",
      lastName: "Ign",
      email: "designer@example.com",
      role: "designer",
      salesNumber: "",
      password: "abcdef"
    });

    const agent = request.agent(app);
    await agent.post("/login").type("form").send({ email: "designer@example.com", password: "abcdef" });

    const r = await agent.get("/projects/new");
    // middleware przekieruje na /projects (brak uprawnień)
    expect(r.status).toBe(302);
  });
});
