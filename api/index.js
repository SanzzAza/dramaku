import { createWorker } from 'tesseract.js';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import fetch from 'node-fetch';

const worker = await createWorker('ind+eng');

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    // 🔊 TEXT TO SPEECH (Free TTS API)
    if (pathname === '/api/v1/text-to-speech') {
      const { text, lang = 'id-ID', speed = 1 } = req.body;
      
      if (!text || text.length > 500) {
        return res.status(400).json({ error: 'Text max 500 chars' });
      }

      // Free TTS API (ttsMP3.com)
      const ttsUrl = `https://ttsmp3.com/makemp3_new.php?msg=${encodeURIComponent(text)}&lang=${lang}&source=ttsmp3`;
      
      const audioResponse = await fetch(ttsUrl);
      const audioBuffer = await audioResponse.arrayBuffer();
      
      const fileName = `tts-${uuidv4()}.mp3`;
      const filePath = join(process.cwd(), 'uploads', fileName);
      
      if (!existsSync('uploads')) mkdirSync('uploads', { recursive: true });
      writeFileSync(filePath, Buffer.from(audioBuffer));

      res.json({
        success: true,
        url: `https://${req.headers.host}/uploads/${fileName}`,
        download: `https://${req.headers.host}/uploads/${fileName}`,
        text: text.substring(0, 50) + '...'
      });
    }

    // 🖼️ IMAGE TO TEXT (OCR - FULL WORKING)
    else if (pathname === '/api/v1/image-to-text') {
      let imageBuffer;
      
      // Handle file upload atau base64
      if (req.body.image) {
        imageBuffer = Buffer.from(req.body.image.split(',')[1], 'base64');
      } else if (req.headers['content-type']?.includes('multipart')) {
        // Vercel blob handling
        imageBuffer = req.body;
      }

      if (!imageBuffer) {
        return res.status(400).json({ error: 'No image provided' });
      }

      const fileName = `ocr-${uuidv4()}.png`;
      const filePath = join(process.cwd(), 'uploads', fileName);
      
      writeFileSync(filePath, imageBuffer);

      const { data: { text, confidence } } = await worker.recognize(filePath);
      unlinkSync(filePath);

      res.json({
        success: true,
        text: text.trim() || 'No text detected',
        confidence: Math.round(confidence * 100),
        words: text.trim().split(' ').length
      });
    }

    // 📱 BROWSER SPEECH TO TEXT (Client-side)
    else if (pathname === '/api/v1/speech-to-text') {
      res.json({
        success: true,
        message: "Use browser SpeechRecognition for STT",
        demo: "navigator.mediaDevices.getUserMedia({ audio: true })"
      });
    }

    else {
      res.status(404).json({ error: 'API not found. Use: /api/v1/text-to-speech or /api/v1/image-to-text' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
