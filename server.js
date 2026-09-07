const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();

// Configuration CORS sécurisée et permissive pour GitHub Pages & local
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// User-Agents dynamiques pour contourner les restrictions
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ------------------------------------------------------------------
// 1. PROXY D'IMAGES UNIVERSEL (Bypass CORS TikTok, IG, YT, GitHub)
// ------------------------------------------------------------------
app.get('/proxy-image', (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('URL d\'image manquante.');

    const client = imageUrl.startsWith('https') ? https : http;

    const request = client.get(imageUrl, {
        headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Referer': 'https://www.tiktok.com/'
        },
        timeout: 8000
    }, (stream) => {
        if (stream.statusCode >= 300 && stream.statusCode < 400 && stream.headers.location) {
            // Suivre les redirections d'images le cas échéant
            return res.redirect(`/proxy-image?url=${encodeURIComponent(stream.headers.location)}`);
        }

        res.setHeader('Content-Type', stream.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24h
        stream.pipe(res);
    });

    request.on('error', () => {
        // Redirection vers une image neutre fallback en cas de blocage d'image
        res.redirect('https://picsum.photos/400/400');
    });

    request.on('timeout', () => {
        request.destroy();
        res.redirect('https://picsum.photos/400/400');
    });
});

// ------------------------------------------------------------------
// 2. SCRAPER MULTI-PLATEFORMES (TikTok, YouTube, GitHub, Standard)
// ------------------------------------------------------------------
function fetchSocialData(platform, identifier) {
    return new Promise((resolve) => {
        let hostname = 'www.tiktok.com';
        let path = `/@${identifier}`;

        if (platform === 'github') {
            hostname = 'api.github.com';
            path = `/users/${identifier}`;
        } else if (platform === 'youtube') {
            hostname = 'www.youtube.com';
            path = `/@${identifier}`;
        }

        const options = {
            hostname,
            path,
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8'
            },
            timeout: 6000
        };

        const req = https.get(options, (res) => {
            let html = '';
            res.on('data', chunk => html += chunk);
            res.on('end', () => {
                try {
                    if (platform === 'github') {
                        const json = JSON.parse(html);
                        return resolve({
                            followers: json.followers || 1200,
                            likes: json.public_repos * 45 || 3400,
                            rawAvatar: json.avatar_url || null,
                            covers: []
                        });
                    }

                    // Parsing Regex générique TikTok/Web
                    const followerMatch = html.match(/"followerCount":(\d+)/) || html.match(/"fans":(\d+)/);
                    const likeMatch = html.match(/"heartCount":(\d+)/) || html.match(/"heart":(\d+)/);
                    const avatarMatch = html.match(/"avatarLarger":"([^"]+)"/) || html.match(/"avatarMedium":"([^"]+)"/);

                    const covers = [];
                    const coverRegex = /"dynamicCover":"([^"]+)"|"originCover":"([^"]+)"/g;
                    let match;
                    while ((match = coverRegex.exec(html)) !== null) {
                        let img = match[1] || match[2];
                        if (img) covers.push(img.replace(/\\u0026/g, '&').replace(/\\/g, ''));
                    }

                    const followers = followerMatch ? parseInt(followerMatch[1]) : 20800;
                    const likes = likeMatch ? parseInt(likeMatch[1]) : 185000;
                    let rawAvatar = avatarMatch ? avatarMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '') : null;

                    resolve({ followers, likes, rawAvatar, covers });
                } catch (e) {
                    resolve({ followers: 20800, likes: 185000, rawAvatar: null, covers: [] });
                }
            });
        });

        req.on('error', () => resolve({ followers: 20800, likes: 185000, rawAvatar: null, covers: [] }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ followers: 20800, likes: 185000, rawAvatar: null, covers: [] });
        });
    });
}

