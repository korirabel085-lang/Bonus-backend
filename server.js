const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const corsOptions = {
  origin: 'https://luxearn.site',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

app.post('/api/check-claim', async (req, res) => {
  const { email, taskType } = req.body;

  if (!email || !taskType) {
    return res.status(400).json({ error: 'Email and taskType are required' });
  }

  if (taskType !== 'telegram' && taskType !== 'whatsapp') {
    return res.status(400).json({ error: 'Invalid taskType' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM bonus_claims WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.json({
        claimed: false,
        canClaim: true,
        message: 'You can claim the bonus!'
      });
    }

    const userRecord = result.rows[0];
    const fieldName = `${taskType}_claimed`;
    const alreadyClaimed = userRecord[fieldName];

    res.json({
      claimed: alreadyClaimed,
      canClaim: !alreadyClaimed,
      message: alreadyClaimed 
        ? 'Sorry, the bonus is already claimed!' 
        : 'You can claim the bonus!'
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/claim-bonus', async (req, res) => {
  const { email, taskType } = req.body;

  if (!email || !taskType) {
    return res.status(400).json({ error: 'Email and taskType are required' });
  }

  if (taskType !== 'telegram' && taskType !== 'whatsapp') {
    return res.status(400).json({ error: 'Invalid taskType' });
  }

  try {
    const checkResult = await pool.query(
      'SELECT * FROM bonus_claims WHERE email = $1',
      [email.toLowerCase()]
    );

    const fieldName = `${taskType}_claimed`;
    const timestampField = `${taskType}_claimed_at`;

    if (checkResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO bonus_claims (email, ${fieldName}, ${timestampField}, created_at) 
         VALUES ($1, TRUE, NOW(), NOW())`,
        [email.toLowerCase()]
      );

      return res.json({
        success: true,
        message: 'Bonus claimed successfully!',
        amount: 0.50
      });
    }

    const userRecord = checkResult.rows[0];
    if (userRecord[fieldName]) {
      return res.status(400).json({
        success: false,
        error: 'Sorry, the bonus is already claimed!'
      });
    }

    await pool.query(
      `UPDATE bonus_claims 
       SET ${fieldName} = TRUE, ${timestampField} = NOW() 
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    res.json({
      success: true,
      message: 'Bonus claimed successfully!',
      amount: 0.50
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/get-claim-status', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query(
      'SELECT telegram_claimed, whatsapp_claimed FROM bonus_claims WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.json({
        telegram: { claimed: false },
        whatsapp: { claimed: false }
      });
    }

    const userRecord = result.rows[0];
    res.json({
      telegram: { claimed: userRecord.telegram_claimed || false },
      whatsapp: { claimed: userRecord.whatsapp_claimed || false }
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
