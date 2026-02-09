
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI} from '@google/genai'
import {limitFunction} from 'p-limit'

const timeoutMs = 120_000
const maxRetries = 3
const baseDelay = 1000

export default limitFunction(
  async ({model, prompt, inputFile, signal}) => {
    // Inizializziamo il client all'interno per usare la chiave API corrente
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY})

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Prepariamo le parti della richiesta. 
        // Per i modelli nano banana, un prompt testuale chiaro è fondamentale.
        const parts = []
        
        // Se è un tentativo di retry dopo un IMAGE_OTHER, proviamo a semplificare il prompt
        const finalPrompt = attempt > 0 
          ? `Genera un'immagine basata su questa foto seguendo queste istruzioni: ${prompt}`
          : `Istruzione di fotoritocco: ${prompt}`

        parts.push({text: finalPrompt})

        if (inputFile) {
          parts.push({
            inlineData: {
              data: inputFile.split(',')[1],
              mimeType: 'image/jpeg'
            }
          })
        }

        const modelPromise = ai.models.generateContent({
          model,
          contents: {parts},
          // Rimosso config con systemInstruction per aumentare la stabilità del fotoritocco
          safetySettings
        })

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        )

        const response = await Promise.race([modelPromise, timeoutPromise])

        if (!response || !response.candidates || response.candidates.length === 0) {
          throw new Error('Il servizio non ha restituito alcun candidato.')
        }

        const candidate = response.candidates[0]
        
        // Verifica la presenza di contenuti
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
          const reason = candidate.finishReason || 'SCONOSCIUTO'
          
          if (reason === 'SAFETY') {
            throw new Error('La generazione è stata bloccata dai filtri di sicurezza.')
          } else if (reason === 'RECITATION') {
            throw new Error('La generazione è stata bloccata per copyright.')
          } else if (reason === 'IMAGE_OTHER') {
            // IMAGE_OTHER è spesso temporaneo o legato alla complessità della foto
            throw new Error('Il modello ha riscontrato un problema tecnico nella generazione (IMAGE_OTHER).')
          } else {
            throw new Error(`Interruzione modello: ${reason}`)
          }
        }

        const inlineDataPart = candidate.content.parts.find(p => p.inlineData)
        if (!inlineDataPart) {
          throw new Error('Nessuna immagine restituita nel risultato.')
        }

        return 'data:image/png;base64,' + inlineDataPart.inlineData.data
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') {
          return
        }

        // Se è l'ultimo tentativo, lanciamo l'errore
        if (attempt === maxRetries - 1) {
          console.error('MADEfoto API Error:', error.message)
          throw error
        }

        // Calcolo del ritardo con backoff esponenziale
        const delay = baseDelay * 2 ** attempt
        await new Promise(res => setTimeout(res, delay))
        console.warn(
          `Tentativo ${attempt + 1} fallito (${error.message}). Nuovo tentativo in corso...`
        )
      }
    }
  },
  {concurrency: 2}
)

const safetySettings = [
  {category: 'HATE_SPEECH', threshold: 'BLOCK_NONE'},
  {category: 'SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE'},
  {category: 'DANGEROUS_CONTENT', threshold: 'BLOCK_NONE'},
  {category: 'HARASSMENT', threshold: 'BLOCK_NONE'}
]
