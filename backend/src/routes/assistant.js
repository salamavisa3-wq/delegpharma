// Assistant IA — proxy vers Ollama Cloud. La clé vit UNIQUEMENT côté serveur
// (process.env.OLLAMA_API_KEY), jamais dans le JS/HTML client.
import { Router } from 'express';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const OLLAMA_URL = 'https://ollama.com/v1/chat/completions';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'nemotron-3-nano:30b';
const SYSTEM_PROMPT = 'Tu es un assistant expert pour une pharmacie au Sénégal.';

router.post('/assistant', async (req, res) => {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) return res.status(503).json({ error: 'Assistant IA non configuré' });

  const { message, history } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'message requis' });

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(Array.isArray(history) ? history.slice(-10) : []),
    { role: 'user', content: String(message).trim() },
  ];

  try {
    const r = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages }),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      return res.status(502).json({ error: `Ollama ${r.status}`, detail });
    }
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content ?? '';
    if (!reply) return res.status(502).json({ error: 'Réponse Ollama vide' });
    return res.json({ reply });
  } catch (e) {
    return res.status(502).json({ error: 'Erreur réseau Ollama' });
  }
});

export default router;
