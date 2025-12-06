export const config = {
  api: {
    bodyParser: {
      sizeLimit: '200mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    return res.status(500).json({ error: 'Cloudinary not configured on the server.' });
  }

  try {
    const { filename, data, mimeType } = req.body;
    if (!data || !filename) return res.status(400).json({ error: 'Missing file data or filename' });

    // Convert base64 string to a Blob (Node 18+ runtime supports Blob and FormData)
    const base64Data = data.split(',')[1] ?? data; // tolerate data URLs
    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });

    const formData = new FormData();
    formData.set('file', blob, filename);
    formData.set('upload_preset', UPLOAD_PRESET);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;
    const cloudRes = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const json = await cloudRes.json();
    if (!cloudRes.ok) {
      console.error('Cloudinary Error:', json);
      return res.status(cloudRes.status).json({ error: json.error?.message || json.error || 'Cloudinary upload failed', details: json });
    }

    // Verify secure_url exists and is valid
    if (!json.secure_url) {
      console.error('No secure_url in Cloudinary response:', json);
      return res.status(500).json({ error: 'Cloudinary upload succeeded but no URL returned' });
    }

    return res.status(200).json(json);
  } catch (err) {
    console.error('Upload API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
