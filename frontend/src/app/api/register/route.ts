export async function POST(request: Request) {
  const body = await request.json()
  const primaryUrl = process.env.NEXT_PUBLIC_API_URL || 'https://smartlivestock-xkx4.onrender.com'
  const fallbackUrl = process.env.NEXT_PUBLIC_FALLBACK_API_URL || 'http://localhost:8000'

  try {
    const res = await fetch(`${primaryUrl}/api/users/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    // If Render backend is down or unreachable, fall back to local Django
    try {
      const res = await fetch(`${fallbackUrl}/api/users/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      return Response.json(data, { status: res.status })
    } catch {
      return Response.json(
        { detail: 'Unable to reach backend servers. Both cloud and local services are offline.' },
        { status: 503 }
      )
    }
  }
}
