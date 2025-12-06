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

      // Validate that audio_url is a proper HTTPS URL
      if (!audio_url.startsWith('http://') && !audio_url.startsWith('https://')) {
        return res.status(400).json({ error: 'audio_url must be a valid HTTP/HTTPS URL' });
      }

      const requestBody = {
        audio_url,
        language_code: language_code || 'en',
      };

      const createRes = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          Authorization: API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await createRes.json();
      
      if (!createRes.ok) {
        console.error('AssemblyAI Error:', data);
        return res.status(createRes.status).json({ error: data.error || data.message || 'AssemblyAI transcription failed' });
      }
      
      return res.status(200).json(data);
    } catch (err) {
      console.error('Transcribe API Error:', err);
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
