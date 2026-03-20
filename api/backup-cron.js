const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const FIREBASE_URL = process.env.FIREBASE_URL; // e.g. https://bsg-7772d-default-rtdb.firebaseio.com/cursos
const GITHUB_REPO = "fjrosselot/tesoreros-sg-backups"; // separate backup repo

module.exports = async function handler(req, res) {
  // Vercel cron jobs send GET requests with a special header
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Read all data from Firebase
    const fbRes = await fetch(FIREBASE_URL + ".json");
    if (!fbRes.ok) throw new Error("Firebase read failed: " + fbRes.status);
    const data = await fbRes.json();

    // 2. Prepare backup content
    const today = new Date().toISOString().slice(0, 10);
    const filename = `backup-${today}.json`;
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");

    // 3. Check if file already exists (to get SHA for update)
    let sha = null;
    const checkRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${filename}`,
      { headers: { Authorization: "token " + GITHUB_TOKEN, Accept: "application/vnd.github.v3+json" } }
    );
    if (checkRes.ok) {
      const existing = await checkRes.json();
      sha = existing.sha;
    }

    // 4. Commit to GitHub
    const body = {
      message: `Backup automático ${today}`,
      content,
      ...(sha ? { sha } : {})
    };
    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${filename}`,
      {
        method: "PUT",
        headers: {
          Authorization: "token " + GITHUB_TOKEN,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    if (!ghRes.ok) {
      const err = await ghRes.text();
      throw new Error("GitHub write failed: " + err);
    }

    // 5. Keep only last 30 backups
    const listRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/`,
      { headers: { Authorization: "token " + GITHUB_TOKEN, Accept: "application/vnd.github.v3+json" } }
    );
    if (listRes.ok) {
      const files = await listRes.json();
      const backups = files
        .filter(f => f.name.startsWith("backup-") && f.name.endsWith(".json"))
        .sort((a, b) => a.name.localeCompare(b.name));
      // Delete oldest if more than 30
      while (backups.length > 30) {
        const old = backups.shift();
        await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/${old.name}`,
          {
            method: "DELETE",
            headers: { Authorization: "token " + GITHUB_TOKEN, "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Limpiar backup antiguo", sha: old.sha })
          }
        );
      }
    }

    return res.status(200).json({ ok: true, backup: filename });
  } catch (e) {
    console.error("Backup error:", e.message);
    return res.status(500).json({ error: e.message });
  }
};
