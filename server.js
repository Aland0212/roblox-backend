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
        const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100`;
        
        // Hole die echten Daten von Roblox
        const response = await axios.get(url);
        let servers = response.data.data;

        // MAGIE: Wir überschreiben die Roblox-Daten mit UNSERER Datenbank!
        if (servers) {
            servers = servers.map(server => {
                // Wenn wir diesen Server schon kennen...
                if (serverDatabase[server.id]) {
                    server.isKnown = true;
                    server.knownRegion = serverDatabase[server.id];
                }
                return server;
            });
        }

        res.json({ data: servers });
    } catch (error) {
        console.error("Fehler:", error.message);
        res.status(500).json({ error: "Fehler beim Abrufen der Roblox API" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
