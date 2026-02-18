
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {useRef, useState, useCallback} from 'react'
import c from 'clsx'
import {
  snapPhoto,
  setMode,
  deletePhoto,
  setCustomPrompt,
  clearError
} from '../lib/actions'
import useStore from '../lib/store'
import imageData from '../lib/imageData'
import modes from '../lib/modes'
import Logo from './Logo'

const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')

export default function App() {
  const photos = useStore.use.photos()
  const customPrompt = useStore.use.customPrompt()
  const activeMode = useStore.use.activeMode()
  const globalError = useStore.use.error()
  
  const [videoActive, setVideoActive] = useState(false)
  const [didInitVideo, setDidInitVideo] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [focusedId, setFocusedId] = useState(null)
  const [didJustSnap, setDidJustSnap] = useState(false)
  const [hoveredMode, setHoveredMode] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({top: 0, left: 0})
  const [showCustomPrompt, setShowCustomPrompt] = useState(false)
  const [facingMode, setFacingMode] = useState('user')
  
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const startVideo = async (mode = facingMode) => {
    setCameraError(null)
    setDidInitVideo(true)
    stopStream()
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: {ideal: 1080}, 
          height: {ideal: 1080}, 
          facingMode: mode 
        },
        audio: false
      })
      streamRef.current = stream
      setVideoActive(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error('Camera error:', err)
      setCameraError('Accesso fotocamera negato o non disponibile.')
      setDidInitVideo(false)
    }
  }

  const toggleCamera = () => {
    const next = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(next)
    startVideo(next)
  }

  const takePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const size = Math.min(video.videoWidth, video.videoHeight)
    canvas.width = 1080; 
    canvas.height = 1080;
    ctx.clearRect(0, 0, 1080, 1080)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    if (facingMode === 'user') {
      ctx.scale(-1, 1); 
      ctx.translate(-1080, 0)
    }
    ctx.drawImage(video, (video.videoWidth-size)/2, (video.videoHeight-size)/2, size, size, 0, 0, 1080, 1080)
    snapPhoto(canvas.toDataURL('image/jpeg', 0.9))
    setDidJustSnap(true)
    setTimeout(() => setDidJustSnap(false), 500)
  }

  const handleDownload = (e) => {
    e.stopPropagation()
    const dataUrl = imageData.outputs[focusedId]
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `made_ritratto_${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleShare = async (e) => {
    e.stopPropagation()
    const dataUrl = imageData.outputs[focusedId]
    if (!dataUrl) return

    try {
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const file = new File([blob], 'made_ritratto.png', { type: 'image/png' })

      if (navigator.share) {
        // Controlla se il browser supporta specificamente la condivisione di file
        const shareData = {
          files: [file],
          title: 'Il mio MADE Ritratto',
          text: 'Guarda che trasformazione ho creato con MADE Ritratti!'
        };

        if (navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
        } else {
          // Fallback alla condivisione solo testo/URL se i file non sono supportati
          await navigator.share({
            title: 'Il mio MADE Ritratto',
            text: 'Guarda la mia trasformazione con MADE Ritratti!'
          });
        }
      } else {
        alert("La condivisione nativa non è supportata su questo browser. Usa il tasto 'Salva'.")
      }
    } catch (err) {
      // Ignora l'errore se l'utente ha semplicemente annullato l'operazione
      if (err.name === 'AbortError') return;
      console.error('Share error:', err)
    }
  }

  const handleModeHover = useCallback((modeInfo, event) => {
    if (!modeInfo) { setHoveredMode(null); return }
    const rect = event.currentTarget.getBoundingClientRect()
    setHoveredMode(modeInfo)
    setTooltipPosition({ top: rect.top - 8, left: rect.left + rect.width / 2 })
  }, [])

  return (
    <main>
      <div className="video" onClick={() => setFocusedId(null)}>
        {videoActive && <div className="dashboard-logo-container"><Logo height={28} /></div>}
        
        {globalError && (
          <div className="customPrompt error-bubble" onClick={e => e.stopPropagation()}>
            <button className="circleBtn" onClick={clearError}><span className="icon">close</span></button>
            <div className="error-text"><p>{globalError}</p></div>
          </div>
        )}

        {showCustomPrompt && !globalError && (
          <div className="customPrompt" onClick={e => e.stopPropagation()}>
            <button className="circleBtn" onClick={() => setShowCustomPrompt(false)}><span className="icon">close</span></button>
            <textarea autoFocus placeholder="Cosa vuoi diventare?" value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && setShowCustomPrompt(false)} />
          </div>
        )}
        
        <video ref={videoRef} muted autoPlay playsInline className={c({ mirror: facingMode === 'user' })} />
        {didJustSnap && <div className="flash" />}
        
        {!videoActive && (
          <button className="startButton" onClick={() => startVideo()} disabled={didInitVideo}>
            <Logo height={80} />
            <h2 className="slogan">MADE RITRATTI</h2>
            <p>{cameraError || (didInitVideo ? 'Inizializzazione...' : 'Tocca per iniziare')}</p>
          </button>
        )}

        {videoActive && (
          <div className="videoControls" onClick={e => e.stopPropagation()}>
            <div className="shutterGroup">
              <button onClick={toggleCamera} className="cameraSwitch" title="Inverti camera"><span className="icon">flip_camera_ios</span></button>
              <button onClick={takePhoto} className="shutter" title="Scatta"><span className="icon">camera</span></button>
              <div className="shutterSpacer" />
            </div>
            <ul className="modeSelector">
              <li onMouseEnter={e => handleModeHover({key:'custom', prompt: customPrompt}, e)} onMouseLeave={() => setHoveredMode(null)}>
                <button className={c({active: activeMode === 'custom'})} onClick={() => {setMode('custom'); setShowCustomPrompt(true)}}>Personalizzato</button>
              </li>
              {Object.entries(modes).map(([k,v]) => (
                <li key={k} onMouseEnter={e => handleModeHover({key:k, prompt:v.prompt}, e)} onMouseLeave={() => setHoveredMode(null)}>
                  <button onClick={() => setMode(k)} className={c({active: k === activeMode})}>{v.name}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {focusedId && (
          <div className="focusedPhoto" onClick={e => e.stopPropagation()}>
            <button className="circleBtn close-preview" onClick={() => setFocusedId(null)}><span className="icon">close</span></button>
            <div className="preview-image-container">
              <img src={imageData.outputs[focusedId]} alt="Risultato" />
            </div>
            <div className="button-group">
              <button className="button" onClick={handleDownload} title="Salva immagine">
                <span className="icon">download</span> Salva
              </button>
              <button className="button secondary" onClick={handleShare} title="Condividi immagine">
                <span className="icon">share</span> Condividi
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="results">
        <ul>
          {photos.length ? photos.map(({id, mode, isBusy}) => (
            <li className={c({isBusy})} key={id}>
              <button className="circleBtn deleteBtn" onClick={(e) => { e.stopPropagation(); deletePhoto(id); if(focusedId === id) setFocusedId(null); }}><span className="icon">delete</span></button>
              <button className="photo" onClick={() => !isBusy && setFocusedId(id)}><img src={isBusy ? imageData.inputs[id] : imageData.outputs[id]} alt="Miniatura" /></button>
            </li>
          )) : videoActive && <li className="empty">Scatta per iniziare</li>}
        </ul>
      </div>

      {hoveredMode && (
        <div className="tooltip" style={{ top: tooltipPosition.top, left: tooltipPosition.left }}>
          <p>"{hoveredMode.prompt || 'Scrivi qualcosa...'}"</p>
        </div>
      )}
    </main>
  )
}
