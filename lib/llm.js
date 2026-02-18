
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai'
import pLimit from 'https://esm.sh/p-limit@4.0.0'

const maxRetries = 7 
const baseDelay = 2000 

const limit = pLimit(1);
async function generateImage({model, prompt, inputFile, signal}) {
  // Accesso alla chiave API esclusivamente tramite process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const parts = []
      
      if (inputFile) {
        parts.push({
          inlineData: {
            data: inputFile.split(',')[1],
            mimeType: 'image/jpeg'
          }
        })
      }

      let systemInstruction = "Sei un artista digitale esperto in fotoritocco. Trasforma l'immagine seguendo lo stile richiesto, mantenendo i tratti somatici originali senza aggiungere testi o loghi.";
      let currentPrompt = prompt;

      // Strategia di diversificazione del prompt nei retry
      if (attempt > 2) {
        systemInstruction = "Applica uno stile artistico all'immagine preservando l'essenza del soggetto.";
        currentPrompt = `Stile artistico: ${prompt}.`;
      }

      const response = await ai.models.generateContent({
        model,
        contents: { parts: [...parts, { text: currentPrompt }] },
        config: {
          systemInstruction: systemInstruction,
          seed: Math.floor(Math.random() * 2147483647),
        },
        safetySettings: [
          {category: 'HATE_SPEECH', threshold: 'BLOCK_NONE'},
          {category: 'SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE'},
          {category: 'DANGEROUS_CONTENT', threshold: 'BLOCK_NONE'},
          {category: 'HARASSMENT', threshold: 'BLOCK_NONE'}
        ]
      })

      if (!response || !response.candidates || response.candidates.length === 0) {
        throw new Error('Il modello non ha restituito risultati.');
      }

      const candidate = response.candidates[0]
      
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        const reason = candidate.finishReason || 'UNKNOWN'
        if (reason === 'IMAGE_OTHER' && attempt < maxRetries - 1) {
          throw new Error('IMAGE_OTHER_RETRY');
        }
        throw new Error(`Generazione interrotta: ${reason}`);
      }

      const inlineDataPart = candidate.content.parts.find(p => p.inlineData)
      if (!inlineDataPart) {
        throw new Error('Dati immagine non presenti nella risposta.');
      }

      return 'data:image/png;base64,' + inlineDataPart.inlineData.data
    } catch (error) {
      if (signal?.aborted) return

      let isQuotaError = false;
      const errorMsg = error.message || "";
      
      if (
        errorMsg.includes('429') || 
        errorMsg.includes('RESOURCE_EXHAUSTED') || 
        errorMsg.includes('Quota exceeded')
      ) {
        isQuotaError = true;
      }

      if (attempt === maxRetries - 1) {
        if (isQuotaError) throw new Error('QUOTA_EXCEEDED');
        throw error;
      }

      const waitTime = isQuotaError ? (6000 * (attempt + 1)) : (baseDelay * (attempt + 1));
      const jitter = Math.random() * 1000;
      const delay = waitTime + jitter;
      
      console.warn(`MADEfoto: Fallimento tentativo ${attempt + 1}/${maxRetries}. Riprovo...`);
      await new Promise(res => setTimeout(res, delay))
    }
  }
}

export default (args) => limit(() => generateImage(args))
