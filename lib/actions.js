
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GIFEncoder, quantize, applyPalette } from 'https://unpkg.com/gifenc@1.0.3/dist/gifenc.esm.js'
import useStore from './store'
import imageData from './imageData'
import gen from './llm'
import modes from './modes'

const get = useStore.getState
const set = useStore.setState
const gifSize = 512
const model = 'gemini-2.5-flash-image'

export const clearError = () => {
  set(state => {
    state.error = null
  })
}

export const snapPhoto = async b64 => {
  const id = crypto.randomUUID()
  const {activeMode, customPrompt} = get()
  imageData.inputs[id] = b64

  set(state => {
    state.error = null
    state.photos.unshift({id, mode: activeMode, isBusy: true})
  })

  try {
    const result = await gen({
      model,
      prompt: activeMode === 'custom' ? customPrompt : modes[activeMode].prompt,
      inputFile: b64
    })

    imageData.outputs[id] = result

    set(state => {
      state.photos = state.photos.map(photo =>
        photo.id === id ? {...photo, isBusy: false} : photo
      )
    })
  } catch (err) {
    console.error('MADEfoto: Generation failed:', err)
    let errorMessage = err.message === 'QUOTA_EXCEEDED' 
      ? "Limite di richieste raggiunto. Attendi un momento." 
      : "Errore nella generazione dell'immagine.";
    
    set(state => {
      state.error = errorMessage;
      state.photos = state.photos.filter(p => p.id !== id)
    })
    setTimeout(() => { if (get().error === errorMessage) clearError() }, 6000)
  }
}

export const deletePhoto = id => {
  set(state => {
    state.photos = state.photos.filter(photo => photo.id !== id)
  })
  delete imageData.inputs[id]
  delete imageData.outputs[id]
}

export const setMode = mode => set(state => { state.activeMode = mode })
export const setCustomPrompt = prompt => set(state => { state.customPrompt = prompt })

const processImageToCanvas = async (base64Data, size) => {
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = base64Data
  })
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = size
  canvas.height = size
  ctx.drawImage(img, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size)
}

export const makeGif = async () => {
  const {photos} = get()
  set(state => { state.gifInProgress = true })
  try {
    const encoder = GIFEncoder()
    const readyPhotos = photos.filter(photo => !photo.isBusy)
    for (const photo of readyPhotos) {
      const input = await processImageToCanvas(imageData.inputs[photo.id], gifSize)
      const out = await processImageToCanvas(imageData.outputs[photo.id], gifSize)
      
      const p1 = quantize(input.data, 256)
      encoder.writeFrame(applyPalette(input.data, p1), gifSize, gifSize, {palette: p1, delay: 400})
      
      const p2 = quantize(out.data, 256)
      encoder.writeFrame(applyPalette(out.data, p2), gifSize, gifSize, {palette: p2, delay: 800})
    }
    encoder.finish()
    set(state => { state.gifUrl = URL.createObjectURL(new Blob([encoder.buffer], {type: 'image/gif'})) })
  } catch (error) {
    console.error('GIF error:', error)
  } finally {
    set(state => { state.gifInProgress = false })
  }
}

export const hideGif = () => set(state => { state.gifUrl = null })