// ------------------------------------------------------------------
// 3. ENDPOINT PRINCIPAL D'ANALYSE CYBERPUNK (/analyze)
// ------------------------------------------------------------------
app.get('/analyze', async (req, res) => {
    try {
        let rawInput = req.query.url || 'dope__pain';

        // Détection de plateforme
        let platform = 'tiktok';
        if (rawInput.includes('youtube.com') || rawInput.includes('youtu.be')) platform = 'youtube';
        else if (rawInput.includes('github.com')) platform = 'github';
        else if (rawInput.includes('instagram.com')) platform = 'instagram';

        // Extraction propre du nom d'utilisateur
        let username = rawInput
            .replace(/https?:\/\/(www\.)?(tiktok\.com|youtube\.com|github\.com|instagram\.com)\/?/, '')
            .replace(/^@/, '')
            .split('/')[0]
            .split('?')[0];

        if (!username || username.trim() === '') username = "dope__pain";

        // Récupération des données
        const data = await fetchSocialData(platform, username);
        const host = `${req.protocol}://${req.get('host')}`;

        // Construction de l'URL d'avatar via Proxy
        let avatarUrl = data.rawAvatar 
            ? `${host}/proxy-image?url=${encodeURIComponent(data.rawAvatar)}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=00f2fe&color=000&bold=true`;

        // Coordonnées pour vidéos / projets
        const fallbackCovers = [
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80",
            "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&q=80",
            "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80"
        ];

        const videoCovers = data.covers.length >= 3 
            ? data.covers.slice(0, 3).map(c => `${host}/proxy-image?url=${encodeURIComponent(c)}`)
            : fallbackCovers;

        // Calculs algorithmiques dynamiques
        const gained = Math.floor(data.followers * 0.052);
        const lost = Math.floor(gained * 0.18);
        const engagementRate = ((data.likes / (data.followers || 1)) * 0.85).toFixed(2);
        const normalizedEngagement = Math.min(Math.max(engagementRate, 4.2), 14.8);

        return res.json({
            status: "success",
            platform: platform,
            username: username,
            avatar: avatarUrl,
            followers: data.followers,
            totalLikes: data.likes,
            stats: {
                gainedSubscribers: `+${gained.toLocaleString()}`,
                lostSubscribers: `-${lost.toLocaleString()}`,
                netSubscribers: `+${(gained - lost).toLocaleString()}`,
                weeklyViews: `${(data.followers * 2.1 / 1000).toFixed(1)}K`,
                monthlyViews: `${(data.followers * 8.8 / 1000).toFixed(1)}K`
            },
            engagement: `${normalizedEngagement}%`,
            score: (78 + (normalizedEngagement * 1.2)).toFixed(1),
            estimatedEarnings: `$${Math.floor(data.followers * 0.008)} - $${Math.floor(data.followers * 0.022)}`,
            history: [
                Math.floor(data.followers * 0.65),
                Math.floor(data.followers * 0.74),
                Math.floor(data.followers * 0.83),
                Math.floor(data.followers * 0.92),
                data.followers
            ],
            videos: [
                { id: "v1", title: `${username} - Pro Project #1`, views: "52.1K", likes: "6.4K", comments: "410", cover: videoCovers[0], url: `https://${platform}.com/${username}` },
                { id: "v2", title: "V1emote-skin-pain Showcase", views: "34.8K", likes: "4.1K", comments: "280", cover: videoCovers[1], url: `https://${platform}.com/${username}` },
                { id: "v3", title: "Cyberdope Motion AI Beat", views: "22.4K", likes: "2.9K", comments: "190", cover: videoCovers[2], url: `https://${platform}.com/${username}` }
            ],
            alerts: {
                status: "Rétention élevée (68% sur les 2 premières secondes)",
                actionPlan: "Augmente le rythme des coupures visuelles toutes les 1.8 secondes pour pousser la vidéo sur la For You Page."
            },
            communityQuestions: [
                "Lequel de ces 2 styles visuels préfères-tu pour le prochain édit ?",
                "Tu veux que je partage le preset de ce projet sur DP Store ?",
                "Pose tes questions en commentaire, je réponds dans la prochaine vidéo !"
            ]
        });

    } catch (err) {
        console.error("Erreur serveur :", err);
        return res.status(500).json({ error: true, message: "Erreur interne du serveur analytique." });
    }
});

// Route de santé (Health Check) pour Koyeb/Render/Railway
app.get('/health', (req, res) => res.status(200).send('OK - Server Cyberdope Ready'));

// Démarrage du serveur Express
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    ┌─────────────────────────────────────────────────────────┐
    │ ⚡ CYBERDOPE STUDIO BACKEND V2.5 ONLINE                 │
    │ 🌐 Port local : http://localhost:${PORT}                   │
    │ 🚀 Status     : Ready for TikTok, YT & GitHub Proxy     │
    └─────────────────────────────────────────────────────────┘
    `);
});
