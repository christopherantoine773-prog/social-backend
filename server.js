const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: "online", message: "Cyberdope Studio Pro Backend opérationnel." });
});

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

        if (cleanInput.includes('/@')) {
            username = cleanInput.split('/@')[1].split('/')[0];
        }

        let platform = "TikTok";
        if (url.includes('youtube.com') || url.includes('youtu.be')) platform = "YouTube";
        else if (url.includes('instagram.com')) platform = "Instagram";

        let followers = 0;
        let likes = 0;
        let avatar = `https://ui-avatars.com/api/?name=${username}&background=00f2fe&color=000&size=128`;

        if (platform === "TikTok") {
            try {
                const response = await fetch(`https://tikwm.com/api/user/info?unique_id=${encodeURIComponent(username)}`);
                const data = await response.json();
                
                if (data.code === 0 && data.data) {
                    followers = data.data.stats.followerCount || 0;
                    likes = data.data.stats.heartCount || 0;
                    avatar = data.data.user.avatarMedium || data.data.user.avatarLarger || avatar;
                }
            } catch (e) {
                console.log("Erreur API TikTok:", e);
            }
        }

        if (followers === 0 && platform === "TikTok") {
            return res.status(404).json({ error: `Impossible de récupérer les données pour @${username}. Vérifiez le pseudo.` });
        }

        const metrics = {
            username: username,
            platform: platform,
            avatar: avatar,
            totalFollowers: followers,
            gainedFollowers: Math.floor(followers * 0.035),
            lostFollowers: Math.floor(followers * 0.005),
            weeklyViews: Math.round(followers * 1.4),
            monthlyViews: Math.round(followers * 5.8),
            engagementRate: ((likes / (followers || 1)) * 100 > 5 ? "8.4%" : "5.2%"),
            estimatedEarningsMin: Math.round(followers * 0.005),
            estimatedEarningsMax: Math.round(followers * 0.02),
            watchTimeAvg: "01:50",
            viralityScore: "91 / 100",
            saturationIndex: "Faible (Forte opportunité)"
        };

        res.json({ success: true, data: metrics });
    } catch (error) {
        res.status(500).json({ error: "Erreur interne du serveur lors de la connexion à l'API." });
    }
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
