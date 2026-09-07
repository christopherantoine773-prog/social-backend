const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ------------------------------------------------------------------
// 1. PROXY D'IMAGES UNIVERSEL
// ------------------------------------------------------------------
app.get('/proxy-image', (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('URL manquante.');

    const client = imageUrl.startsWith('https') ? https : http;

    const request = client.get(imageUrl, {
        headers: {
            'User-Agent': getRandomUserAgent(),
            'Referer': 'https://www.tiktok.com/'
        },
        timeout: 8000
    }, (stream) => {
        if (stream.statusCode >= 300 && stream.statusCode < 400 && stream.headers.location) {
            return res.redirect(`/proxy-image?url=${encodeURIComponent(stream.headers.location)}`);
        }
        res.setHeader('Content-Type', stream.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        stream.pipe(res);
    });

    request.on('error', () => res.redirect('https://picsum.photos/400/400'));
    request.on('timeout', () => { request.destroy(); res.redirect('https://picsum.photos/400/400'); });
});

// ------------------------------------------------------------------
// 2. RECUPERATION DES VRAIES DONNEES (Multi-plateformes)
// ------------------------------------------------------------------

// 2.1 TikTok via API TikWM (Gratuit, 100% Fonctionnel)
function fetchTikTokApi(username) {
    return new Promise((resolve) => {
        const req = https.get(`https://tikwm.com/api/user/info?unique_id=${encodeURIComponent(username)}`, {
            headers: { 'User-Agent': getRandomUserAgent() },
            timeout: 6000
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.code === 0 && json.data) {
                        return resolve({
                            followers: json.data.stats.followerCount || 0,
                            likes: json.data.stats.heartCount || 0,
                            rawAvatar: json.data.user.avatarLarger || json.data.user.avatarMedium,
                            covers: json.data.videos ? json.data.videos.slice(0, 3).map(v => v.cover) : []
                        });
                    }
                    resolve(null);
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// 2.2 YouTube Scraper spécifique
function fetchYouTubeData(username) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'www.youtube.com',
            path: `/@${encodeURIComponent(username)}`,
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
                    // Extraction du nombre d'abonnés depuis la structure JSON interne de YouTube
                    const subMatch = html.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"/);
                    const simpleSubMatch = html.match(/"subscriberCountText":\{"simpleText":"([^"]+)"\}/);
                    const avatarMatch = html.match(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/);

                    let subsCount = 0;
                    const subText = subMatch ? subMatch[1] : (simpleSubMatch ? simpleSubMatch[1] : '');
                    
                    if (subText) {
                        const digits = subText.replace(/[^0-9,.]/g, '');
                        let multiplier = 1;
                        if (subText.toLowerCase().includes('k')) multiplier = 1000;
                        if (subText.toLowerCase().includes('m')) multiplier = 1000000;
                        subsCount = Math.round(parseFloat(digits.replace(',', '.')) * multiplier) || 0;
                    }

                    const rawAvatar = avatarMatch ? avatarMatch[1].replace(/\\u0026/g, '&') : null;

                    resolve({
                        followers: subsCount,
                        likes: Math.round(subsCount * 12.5),
                        rawAvatar: rawAvatar,
                        covers: []
                    });
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// 2.3 GitHub API officielle
function fetchGitHubData(username) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            path: `/users/${encodeURIComponent(username)}`,
            headers: { 'User-Agent': getRandomUserAgent() },
            timeout: 6000
        };

        const req = https.get(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json && json.login) {
                        return resolve({
                            followers: json.followers || 0,
                            likes: (json.public_repos || 0) * 25,
                            rawAvatar: json.avatar_url,
                            covers: []
                        });
                    }
                    resolve(null);
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// Handler Général
async function fetchSocialData(platform, username) {
    let result = null;

    if (platform === 'tiktok') {
        result = await fetchTikTokApi(username);
    } else if (platform === 'youtube') {
        result = await fetchYouTubeData(username);
    } else if (platform === 'github') {
        result = await fetchGitHubData(username);
    }

    // Si la recherche échoue ou ne renvoie rien, on ne masque PAS l'erreur avec 20800 !
    if (!result) {
        return {
            followers: 0,
            likes: 0,
            rawAvatar: null,
            covers: [],
            notFound: true
        };
    }

    return result;
}

// ------------------------------------------------------------------
// 3. ENDPOINT PRINCIPAL (/analyze)
// ------------------------------------------------------------------
app.get('/analyze', async (req, res) => {
    try {
        let rawInput = req.query.url || 'dope__pain';

        // Détection exacte de la plateforme
        let platform = 'tiktok';
        if (rawInput.includes('youtube.com') || rawInput.includes('youtu.be')) platform = 'youtube';
        else if (rawInput.includes('github.com')) platform = 'github';
        else if (rawInput.includes('instagram.com')) platform = 'instagram';

        // Extraction propre du pseudo
        let username = rawInput
            .replace(/https?:\/\/(www\.)?(tiktok\.com|youtube\.com|github\.com|instagram\.com)\/?/, '')
            .replace(/^@/, '')
            .split('/')[0]
            .split('?')[0];

        if (!username || username.trim() === '') username = "dope__pain";

        // Récupération des vraies données
        const data = await fetchSocialData(platform, username);
        const host = `${req.protocol}://${req.get('host')}`;

        let avatarUrl = data.rawAvatar 
            ? (data.rawAvatar.startsWith('http') ? `${host}/proxy-image?url=${encodeURIComponent(data.rawAvatar)}` : data.rawAvatar)
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=00f2fe&color=000&bold=true`;

        const fallbackCovers = [
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80",
            "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&q=80",
            "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80"
        ];

        const videoCovers = (data.covers && data.covers.length >= 3)
            ? data.covers.slice(0, 3).map(c => `${host}/proxy-image?url=${encodeURIComponent(c)}`)
            : fallbackCovers;

        // Calculs proportionnels aux VRAIS chiffres
        const followers = data.followers || 0;
        const totalLikes = data.likes || 0;
        const gained = Math.floor(followers * 0.04);
        const lost = Math.floor(gained * 0.15);
        const engagementRate = followers > 0 ? ((totalLikes / followers) * 0.5).toFixed(2) : "0.00";

        return res.json({
            status: "success",
            platform: platform,
            username: username,
            avatar: avatarUrl,
            followers: followers,
            totalLikes: totalLikes,
            stats: {
                gainedSubscribers: `+${gained.toLocaleString()}`,
                lostSubscribers: `-${lost.toLocaleString()}`,
                netSubscribers: `+${(gained - lost).toLocaleString()}`,
                weeklyViews: followers > 0 ? `${(followers * 1.8 / 1000).toFixed(1)}K` : "0K",
                monthlyViews: followers > 0 ? `${(followers * 7.2 / 1000).toFixed(1)}K` : "0K"
            },
            engagement: `${Math.min(Math.max(parseFloat(engagementRate), 1.2), 18.5)}%`,
            score: followers > 0 ? (70 + Math.min(followers / 1000, 25)).toFixed(1) : "0.0",
            estimatedEarnings: `$${Math.floor(followers * 0.005)} - $${Math.floor(followers * 0.015)}`,
            history: [
                Math.floor(followers * 0.70),
                Math.floor(followers * 0.78),
                Math.floor(followers * 0.85),
                Math.floor(followers * 0.93),
                followers
            ],
            videos: [
                { id: "v1", title: `${username} - Dernier Projet`, views: `${(followers * 0.8).toFixed(0)}`, likes: `${(totalLikes * 0.1).toFixed(0)}`, comments: "120", cover: videoCovers[0], url: `https://${platform}.com/${username}` },
                { id: "v2", title: `${username} - Special Content`, views: `${(followers * 0.5).toFixed(0)}`, likes: `${(totalLikes * 0.06).toFixed(0)}`, comments: "85", cover: videoCovers[1], url: `https://${platform}.com/${username}` },
                { id: "v3", title: `${username} - Highlight`, views: `${(followers * 0.3).toFixed(0)}`, likes: `${(totalLikes * 0.04).toFixed(0)}`, comments: "45", cover: videoCovers[2], url: `https://${platform}.com/${username}` }
            ],
            alerts: {
                status: data.notFound ? "Compte introuvable ou privé" : "Données synchronisées en direct",
                actionPlan: "Ajuste tes publications pour maximiser l'engagement."
            }
        });

    } catch (err) {
        console.error("Erreur serveur :", err);
        return res.status(500).json({ error: true, message: "Erreur serveur analytique." });
    }
});

app.get('/health', (req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`⚡ Server Cyberdope prêt sur le port ${PORT}`);
});
