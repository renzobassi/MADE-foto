
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai'
import pLimit from 'https://esm.sh/p-limit@4.0.0'

const maxRetries = 5
const baseDelay = 1500

const limit = pLimit(1)

async function generateImage({model, prompt, inputFile, signal}) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error('API_KEY non configurata nel sistema.');
  }

  const ai = new GoogleGenAI({apiKey});

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

      if (attempt > 0) {
        console.warn(`MADEfoto: Tentativo di recupero ${attempt + 1}/${maxRetries}...`);
      }

      if (attempt === 2) {
        systemInstruction = "Applica uno stile artistico all'immagine preservando il volto.";
        currentPrompt = `Stile: ${prompt}. Mantieni l'identità.`;
      }
      
      if (attempt === 4) {
        currentPrompt = `Trasforma questa foto con questo stile artistico: ${prompt}.`;
        systemInstruction = undefined;
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
      try {
        const errorBody = typeof error.message === 'string' && error.message.startsWith('{') ? JSON.parse(error.message) : null;
        if (errorBody?.error?.code === 429 || errorBody?.error?.status === 'RESOURCE_EXHAUSTED') {
          isQuotaError = true;
        }
      } catch (e) {
        if (error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('429')) {
          isQuotaError = true;
        }
      }

      if (attempt === maxRetries - 1) {
        if (isQuotaError) throw new Error('QUOTA_EXCEEDED');
        throw error;
      }

      const waitTime = isQuotaError ? (baseDelay * 3 * (attempt + 1)) : (baseDelay * (attempt + 1));
      const delay = waitTime * (1 + Math.random() * 0.5);
      
      await new Promise(res => setTimeout(res, delay))
    }
  }
}

export default (args) => limit(() => generateImage(args))
