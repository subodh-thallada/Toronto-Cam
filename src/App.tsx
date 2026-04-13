import { useEffect, useRef, useState } from 'react'
import mapboxgl, { LngLatBounds } from 'mapbox-gl'
import './App.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
const CAMERA_SOURCE_URL = '/traffic-camera-list-4326.geojson'

type CameraProperties = {
  REC_ID: number
  IMAGEURL: string
  MAINROAD: string
  CROSSROAD: string
  DIRECTION1?: string
  DIRECTION2?: string
  DIRECTION3?: string
  DIRECTION4?: string
}

type CameraCollection = GeoJSON.FeatureCollection<
  GeoJSON.MultiPoint,
  CameraProperties
>

function formatIntersection(camera: CameraProperties) {
  return `${camera.MAINROAD} & ${camera.CROSSROAD}`
}

function createCameraPopupContent(
  camera: CameraProperties,
  onStatusChange: (message: string) => void,
) {
  const article = document.createElement('article')
  article.className = 'cam-popup'

  const eyebrow = document.createElement('p')
  eyebrow.className = 'cam-popup__eyebrow'
  eyebrow.textContent = `Live traffic camera #${camera.REC_ID}`

  const title = document.createElement('h3')
  title.className = 'cam-popup__title'
  title.textContent = formatIntersection(camera)

  const status = document.createElement('p')
  status.className = 'cam-popup__status'
  status.textContent = 'Loading latest still...'

  const image = document.createElement('img')
  image.className = 'cam-popup__image'
  image.alt = `Toronto traffic camera at ${formatIntersection(camera)}`
  image.loading = 'eager'
  image.decoding = 'async'

  image.addEventListener('load', () => {
    status.textContent = ''
    onStatusChange(`Loaded image for camera #${camera.REC_ID}`)
  })

  image.addEventListener(
    'error',
    () => {
      status.textContent = 'Latest image unavailable right now.'
      onStatusChange(`Image failed for camera #${camera.REC_ID}`)
    },
    { once: true },
  )

  onStatusChange(`Requesting image for camera #${camera.REC_ID}`)
  image.src = camera.IMAGEURL

  article.append(eyebrow, title, status, image)
  return article
}

function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [cameraCount, setCameraCount] = useState(0)
  const [lastUpdated, setLastUpdated] = useState('')
  const [error, setError] = useState('')
  const [interactionStatus, setInteractionStatus] = useState(
    'Waiting for map interaction',
  )

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !MAPBOX_TOKEN) {
      return
    }

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-79.3832, 43.6532],
      zoom: 10.4,
      attributionControl: false,
    })

    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

    const loadCameras = async () => {
      try {
        const response = await fetch(CAMERA_SOURCE_URL)
        if (!response.ok) {
          throw new Error(`Camera request failed with status ${response.status}`)
        }

        const data = (await response.json()) as CameraCollection
        const bounds = new LngLatBounds()

        markersRef.current.forEach((marker) => marker.remove())
        markersRef.current = []

        data.features.forEach((feature) => {
          const [lng, lat] = feature.geometry.coordinates[0] ?? []
          if (typeof lng !== 'number' || typeof lat !== 'number') {
            return
          }

          bounds.extend([lng, lat])

          const camera = feature.properties
          const markerElement = document.createElement('button')
          markerElement.type = 'button'
          markerElement.className = 'cam-marker'
          markerElement.setAttribute(
            'aria-label',
            `Open camera ${camera.REC_ID} at ${formatIntersection(camera)}`,
          )

          markerElement.addEventListener('mouseenter', () => {
            setInteractionStatus(`Hovering camera #${camera.REC_ID}`)
          })

          markerElement.addEventListener('click', () => {
            const clickMessage = `Clicked camera #${camera.REC_ID}`
            setInteractionStatus(clickMessage)
            console.info('[Toronto Traffic Cam Photobooth]', clickMessage, camera)

            popupRef.current?.remove()
            popupRef.current = new mapboxgl.Popup({
              closeButton: true,
              closeOnClick: false,
              maxWidth: '340px',
              offset: 18,
            })
              .setLngLat([lng, lat])
              .setDOMContent(
                createCameraPopupContent(camera, (message) => {
                  setInteractionStatus(message)
                  console.info('[Toronto Traffic Cam Photobooth]', message, camera)
                }),
              )
              .addTo(map)
          })

          const marker = new mapboxgl.Marker({
            element: markerElement,
            anchor: 'center',
          })
            .setLngLat([lng, lat])
            .addTo(map)

          markersRef.current.push(marker)
        })

        setCameraCount(data.features.length)
        setLastUpdated(new Date().toLocaleString())
        setInteractionStatus(`Loaded ${data.features.length} camera markers`)

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, {
            padding: 72,
            duration: 1200,
            maxZoom: 12.5,
          })
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load Toronto camera data right now.'
        setError(message)
        setInteractionStatus('Camera locations failed to load')
      }
    }

    map.on('load', () => {
      void loadCameras()
    })

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="hero-panel__kicker">Toronto Traffic Cam Photobooth</p>
        <h1>Live Toronto traffic cameras on a dark Mapbox canvas.</h1>
        <p className="hero-panel__lede">
          Browse the city, click any glowing pin, and pop open the latest camera
          still from Toronto Open Data.
        </p>

        <div className="hero-panel__stats">
          <div>
            <span>Cameras loaded</span>
            <strong>{cameraCount || '...'}</strong>
          </div>
          <div>
            <span>Data refresh</span>
            <strong>{lastUpdated || 'Waiting for feed'}</strong>
          </div>
          <div>
            <span>Last interaction</span>
            <strong>{interactionStatus}</strong>
          </div>
        </div>

        <p className="hero-panel__note">
          Camera dots are lightweight location markers only. The image request is sent
          only after you click a camera.
        </p>

        {!MAPBOX_TOKEN ? (
          <div className="status-card status-card--warning">
            Add your Mapbox token to <code>.env</code> as{' '}
            <code>VITE_MAPBOX_ACCESS_TOKEN=...</code> to render the map.
          </div>
        ) : null}

        {error ? <div className="status-card status-card--error">{error}</div> : null}
      </section>

      <section className="map-panel">
        <div className="map-panel__frame">
          <div ref={mapContainerRef} className="map-panel__map" />
        </div>
      </section>
    </main>
  )
}

export default App
