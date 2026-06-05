const express = require('express');
const cors = require('cors');
const app = express();


const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
const cache = new Map();
const cacheTTL = 5 * 60 * 1000;

app.get('/github/:username/summary', async (req, res) => {
    const { username } = req.params;
    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'error ' });
    }

    const cacheKey = username.toLowerCase().trim();
    const cachedItem = cache.get(cacheKey);
    if (cachedItem && (Date.now() - cachedItem.timestamp < cacheTTL)) {

        return res.json(cachedItem.data);
    }
    try {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Express-GitHub-Public-Aggregator'
        };
        const userResponse = await fetch(`https://api.github.com/users/${username}`, { headers });
        if (userResponse.status === 404) {
            return res.status(404).json({ error: 'not found' });
        }
        if (!userResponse.ok) {
            return res.status(userResponse.status).json({ error: 'failed to fetch' });
        }
        const userData = await userResponse.json();
        const totalPublicRepos = userData.public_repos;
        let allRepos = [];
        const perPage = 10;
        let page = 1;

        while (allRepos.length < totalPublicRepos) {
            const reposResponse = await fetch(
                `https://api.github.com/users/${username}/repos?per_page=${perPage}&page=${page}`,
                { headers }
            );
            if (!reposResponse.ok) break;
            const pageRepos = await reposResponse.json();
            if (pageRepos.length === 0) break;
            allRepos = allRepos.concat(pageRepos);
            page++;
        }
        let totalStars = 0;
        const processedRepos = allRepos.map(repo => {
            const stars = repo.stargazers_count || 0;
            totalStars += stars;
            return {
                name: repo.name,
                stars: stars,
                url: repo.html_url
            };
        });
        const topRepos = processedRepos.slice(0, 5);
        const summaryPayload = {
            totalRepos: allRepos.length,
            totalStars,
            topRepos
        };
        cache.set(cacheKey, {
            timestamp: Date.now(),
            data: summaryPayload
        });
        return res.json(summaryPayload);

    } catch (err) {
        return res.status(500).json({ error: 'server error', details: err.message });
    }
});

app.listen(PORT, () => console.log(`Server running ${PORT}`));
