const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// --- DATENBANK VERBINDUNG ---
const mongoURI = "mongodb+srv://alendmohamed68_db_user:calais12was@cluster0.fzdnsgb.mongodb.net/roblox_data?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Erfolgreich mit MongoDB verbunden!"))
    .catch(err => console.error("❌ MongoDB Verbindungsfehler:", err));

// Schema erstellen: Was wollen wir speichern?
const ServerSchema = new mongoose.Schema({
    instanceId: { type: String, unique: true, required: true },
    region: String,
    createdAt: { type: Date, default: Date.now }
});

const VerifiedServer = mongoose.model('VerifiedServer', ServerSchema);

// --- API ROUTEN ---

// 1. Server melden & permanent speichern
app.post('/api/report', async (req, res) => {
    const { instanceId, region } = req.body;
    try {
        // "upsert" bedeutet: Wenn vorhanden aktualisieren, sonst neu erstellen
        await VerifiedServer.findOneAndUpdate(
            { instanceId },
            { region, createdAt: new Date() },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Server abrufen & mit Datenbank abgleichen
app.get('/api/servers/:placeId', async (req, res) => {
    try {
        const placeId = req.params.placeId;
        let allServers = [];
        let cursor = null;
        
        // Deep Scan: Wir holen die ersten 3 Seiten (300 Server)
        for (let i = 0; i < 3; i++) {
            const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100${cursor ? `&cursor=${cursor}` : ''}`;
            const response = await axios.get(url);
            if (response.data.data) allServers = allServers.concat(response.data.data);
            cursor = response.data.nextPageCursor;
            if (!cursor) break;
        }

        // Alle IDs der gefundenen Server extrahieren
        const foundIds = allServers.map(s => s.id);

        // In der MongoDB schauen, welche dieser IDs wir bereits kennen
        const knownServers = await VerifiedServer.find({ instanceId: { $in: foundIds } });
        
        // Map erstellen für schnellen Zugriff
        const knownMap = {};
        knownServers.forEach(s => { knownMap[s.instanceId] = s.region; });

        // Daten zusammenführen
        const processedServers = allServers.map(server => {
            const isKnown = !!knownMap[server.id];
            
            // Region-Schätzung (wie bisher)
            let estimatedRegion = "unknown";
            let regionLabel = "Unbekannt";
            if (server.ping <= 80) { estimatedRegion = "eu"; regionLabel = "🇪🇺 Frankfurt/EU"; }
            else if (server.ping <= 130) { estimatedRegion = "us-east"; regionLabel = "🇺🇸 US Ost"; }

            return { 
                ...server, 
                isKnown, 
                estimatedRegion, 
                regionLabel 
            };
        });

        // Sortierung: Verifizierte nach oben, dann nach Ping
        processedServers.sort((a, b) => {
            if (a.isKnown && !b.isKnown) return -1;
            if (!a.isKnown && b.isKnown) return 1;
            return a.ping - b.ping;
        });

        res.json({ data: processedServers.slice(0, 15) }); // Top 15 zurückgeben
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
