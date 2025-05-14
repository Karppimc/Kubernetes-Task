#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const port = process.env.PORT || 3010;

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'taskdb',
});

// Health check
app.get('/api', (_, res) => {
  res.send(`Backend API is running at ${new Date().toLocaleString('fi-FI')}`);
});

// Generic GET all
app.get('/api/:table', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${req.params.table}`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single item
app.get('/api/:table/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${req.params.table} WHERE id = $1 LIMIT 1`, [req.params.id]);
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new item
app.post('/api/:table', async (req, res) => {
  const table = req.params.table;
  try {
    let result;
    if (table === 'tags') {
      result = await pool.query(`INSERT INTO tags (name) VALUES ($1) RETURNING id`, [req.body.name]);
    } else if (table === 'tasks') {
      result = await pool.query(`INSERT INTO tasks (name, tags) VALUES ($1, $2) RETURNING id`, [req.body.name, req.body.tags]);
    } else if (table === 'timestamps') {
      result = await pool.query(`INSERT INTO timestamps (timestamp, task, type) VALUES ($1, $2, $3) RETURNING id`, [
        req.body.timestamp,
        req.body.task,
        req.body.type,
      ]);
    } else {
      return res.status(400).json({ error: 'Unknown table' });
    }
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH item
app.patch('/api/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  try {
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    const setClause = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
    await pool.query(`UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, id]);
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE item
app.delete('/api/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  try {
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Backend API listening on port ${port}`);
});
