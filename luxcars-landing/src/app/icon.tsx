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
          fontSize: 18,
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f5d072',
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
          border: '2px solid #f5d072',
          borderRadius: '4px',
        }}
      >
        LC
      </div>
    ),
    {
      ...size,
    }
  )
}

