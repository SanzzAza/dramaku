const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mount routes
const tiktokHandler = require('./api/tiktok');
const youtubeHandler = require('./api/youtube');
const instagramHandler = require('./api/instagram');
const facebookHandler = require('./api/facebook');

app.get('/api/tiktok', tiktokHandler);
app.get('/api/youtube', youtubeHandler);
app.get('/api/instagram', instagramHandler);
app.get('/api/facebook', facebookHandler);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
