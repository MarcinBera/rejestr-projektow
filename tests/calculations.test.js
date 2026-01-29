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

describe("Calculations", () => {
  test("sales can create calculation and open details", async () => {
    const agent = await registerAndLoginSales();

    const r1 = await agent.post("/calculations/new").type("form").send({
      nip: "5260250274",
      companyName: "Test Sp. z o.o.",
      companyAddress: "Warszawa",
      calculationDate: "2026-01-29",
      contactPerson: "Jan Nowak",
      contactEmail: "jan@x.pl",
      branchCity: "Warszawa",
      voivodeship: "Mazowieckie",
      endCustomer: "Klient docelowy",
      isNewCustomer: "1",
      productType: "REGAŁY",
      productDetails: "Szczegóły",
      status: "1",
      turnover: "",
      offerType: ""
    });

    expect(r1.status).toBe(302);
    // przekierowanie na /calculations/:id
    expect(r1.headers.location).toMatch(/^\/calculations\/\d+$/);

    const r2 = await agent.get(r1.headers.location);
    expect(r2.status).toBe(200);
    expect(r2.text).toContain("5260250274");
    expect(r2.text).toContain("REGAŁY");
  });
});
