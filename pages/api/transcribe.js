export default async function handler(req, res) {
  const API_BASE = 'https://api.assemblyai.com/v2/transcript';
  const API_KEY = process.env.ASSEMBLYAI_API_KEY;

  if (!API_KEY) {
    res.status(500).json({ error: 'AssemblyAI API key not configured on the server.' });
    return;
  }

  if (req.method === 'POST') {
    try {
      const { audio_url, language_code } = req.body;
      if (!audio_url) return res.status(400).json({ error: 'Missing audio_url in request body' });

      const createRes = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          Authorization: API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio_url, language_code }),
      });

      const data = await createRes.json();
      return res.status(createRes.status).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const id = req.query.id || req.query.transcriptId;
      if (!id) return res.status(400).json({ error: 'Missing transcript id in query' });

      const statusRes = await fetch(`${API_BASE}/${id}`, {
        headers: { Authorization: API_KEY },
      });
      const data = await statusRes.json();
      return res.status(statusRes.status).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader('Allow', ['POST', 'GET']);
  res.status(405).end('Method Not Allowed');
}
