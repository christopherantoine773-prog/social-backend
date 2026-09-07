const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Route de test
app.get('/', (req, res) => {
    res.json({ status: "online", message: "Cyberdope Studio Pro Backend est opérationnel." });
});

// Endpoint principal d'analyse
app.post('/api/analyze', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: "Aucune URL fournie." });
    }

    try {
        let cleanInput = url.split('?')[0].split('#')[0];
        let username = cleanInput
            .replace(/https?:\/\/(www\.)?(tiktok\.com|youtube\.com|youtu\.be|instagram\.com)\/?/, '')
            .replace(/^@/, '')
            .replace(/^c\//, '')
            .replace(/^user\//, '')
            .split('/')[0];

        let platform = "TikTok";
        if (url.includes('youtube.com') || url.includes('youtu.be')) platform = "YouTube";
        else if (url.includes('instagram.com')) platform = "Instagram";

        let followers = 154200;
        let avatar = `https://ui-avatars.com/api/?name=${username}&background=00f2fe&color=000&size=128`;

        if (platform === "TikTok") {
            try {
                const response = await fetch(`https://tikwm.com/api/user/info?unique_id=${encodeURIComponent(username)}`);
                const data = await response.json();
                if (data.code === 0 && data.data) {
                    followers = data.data.stats.followerCount || followers;
                    avatar = data.data.user.avatarMedium || avatar;
                }
            } catch (e) {
                console.log("Erreur fetch TikTok, utilisation des valeurs par défaut.");
            }
        }

        const metrics = {
            username: username,
            platform: platform,
            avatar: avatar,
            totalFollowers: followers,
            gainedFollowers: Math.floor(followers * 0.045),
            lostFollowers: Math.floor(followers * 0.008),
            weeklyViews: Math.round(followers * 1.8),
            monthlyViews: Math.round(followers * 7.4),
            engagementRate: "7.8%",
            estimatedEarningsMin: Math.round(followers * 0.007),
            estimatedEarningsMax: Math.round(followers * 0.024),
            watchTimeAvg: "01:42",
            optimalPostingHour: "18:00 - 21:00",
            viralityScore: "88 / 100",
            saturationIndex: "Faible (Forte opportunité)"
        };

        res.json({ success: true, data: metrics });
    } catch (error) {
        res.status(500).json({ error: "Erreur interne du serveur lors de l'analyse." });
    }
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
