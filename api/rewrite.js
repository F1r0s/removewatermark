export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, strength = 'paraphrase' } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Groq API key not configured on server' });
  }

  const prompt = `Rewrite the following text so that it uses substantially different wording at the token level. Change clause order, connectors, and transition words; vary sentence boundaries and length; and replace both content words and function words where meaning allows. Preserve all facts, numbers, names, and technical identifiers. Do not add or remove claims. Output only the rewritten text.\n\n---\n${text}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // using the latest Llama 3.3 model
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Groq API Error:', errorData);
      return res.status(response.status).json({ error: 'Failed to rewrite text with Groq', details: errorData });
    }

    const data = await response.json();
    const rewrittenText = data.choices[0]?.message?.content;

    if (!rewrittenText) {
      return res.status(500).json({ error: 'Received empty response from Groq' });
    }

    return res.status(200).json({ rewrittenText: rewrittenText.trim() });
  } catch (error) {
    console.error('Rewrite Function Error:', error);
    return res.status(500).json({ error: 'Internal server error during rewriting' });
  }
}
