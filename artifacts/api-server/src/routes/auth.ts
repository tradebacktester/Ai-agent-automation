import { Router } from "express";

const router = Router();

router.post("/login", (req, res) => {
  const { id, password } = req.body as { id?: string; password?: string };

  const adminId = process.env.ADMIN_ID ?? "admin";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Viralos@2024!";

  if (!id || !password) {
    res.status(400).json({ error: "id and password are required" });
    return;
  }

  if (id === adminId && password === adminPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

export default router;
