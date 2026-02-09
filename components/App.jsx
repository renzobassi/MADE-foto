
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {useRef, useState, useCallback, useEffect} from 'react'
import c from 'clsx'
import {
  snapPhoto,
  setMode,
  deletePhoto,
  makeGif,
  hideGif,
  setCustomPrompt
} from '../lib/actions'
import useStore from '../lib/store'
import imageData from '../lib/imageData'
import modes from '../lib/modes'
import Logo from './Logo'

const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
const modeKeys = Object.keys(modes)

export default function App() {
  const photos = useStore.use.photos()
  const customPrompt = useStore.use.customPrompt()
  const activeMode = useStore.use.activeMode()
  const gifInProgress = useStore.use.gifInProgress()
  const gifUrl = useStore.use.gifUrl()
  const [videoActive, setVideoActive] = useState(false)
  const [didInitVideo, setDidInitVideo] = useState(false)
  const [error, setError] = useState(null)
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
    setError(null)
    setDidInitVideo(true)
    stopStream()
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: {ideal: 1920}, 
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

      const {width, height} = stream.getVideoTracks()[0].getSettings()
      const squareSize = Math.min(width, height)
      canvas.width = squareSize
      canvas.height = squareSize
    } catch (err) {
      console.error('Camera error:', err)
      setError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Accesso alla fotocamera negato. Controlla le impostazioni del browser.'
          : 'Impossibile avviare la fotocamera. Assicurati che non sia usata da un altra app.'
      )
      setDidInitVideo(false)
      setVideoActive(false)
    }
  }

  const toggleCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newMode)
    startVideo(newMode)
  }

  const takePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const {videoWidth, videoHeight} = video
    const squareSize = canvas.width
    const sourceSize = Math.min(videoWidth, videoHeight)
    const sourceX = (videoWidth - sourceSize) / 2
    const sourceY = (videoHeight - sourceSize) / 2

    ctx.clearRect(0, 0, squareSize, squareSize)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    
    if (facingMode === 'user') {
      ctx.scale(-1, 1)
      ctx.drawImage(
        video,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        -squareSize,
        0,
        squareSize,
        squareSize
      )
    } else {
      ctx.drawImage(
        video,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        squareSize,
        squareSize
      )
    }
    
    snapPhoto(canvas.toDataURL('image/jpeg'))
    setDidJustSnap(true)
    setTimeout(() => setDidJustSnap(false), 1000)
  }

  const downloadImage = async () => {
    const url = gifUrl || imageData.outputs[focusedId];
    const isGif = !!gifUrl;
    const extension = isGif ? 'gif' : 'jpg';
    const filename = `foto.${extension}`;
    const mimeType = isGif ? 'image/gif' : 'image/jpeg';

    // Prova a usare la Web Share API per favorire il salvataggio in "Foto" su mobile
    if (navigator.share && navigator.canShare) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: mimeType });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'MADEfoto',
            text: 'Guarda la mia foto trasformata!'
          });
          return; // Uscita anticipata se la condivisione ha avuto successo
        }
      } catch (err) {
        console.warn('Condivisione non riuscita o annullata:', err);
      }
    }

    // Fallback al download tradizionale per desktop
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  const handleModeHover = useCallback((modeInfo, event) => {
    if (!modeInfo) {
      setHoveredMode(null)
      return
    }

    setHoveredMode(modeInfo)

    const rect = event.currentTarget.getBoundingClientRect()
    const tooltipTop = rect.top
    const tooltipLeft = rect.left + rect.width / 2

    setTooltipPosition({
      top: tooltipTop,
      left: tooltipLeft
    })
  }, [])

  return (
    <main>
      <div
        className="video"
        onClick={() => {
          hideGif()
          setFocusedId(null)
        }}
      >
        {videoActive && (
          <div className="dashboard-logo-container">
            <Logo height={28} />
          </div>
        )}

        {showCustomPrompt && (
          <div className="customPrompt">
            <button
              className="circleBtn"
              onClick={() => {
                setShowCustomPrompt(false)

                if (customPrompt.trim().length === 0) {
                  setMode(modeKeys[0])
                }
              }}
            >
              <span className="icon">close</span>
            </button>
            <textarea
              type="text"
              placeholder="Inserisci un prompt personalizzato"
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setShowCustomPrompt(false)
                }
              }}
            />
          </div>
        )}
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          disablePictureInPicture="true"
          className={c({ mirror: facingMode === 'user' })}
        />
        {didJustSnap && <div className="flash" />}
        {!videoActive && (
          <button className="startButton" onClick={() => startVideo()} disabled={didInitVideo}>
            <Logo className="start-logo" height={80} />
            <h2 className="slogan">SCATTA E TRASFORMA!</h2>
            {error ? (
              <div className="error-message">
                <span className="icon">warning</span>
                <p>{error}</p>
                <p style={{fontSize: '14px', marginTop: '10px', opacity: 0.8}}>Tocca per riprovare</p>
              </div>
            ) : (
              <p>{didInitVideo ? 'Inizializzazione...' : 'Tocca ovunque per iniziare'}</p>
            )}
          </button>
        )}

        {videoActive && (
          <div className="videoControls">
            <div className="shutterGroup">
              <button onClick={toggleCamera} className="cameraSwitch">
                <span className="icon">flip_camera_ios</span>
              </button>
              <button onClick={takePhoto} className="shutter">
                <span className="icon">camera</span>
              </button>
              <div className="shutterSpacer" />
            </div>

            <ul className="modeSelector">
              <li
                key="custom"
                onMouseEnter={e =>
                  handleModeHover({key: 'custom', prompt: customPrompt}, e)
                }
                onMouseLeave={() => handleModeHover(null)}
              >
                <button
                  className={c({active: activeMode === 'custom'})}
                  onClick={() => {
                    setMode('custom')
                    setShowCustomPrompt(true)
                  }}
                >
                  <p>Personalizzato</p>
                </button>
              </li>
              {Object.entries(modes).map(([key, {name, prompt}]) => (
                <li
                  key={key}
                  onMouseEnter={e => handleModeHover({key, prompt}, e)}
                  onMouseLeave={() => handleModeHover(null)}
                >
                  <button
                    onClick={() => setMode(key)}
                    className={c({active: key === activeMode})}
                  >
                    <p>{name}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(focusedId || gifUrl) && (
          <div className="focusedPhoto" onClick={e => e.stopPropagation()}>
            <button
              className="circleBtn"
              onClick={() => {
                hideGif()
                setFocusedId(null)
              }}
            >
              <span className="icon">close</span>
            </button>
            <img
              src={gifUrl || imageData.outputs[focusedId]}
              alt="foto"
              draggable={false}
            />
            <button className="button downloadButton" onClick={downloadImage}>
              Salva in Foto
            </button>
          </div>
        )}
      </div>

      <div className="results">
        <ul>
          {photos.length
            ? photos.map(({id, mode, isBusy}) => (
                <li className={c({isBusy})} key={id}>
                  <button
                    className="circleBtn deleteBtn"
                    onClick={() => {
                      deletePhoto(id)
                      if (focusedId === id) {
                        setFocusedId(null)
                      }
                    }}
                  >
                    <span className="icon">delete</span>
                  </button>
                  <button
                    className="photo"
                    onClick={() => {
                      if (!isBusy) {
                        setFocusedId(id)
                        hideGif()
                      }
                    }}
                  >
                    <img
                      src={
                        isBusy ? imageData.inputs[id] : imageData.outputs[id]
                      }
                      draggable={false}
                    />
                    <p className="emoji-badge">
                      {mode === 'custom' ? '✏️' : '✨'}
                    </p>
                  </button>
                </li>
              ))
            : videoActive && (
                <li className="empty" key="empty">
                  <p>
                    👉 <span className="icon">camera</span>
                  </p>
                  Scatta una foto per iniziare.
                </li>
              )}
        </ul>
        {photos.filter(p => !p.isBusy).length > 0 && (
          <button
            className="button makeGif"
            onClick={makeGif}
            disabled={gifInProgress}
          >
            {gifInProgress ? 'Un attimo…' : 'Crea GIF!'}
          </button>
        )}
      </div>

      {hoveredMode && (
        <div
          className={c('tooltip', {isFirst: hoveredMode.key === 'custom'})}
          role="tooltip"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: 'translateX(-50%)'
          }}
        >
          {hoveredMode.key === 'custom' && !hoveredMode.prompt.length ? (
            <p>Clicca per impostare un prompt</p>
          ) : (
            <>
              <p>"{hoveredMode.prompt}"</p>
              <h4>Suggerimento</h4>
            </>
          )}
        </div>
      )}
    </main>
  )
}
