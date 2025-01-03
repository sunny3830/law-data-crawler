const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

// 配置 CORS，允许所有来源
app.use(cors());

// 或者指定允许的来源
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'file://*']
}));

// 添加重试函数
async function fetchWithRetry(url, options, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error.message);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

app.get('/api/laws', async (req, res) => {
    try {
        const params = new URLSearchParams(req.query);
        const url = `https://flk.npc.gov.cn/api/?${params}`;
        
        console.log(`Fetching page ${req.query.page}...`);
        
        const response = await fetchWithRetry(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Origin': 'https://flk.npc.gov.cn',
                'Referer': 'https://flk.npc.gov.cn',
                'Connection': 'keep-alive'
            },
            timeout: 10000 // 10 seconds timeout
        });
        
        const data = await response.json();
        console.log(`Successfully fetched page ${req.query.page}`);
        res.json(data);
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: error.message,
            details: `Failed to fetch page ${req.query.page}`
        });
    }
});

// 添加错误处理中间件
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// 优雅关闭服务器
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
}); 