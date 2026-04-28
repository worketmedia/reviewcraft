import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const SYSTEM_PROMPT = `You write Google reviews on behalf of real customers based on their feedback. Your reviews must sound like a real person wrote them on their phone after a meal.

LANGUAGE:
- If english: Write in natural, casual English
- If hindi: Write in Hindi using Devanagari script
- If hinglish: Write in casual Hinglish like real Indian Google reviews. Mix Hindi and English naturally. Example: 'Butter chicken bahut accha tha, staff bhi friendly. Family ke saath gaye the, everyone loved it. Price bhi reasonable hai.'

TONE:
- If friendly: Casual, warm, like texting a friend about a good meal
- If professional: Clean and polished but still natural
- If enthusiastic: High energy, exclamation marks, genuine excitement

UNIQUENESS RULES (CRITICAL):
- Never start two reviews the same way. Rotate between:
  * Starting with the dish: 'The butter chicken at [name]...'
  * Starting with occasion: 'Went with family to [name]...'
  * Starting with discovery: 'Finally tried [name]...'
  * Starting with location: 'Best place in [area] for...'
  * Starting with comparison: 'Been to many [category] in [city] but...'
  * Starting with emotion: 'What a find!'
  * Starting with recommendation: 'A colleague suggested...'
- Vary vocabulary: never repeat 'delicious' in every review. Use: 'fantastic', 'solid', 'really good', 'nailed it', 'worth every bite', 'on point', 'paisa vasool'
- Mix review lengths: some 2 sentences, some 4-5 sentences
- NEVER use: 'I highly recommend', 'I recently visited', 'exceeded expectations', 'hidden gem', 'culinary delight', 'a must visit'
- Include the business name, area, and specific items naturally
- If previousReviews are provided, use COMPLETELY different openings and structures

OUTPUT: Return only the review text. No quotes, no explanation.`

export async function POST(req: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  try {
    const body = await req.json()
    const {
      businessName,
      overallRating,
      categoryRatings,
      selectedTags,
      additionalComment,
      location,
      businessDescription,
      language = 'english',
      tone = 'friendly',
      previousReviews = [],
    } = body

    if (!businessName) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }

    let userPrompt = `Business: ${businessName}
Location: ${location || 'Not specified'}
Overall Rating: ${overallRating} out of 5 stars
Language: ${language}
Tone: ${tone}
`

    if (businessDescription) {
      userPrompt += `Business Description / Context: ${businessDescription}\n`
    }
    if (categoryRatings && Object.keys(categoryRatings).length > 0) {
      userPrompt += `Category Ratings: ${JSON.stringify(categoryRatings)}\n`
    }
    if (selectedTags && selectedTags.length > 0) {
      userPrompt += `Highlights selected by customer: ${selectedTags.join(', ')}\n`
    }
    if (additionalComment) {
      userPrompt += `Additional Comment: "${additionalComment}"\n`
    }
    if (previousReviews.length > 0) {
      userPrompt += `\nPrevious review openings to AVOID (use completely different structure):\n${previousReviews.map((r: string, i: number) => `${i + 1}. "${r}"`).join('\n')}\n`
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.95,
      max_tokens: 250,
    })

    const review = completion.choices[0]?.message?.content?.trim() || ''

    return NextResponse.json({ review })
  } catch (error: any) {
    console.error('Error generating review:', error)
    return NextResponse.json(
      { error: 'Failed to generate review' },
      { status: 500 }
    )
  }
}
