
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import useStore from './store'
import imageData from './imageData'
import gen from './llm'
import modes from './modes'

const get = useStore.getState
const set = useStore.setState
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
    let errorMessage = "Errore nella generazione dell'immagine.";
    
    if (err.message === 'QUOTA_EXCEEDED') {
      errorMessage = "Il server è sovraccarico. Riprova tra un minuto.";
    } else if (err.message.includes('SAFETY')) {
      errorMessage = "Contenuto bloccato dai filtri di sicurezza.";
    }
    
    set(state => {
      state.error = errorMessage;
      state.photos = state.photos.filter(p => p.id !== id)
    })
    
    setTimeout(() => { 
      if (get().error === errorMessage) clearError() 
    }, 8000)
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
