import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const TRADE_PROMPTS = {
  electrical: `You are an experienced electrical inspector reviewing a job site photo for Ontario ESA compliance.
Analyze the image and provide observations about:
- Electrical panel condition (labelling, capacity, organization)
- Wiring quality (gauge, routing, junction box accessibility)
- Breaker labels and circuit identification
- GFCI/AFCI protection indicators
- Grounding and bonding connections
- Any visible code violations or safety concerns
Be specific and practical. Reference Ontario Electrical Safety Code where relevant.`,

  plumbing: `You are an experienced plumbing inspector reviewing a job site photo for Ontario Building Code compliance.
Analyze the image and provide observations about:
- Pipe condition and material (PEX, copper, ABS, PVC)
- Joint quality and connections
- Signs of water damage, leaks, or corrosion
- Drainage slope and cleanout access
- Backflow prevention devices
- Fixture condition and water efficiency
- Venting adequacy
Be specific and practical. Reference Ontario Building Code where relevant.`,

  roofing: `You are an experienced roofing inspector reviewing a job site photo for Ontario Building Code and MOL compliance.
Analyze the image and provide observations about:
- Shingle/membrane condition and installation quality
- Flashing around penetrations, edges, and valleys
- Drainage and gutter condition
- Underlayment visibility and condition
- Eave protection and ice dam prevention
- Safety equipment or fall protection visible
- Structural integrity indicators
Be specific and practical. Reference Ontario Building Code where relevant.`,
}

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('photo')
    const trade = formData.get('trade')

    if (!file || !trade) {
      return Response.json({ error: 'Photo and trade type are required' }, { status: 400 })
    }

    if (!TRADE_PROMPTS[trade]) {
      return Response.json({ error: 'Invalid trade type' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Determine media type
    const mimeType = file.type || 'image/jpeg'
    if (!mimeType.startsWith('image/')) {
      return Response.json({ error: 'File must be an image' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `${TRADE_PROMPTS[trade]}\n\nProvide your observations as a JSON array of strings, each being one concise observation (1-2 sentences max). Return ONLY the JSON array, no other text. Limit to 6 most important observations.`,
            },
          ],
        },
      ],
    })

    const text = response.content[0]?.text || '[]'
    // Parse the JSON array from Claude's response
    let observations
    try {
      // Handle case where Claude wraps in markdown code block
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      observations = JSON.parse(cleaned)
    } catch {
      // Fallback: split by newlines if JSON parsing fails
      observations = text
        .split('\n')
        .map((line) => line.replace(/^[-*\d.]+\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 6)
    }

    return Response.json({ observations })
  } catch (err) {
    console.error('Photo analysis error:', err)
    return Response.json(
      { error: 'Failed to analyze photo. Please try again.' },
      { status: 500 }
    )
  }
}
