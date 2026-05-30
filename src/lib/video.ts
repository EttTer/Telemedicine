export async function createDailyRoom(roomName: string) {
  // In dev environment with mock flag, return a fake room
  if (process.env.NEXT_PUBLIC_MOCK_EXTERNAL_SERVICES === 'true') {
    return {
      url: `https://fake-daily-domain.daily.co/${roomName}`,
      name: roomName,
    }
  }

  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey) {
    throw new Error('DAILY_API_KEY is missing')
  }

  const response = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name: roomName,
      privacy: 'private', // We will use tokens to let users in
      properties: {
        enable_chat: false, // Simple MVP, no chat
        enable_screenshare: true,
        start_video_off: false,
        start_audio_off: false,
        enable_recording: 'none', // Strictly disable recording for MVP
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Daily.co API error: ${error.info || response.statusText}`)
  }

  return response.json()
}

export async function createDailyToken(roomName: string, isOwner: boolean = false) {
  if (process.env.NEXT_PUBLIC_MOCK_EXTERNAL_SERVICES === 'true') {
    return 'fake-token-123'
  }

  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey) {
    throw new Error('DAILY_API_KEY is missing')
  }

  const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        is_owner: isOwner,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Daily.co API error: ${error.info || response.statusText}`)
  }

  const data = await response.json()
  return data.token
}
