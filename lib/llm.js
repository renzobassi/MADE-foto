
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
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY})

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const parts = []
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

        const response = await ai.models.generateContent({
          model,
          contents: {parts},
          safetySettings
        })

        if (!response || !response.candidates || response.candidates.length === 0) {
          throw new Error('No candidates returned.')
        }

        const candidate = response.candidates[0]
        
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
          const reason = candidate.finishReason || 'UNKNOWN'
          throw new Error(`Model interrupted: ${reason}`)
        }

        const inlineDataPart = candidate.content.parts.find(p => p.inlineData)
        if (!inlineDataPart) {
          throw new Error('No image returned.')
        }

        return 'data:image/png;base64,' + inlineDataPart.inlineData.data
      } catch (error) {
        if (signal?.aborted) return

        if (attempt === maxRetries - 1) {
          throw error
        }

        const delay = baseDelay * 2 ** attempt
        await new Promise(res => setTimeout(res, delay))
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
