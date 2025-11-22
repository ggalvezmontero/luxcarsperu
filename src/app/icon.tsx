import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 20,
          background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#000000',
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
          letterSpacing: '-0.5px',
        }}
      >
        L
      </div>
    ),
    {
      ...size,
    }
  )
}

