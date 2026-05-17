import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initializing Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// API Route for Vision-based Air Quality Analysis
app.post("/api/analyze-frame", async (req, res) => {
  try {
    const { image, location, weather } = req.body;
    if (!image) return res.status(400).json({ error: "Missing image data" });

    const prompt = `
      Analyze this image taken from a mobile camera for air quality assessment.
      Look at visibility, haze, smog, and clarity of the horizon or distant objects.
      
      Current physical location context: ${JSON.stringify(location)}
      Current weather context: ${JSON.stringify(weather)}
      
      Provide an analysis in JSON format with:
      - visibilityIndex: (0.0 to 1.0, where 1.0 is crystal clear)
      - estimatedAQI: (numerical estimate, 0-500+)
      - dominantParticulate: (e.g., "PM2.5", "PM10", "NO2")
      - confidence: (percentage)
      - description: (brief text analysis of what you see in the frame related to air quality)
      - status: (e.g., "Good", "Moderate", "Unhealthy for Sensitive Groups", "Unhealthy", "Very Unhealthy", "Hazardous")
      
      Return ONLY valid JSON.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: image,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Failed to parse analysis" };

    res.json(analysis);
  } catch (error) {
    console.error("Frame analysis error:", error);
    res.status(500).json({ error: "Internal server error during analysis" });
  }
});

// Mock endpoint for Sensor Fusion / Local Pollution
app.get("/api/local-pollution", async (req, res) => {
  const { lat, lng } = req.query;
  // In a real app, we'd fetch from WAQI or IQAir
  // For this project, we'll generate realistic random data based on GPS if we don't have a key
  res.json({
    station: "Cakrawala Monitor - Sudirman",
    ispu: Math.floor(Math.random() * 50) + 100, // Simulated ISPU
    pm25: Math.floor(Math.random() * 40) + 60,
    pm10: Math.floor(Math.random() * 30) + 40,
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
