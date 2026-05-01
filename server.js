const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

app.get('/api/servers/:placeId', async (req, res) => {
    try {
        const placeId = req.params.placeId;
        const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100`;
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error("Fehler:", error.message);
        res.status(500).json({ error: "Fehler beim Abrufen der Roblox API" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
