import { useEffect, useRef, useState } from 'react'

export default function BackgroundVideo(props) {
  var src = props.src
  var poster = props.poster
  var className = props.className || ''
  var preload = props.preload || 'auto'
  var type = props.type || 'video/mp4'
  var shouldLoop = props.loop !== false

  var readyState = useState(false)
  var isReady = readyState[0]
  var setIsReady = readyState[1]

  var videoRef = useRef(null)

  useEffect(function() {
    var video = videoRef.current

    setIsReady(false)

    if (!video) {
      return
    }

    function markReady() {
      setIsReady(true)
    }

    video.muted = true
    video.defaultMuted = true

    if (video.readyState >= 2) {
      markReady()
    }

    video.addEventListener('loadeddata', markReady)
    video.addEventListener('canplay', markReady)

    var playPromise = video.play()

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function() {
        return
      })
    }

    return function() {
      video.removeEventListener('loadeddata', markReady)
      video.removeEventListener('canplay', markReady)
    }
  }, [src])

  return (
    <>
      <video
        ref={videoRef}
        className={className + ' background-video-media' + (isReady ? ' background-video-media-ready' : '')}
        autoPlay
        muted
        defaultMuted
        loop={shouldLoop}
        playsInline
        preload={preload}
        poster={poster || undefined}
      >
        <source src={src} type={type} />
      </video>
      {poster ? (
        <img
          className={className + ' background-video-poster' + (isReady ? ' background-video-poster-hidden' : '')}
          src={poster}
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      ) : null}
    </>
  )
}
