import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const SYSTEM_PROMPT = `You generate 3 unique, short Google reviews (2-3 sentences each) for a business. These are "ready to use" template reviews.

LANGUAGE:
- If english: Natural, casual English
- If hindi: Hindi using Devanagari script
- If hinglish: Casual Hinglish like real Indian Google reviews. Mix Hindi and English naturally.

UNIQUENESS RULES (CRITICAL):
- Each of the 3 reviews MUST have a completely different opening style:
  * Review 1: Start with specific item/dish mention
  * Review 2: Start with occasion or who you went with
  * Review 3: Start with location/discovery angle
- Each review should highlight DIFFERENT items/tags from the provided list
- Vary vocabulary across all 3: never repeat 'delicious', 'amazing', etc. in multiple reviews
- NEVER use: 'I highly recommend', 'I recently visited', 'exceeded expectations', 'hidden gem', 'culinary delight', 'a must visit'
- Include the business name and area naturally in each review
- Keep each review 2-3 sentences only — short and punchy

OUTPUT: Return a JSON array of exactly 3 strings. Example:
["review 1 text", "review 2 text", "review 3 text"]
Return ONLY the JSON array. No markdown, no explanation, no code fences.`

export async function POST(req: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  try {
    const body = await req.json()
    const {
      businessName,
      city,
      area,
      category,
      menuItems = [],
      highlightTags = [],
      language = 'english',
    } = body

    if (!businessName) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }

    const userPrompt = `Business: ${businessName}
City: ${city || 'Not specified'}
Area: ${area || 'Not specified'}
Category: ${category || 'Restaurant'}
Language: ${language}
Menu Items / Services: ${menuItems.length > 0 ? menuItems.join(', ') : 'Not specified'}
Highlight Tags: ${highlightTags.length > 0 ? highlightTags.join(', ') : 'Not specified'}

Generate 3 unique short reviews as a JSON array.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.95,
      max_tokens: 500,
    })

    const raw = completion.choices[0]?.message?.content?.trim() || '[]'

    let reviews: string[]
    try {
      reviews = JSON.parse(raw)
      if (!Array.isArray(reviews)) throw new Error('Not an array')
    } catch {
      // Fallback: split by newlines if JSON parse fails
      reviews = raw
        .replace(/^\[|\]$/g, '')
        .split(/",\s*"/)
        .map(s => s.replace(/^"|"$/g, '').trim())
        .filter(Boolean)
        .slice(0, 3)
    }

    return NextResponse.json({ reviews })
  } catch (error: any) {
    console.error('Error generating quick reviews:', error)
    return NextResponse.json(
      { error: 'Failed to generate quick reviews' },
      { status: 500 }
    )
  }
}
