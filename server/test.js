import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  console.log('Health check received');
  res.json({ status: 'ok' });
});

app.get('/api/test', (req, res) => {
  console.log('API test received');
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
});
