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

const ServerSchema = new mongoose.Schema({
    instanceId: { type: String, unique: true, required: true },
    region: String,
    createdAt: { type: Date, default: Date.now }
});

const VerifiedServer = mongoose.model('VerifiedServer', ServerSchema);

// --- API ROUTEN ---

// 1. Server permanent speichern
app.post('/api/report', async (req, res) => {
    const { instanceId, region } = req.body;
    try {
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

// 2. Falsche Daten löschen (NEU)
app.delete('/api/remove/:instanceId', async (req, res) => {
    try {
        await VerifiedServer.deleteOne({ instanceId: req.params.instanceId });
        res.json({ success: true, message: "Gelöscht" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Server abrufen & Deep Scan
app.get('/api/servers/:placeId', async (req, res) => {
    try {
        const placeId = req.params.placeId;
        let allServers = [];
        let cursor = null;
        
        for (let i = 0; i < 3; i++) {
            const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100${cursor ? `&cursor=${cursor}` : ''}`;
            const response = await axios.get(url);
            if (response.data.data) allServers = allServers.concat(response.data.data);
            cursor = response.data.nextPageCursor;
            if (!cursor) break;
        }

        const foundIds = allServers.map(s => s.id);
        const knownServers = await VerifiedServer.find({ instanceId: { $in: foundIds } });
        const knownMap = {};
        knownServers.forEach(s => { knownMap[s.instanceId] = s.region; });

        const processedServers = allServers.map(server => {
            const isKnown = !!knownMap[server.id];
            let regionLabel = "Unbekannt";
            let estimatedRegion = "unknown";
            
            if (server.ping <= 80) { estimatedRegion = "eu"; regionLabel = "🇪🇺 Frankfurt/EU"; }
            else if (server.ping <= 130) { estimatedRegion = "us-east"; regionLabel = "🇺🇸 US Ost"; }

            return { ...server, isKnown, estimatedRegion, regionLabel };
        });

        processedServers.sort((a, b) => {
            if (a.isKnown && !b.isKnown) return -1;
            if (!a.isKnown && b.isKnown) return 1;
            return a.ping - b.ping;
        });

        res.json({ data: processedServers.slice(0, 15) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
