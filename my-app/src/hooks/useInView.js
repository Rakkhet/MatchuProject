import { useState, useRef, useEffect } from 'react'

export function useInView(threshold) {
  var t = threshold || 0.15
  var ref = useRef(null)
  var state = useState(false)
  var inView = state[0]
  var setInView = state[1]

  useEffect(function() {
    var el = ref.current
    if (!el) return
    var obs = new IntersectionObserver(
      function(entries) {
        if (entries[0].isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold: t }
    )
    obs.observe(el)
    return function() { obs.disconnect() }
  }, [t])

  return [ref, inView]
}
