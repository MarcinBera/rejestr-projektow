function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function requireSales(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  if (req.session.user.role !== "sales") {
    req.session.err = "Brak uprawnień: tylko handlowiec ma dostęp do tej funkcji.";
    return res.redirect("/projects");
  }
  next();
}

module.exports = { requireAuth, requireSales };
