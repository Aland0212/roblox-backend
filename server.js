const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
// GANZ WICHTIG: Erlaubt dem Server, JSON-Daten vom Add-on zu empfangen!
app.use(express.json()); 

// Unsere Mini-Datenbank (Speichert die Zuordnung: Instanz-ID -> Region)
// Hinweis: Da wir noch keine echte Datenbank wie MongoDB nutzen, 
// löscht sich dieser Speicher, wenn der Render-Server neu startet. Fürs Testen reicht das aber!
const serverDatabase = {};

// 1. NEUER ENDPUNKT: Daten EMPFANGEN (POST)
app.post('/api/report', (req, res) => {
    const { instanceId, region } = req.body;
    
    if (instanceId && region) {
        // Speichere die Info in unserer Datenbank ab
        serverDatabase[instanceId] = region;
        console.log(`🔥 NEUER EINTRAG: Server ${instanceId} ist in ${region}`);
        res.json({ success: true, message: "Erfolgreich in der Datenbank gespeichert!" });
    } else {
        res.status(400).json({ error: "Fehlende Daten" });
    }
});

// 2. ALTER ENDPUNKT: Daten SENDEN (GET)
app.get('/api/servers/:placeId', async (req, res) => {
    try {
        const placeId = req.params.placeId;
        let allServers = [];
        let cursor = null;
        let pagesToScan = 5; // Er scannt die ersten 500 Server (5 Seiten à 100)

        for (let i = 0; i < pagesToScan; i++) {
            const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100${cursor ? `&cursor=${cursor}` : ''}`;
            const response = await axios.get(url);
            
            if (response.data.data) {
                allServers = allServers.concat(response.data.data);
            }

            cursor = response.data.nextPageCursor;
            if (!cursor) break; // Keine weiteren Seiten mehr da
        }

        // Ab hier wie vorher: Mit Datenbank abgleichen
        const processedServers = allServers.map(server => {
            if (serverDatabase[server.id]) {
                server.isKnown = true;
                server.knownRegion = serverDatabase[server.id];
            }
            return server;
        });

        res.json({ data: processedServers });
    } catch (error) {
        res.status(500).json({ error: "Deep Scan fehlgeschlagen" });
    }
});
