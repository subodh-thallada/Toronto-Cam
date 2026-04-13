# Toronto Traffic Cam Photobooth

A dark-themed React + Vite webapp that renders Toronto's public traffic camera network on a Mapbox map. Click any camera pin to open the latest still image from the City of Toronto feed.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add your Mapbox public token:

```bash
cp .env.example .env
```

Set:

```bash
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_public_token_here
```

3. Start the app:

```bash
npm run dev
```

## Data source

The app uses:

- A bundled snapshot of the Toronto Open Data `traffic-cameras` GeoJSON for camera locations.
- The live `IMAGEURL` field for each camera popup image.

## Notes

- Camera images are refreshed by the City of Toronto every few minutes.
- If the browser has trouble reaching the live dataset endpoint, the bundled location snapshot keeps the map usable.
