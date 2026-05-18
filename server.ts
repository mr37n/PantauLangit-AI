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
    const { image, location } = req.body;
    if (!image) return res.status(400).json({ error: "Missing image data" });

    let weatherData = null;
    if (location && location.lat && location.lng) {
      try {
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,uv_index`
        );
        const data = await weatherRes.json();
        if (data.current) {
          // Weather code mapping (WMO codes)
          const weatherDescriptions: Record<number, string> = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Fog", 48: "Depositing rime fog",
            51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
            61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
            71: "Slight snow fall", 73: "Moderate snow fall", 75: "Heavy snow fall",
            77: "Snow grains",
            80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
            85: "Slight snow showers", 86: "Heavy snow showers",
            95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
          };

          // Convert wind degree to direction string
          const getWindDir = (deg: number) => {
            const directions = ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"];
            return directions[Math.round(deg / 45) % 8];
          };

          weatherData = {
            temperature: `${data.current.temperature_2m}°C`,
            humidity: `${data.current.relative_humidity_2m}%`,
            windSpeed: `${data.current.wind_speed_10m} km/h`,
            windDirection: getWindDir(data.current.wind_direction_10m),
            uvIndex: data.current.uv_index,
            condition: weatherDescriptions[data.current.weather_code] || "Unknown",
            conditionCode: data.current.weather_code
          };
        }
      } catch (weatherErr) {
        console.error("Weather fetch error:", weatherErr);
      }
    }

    const prompt = `
      Anda adalah AI dari PantauLangit AI, sistem mutakhir untuk pemantauan kualitas udara.
      Tugas Anda adalah menganalisis foto yang diambil dari kamera ponsel ini untuk penilaian kualitas udara dan kondisi lingkungan.
      
      Lihat pada visibilitas, kabut asap (smog), kekaburan horizon, dan kejernihan objek jauh.
      
      Konteks lokasi fisik: ${JSON.stringify(location)}
      Konteks cuaca real-time (jika tersedia): ${weatherData ? JSON.stringify(weatherData) : "Tidak tersedia (gunakan petunjuk visual dari gambar)"}
      
      Berikan analisis dalam format JSON dengan struktur berikut:
      - visibilityIndex: (0.0 hingga 1.0, di mana 1.0 sangat jernih)
      - estimatedAQI: (estimasi angka AQI, 0-500+)
      - dominantParticulate: (misal: "PM2.5", "PM10", "NO2")
      - confidence: (persentase keyakinan keseluruhan)
      - description: (analisis teks singkat tentang apa yang Anda lihat di frame terkait kualitas udara)
      - status: (misal: "Baik", "Sedang", "Tidak Sehat", "Berbahaya")
      - weather: Objek yang berisi estimasi cuaca saat ini dari petunjuk visual dan konteks:
          - temperature: (angka estimasi suhu dalam °C)
          - windSpeed: (angka estimasi kecepatan angin dalam km/jam)
          - windDirection: (estimasi arah angin dalam Bahasa Indonesia, misal: "Utara", "Selatan")
          - humidity: (angka estimasi kelembapan dalam %)
          - condition: (Status cuaca: "Cerah", "Berawan", "Hujan", atau "Berkabut")
          - effectOnPollution: (Analisis mendalam dalam Bahasa Indonesia mengenai dampak cuaca terhadap polusi. Jelaskan bagaimana kecepatan angin (stagnasi vs dispersi), arah angin, suhu (misal: efek inversi), dan kondisi atmosfer secara spesifik memengaruhi kepekatan polusi udara setempat pada saat ini.)
      - pollutants: Array objek untuk PM2.5, PM10, dan Ozone (O3) dengan:
          - name: (misal: "PM2.5")
          - value: (estimasi angka)
          - unit: (misal: "µg/m³" atau "ppb")
          - confidence: (persentase keyakinan untuk polutan spesifik ini)
          - visualCues: (array string petunjuk visual, misal: ["Haze abu-abu", "Gedung jauh terlihat buram"])
      
      Kembalikan HANYA JSON yang valid dalam Bahasa Indonesia.
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
app.get("/api/local-pollution", async (_req, res) => {
  // In a real app, we'd fetch from WAQI or IQAir
  // For this project, we'll generate realistic random data based on GPS if we don't have a key
  res.json({
    station: "PantauLangit Monitor - Jakarta",
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
