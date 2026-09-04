const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/analyze', (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: "Lien manquant" });

    const command = `yt-dlp -j --no-playlist "${videoUrl}"`;

    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => {
        if (error) {
            return res.status(500).json({ error: "Impossible d'analyser ce lien." });
        }

        try {
            const data = JSON.parse(stdout);
            
            const width = data.width || 0;
            const height = data.height || 0;
            const fps = data.fps || 0;
            const views = data.view_count || 0;
            const likes = data.like_count || 0;
            const comments = data.comment_count || 0;

            let qualityScore = "Moyenne";
            if (height >= 1080 && fps >= 30) qualityScore = "Excellente (HD/60FPS)";
            else if (height >= 720) qualityScore = "Bonne (720p)";
            else qualityScore = "Faible / Compressée";

            const engagementRate = views > 0 ? (((likes + comments) / views) * 100).toFixed(2) : 0;

            res.json({
                title: data.title || data.id,
                uploader: data.uploader || "Inconnu",
                views: views,
                likes: likes,
                comments: comments,
                resolution: `${width}x${height}`,
                fps: fps,
                qualityScore: qualityScore,
                engagementRate: `${engagementRate}%`
            });
        } catch (e) {
            res.status(500).json({ error: "Erreur de traitement des données." });
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
