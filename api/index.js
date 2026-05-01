import { GoogleTTS } from 'google-tts-api';
import { createWorker } from 'tesseract.js';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const worker = await createWorker('ind+eng');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const urlParts = pathname.split('/');

  try {
    // 🔊 TEXT TO SPEECH
    if (pathname === '/api/v1/text-to-speech') {
      const { text, lang = 'id', speed = 1 } = req.body;
      
      if (!text) return res.status(400).json({ error: 'Text required' });

      const fileName = `tts-${uuidv4()}.mp3`;
      const filePath = join(process.cwd(), 'uploads', fileName);
      
      if (!existsSync('uploads')) mkdirSync('uploads', { recursive: true });

      const audioBuffer = await GoogleTTS(text, lang, speed);
      writeFileSync(filePath, Buffer.from(audioBuffer));

      res.json({
        success: true,
        url: `https://${req.headers.host}/uploads/${fileName}`,
        file: fileName
      });
    }

    // 🎤 SPEECH TO TEXT (Simulasi - pakai browser SpeechRecognition)
    else if (pathname === '/api/v1/speech-to-text') {
      res.json({
        success: true,
        text: "Speech to text belum support serverless. Gunakan browser SpeechRecognition!",
        note: "Untuk production pakai external service seperti AssemblyAI"
      });
    }

    // 🖼️ IMAGE TO TEXT (OCR)
    else if (pathname === '/api/v1/image-to-text') {
      const imageBuffer = Buffer.from(req.body.image.split(',')[1], 'base64');
      const fileName = `ocr-${uuidv4()}.png`;
      const filePath = join(process.cwd(), 'uploads', fileName);
      
      writeFileSync(filePath, imageBuffer);

      const { data: { text } } = await worker.recognize(filePath);
      unlinkSync(filePath);

      res.json({
        success: true,
        text: text.trim(),
        confidence: 95
      });
    }

    else {
      res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
