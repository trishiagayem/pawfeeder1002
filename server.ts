import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/* ================= FIREBASE INIT (FIXED + SAFE) ================= */

let db: admin.firestore.Firestore | null = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT
    );

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    console.log("Firebase initialized using ENV credentials");
  } else {
    console.log("❌ FIREBASE_SERVICE_ACCOUNT missing");
  }

  db = admin.firestore();

} catch (error) {
  console.error("Firebase initialization failed:", error);
  db = null;
}

/* ================= DISPENSE API ================= */

app.post("/api/dispense", async (req, res) => {
  console.log("🔥 DISPENSE HIT:", req.body);

  if (!db) {
    console.log("❌ DB NOT READY");
    return res.status(500).json({ error: "Firebase not initialized" });
  }

  const { location, type, coins, catLevel, dogLevel, lat, lng } = req.body;

  if (!location || !type || typeof coins !== "number") {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const logId = Math.random().toString(36).substring(7);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    console.log("➡ Writing to Firestore...");

    /* ================= 1. SAVE LOG ================= */
    await db.collection("logs").doc(logId).set({
      location,
      type,
      coins,
      grams: coins * 2,
      timestamp,
    });

    console.log("✅ Log saved");

    /* ================= 2. UPDATE STATION ================= */
    const stationRef = db.collection("stations").doc(location);
    const stationDoc = await stationRef.get();

    let updateData: any = {
      lastSeen: timestamp,
    };

    if (stationDoc.exists) {
      const current = stationDoc.data()?.hopperLevels || {
        cat: 100,
        dog: 100,
      };

      let newCat = current.cat;
      let newDog = current.dog;

      if (typeof catLevel === "number") {
        newCat = catLevel;
      } else if (type === "Cat") {
        newCat = Math.max(0, newCat - coins);
      }

      if (typeof dogLevel === "number") {
        newDog = dogLevel;
      } else if (type === "Dog") {
        newDog = Math.max(0, newDog - coins);
      }

      updateData.hopperLevels = { cat: newCat, dog: newDog };
    } else {
      updateData.name = location;
      updateData.hopperLevels = { cat: 100, dog: 100 };
    }

    if (typeof lat === "number" && typeof lng === "number") {
      updateData.lat = lat;
      updateData.lng = lng;
    }

    await stationRef.set(updateData, { merge: true });

    console.log("✅ Station updated");

    return res.status(201).json({ success: true, id: logId });

  } catch (error) {
    console.error("❌ DISPENSE ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ================= FRONTEND ================= */

if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");

  app.use(express.static(distPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/* ================= START ================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});