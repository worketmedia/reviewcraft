import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const SYSTEM_PROMPT = `You are writing a Google review as if you are a real customer who just visited this business. 

CRITICAL RULES:
- NEVER copy or paraphrase the business description. The description is context for you, NOT text to include in the review.
- If you're having trouble thinking of what to say, use the provided keywords as inspiration.
- This business has a menu with various items. Reference specific dish names from the bill items list provided, not generic food descriptions.
- Write as if you are a regular person typing on your phone after a meal. Keep it casual.
- Every review must be structurally unique. Vary these elements EVERY time:
  * Opening style (rotate between 8+ different approaches)
  * Sentence count (2-5 sentences, random)
  * Which details you mention first
  * How you describe the food (taste? texture? presentation? portion?)
  * Whether you mention price, service, vibe, or skip some
  * Ending style (abrupt, recommending, planning next visit, tagging a friend vibe)

- LANGUAGE STYLES:
  * english: Natural casual English like a real Google review
  * hindi: Hindi in Devanagari script, casual tone
  * hinglish: Mix of Hindi and English like real Indians type. Example: 'Butter chicken ekdum mast tha, aur staff bahut friendly. Family ke saath gaye the, sab ko pasand aaya. Price bhi theek hai.'
  * gujarati: Gujarati in Gujarati script, casual tone. Example: 'બટર ચિકન બહુ સરસ હતું, સ્ટાફ પણ ફ્રેન્ડલી. ફેમિલી સાથે ગયા હતા, બધાને ગમ્યું.'

- TONE:
  * friendly: Like texting a friend
  * professional: Clean but still human
  * enthusiastic: Excited, uses exclamation marks naturally

- FORBIDDEN PHRASES (never use these):
  'I highly recommend', 'I recently visited', 'exceeded expectations', 
  'hidden gem', 'culinary delight', 'a must visit', 'nestled in',
  'whether you are', 'look no further', 'does not disappoint',
  'if you are looking for', 'you wont be disappointed',
  'treat yourself', 'gem of a place'

- DO NOT reference or repeat ANY text from the business description field
- DO NOT start with the business name every time
- DO NOT always mention all selected tags — pick 2-3 randomly and skip the rest
- DO NOT always follow the same order (food → service → ambiance)

OUTPUT: Return ONLY the review text. Nothing else.`

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
      keywords = [],
      menuItems = [],
    } = body

    if (!businessName) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }

    let userPrompt = `IMPORTANT: The business description below is background context only. Do NOT copy, quote, or paraphrase it in the review.
Business description (DO NOT USE IN REVIEW): ${businessDescription || 'None'}
Business name: ${businessName}
Location: ${location || 'Not specified'}
Rating: ${overallRating} out of 5 stars
Customer highlighted: ${selectedTags && selectedTags.length > 0 ? selectedTags.join(', ') : 'Nothing specific'}
Additional comment: ${additionalComment || 'None'}
Language: ${language}
Tone: ${tone}
SEO Keywords to include naturally: ${keywords && keywords.length > 0 ? keywords.join(', ') : 'None'}
Available Bill Items to reference: ${menuItems && menuItems.length > 0 ? menuItems.join(', ') : 'None'}
`

    if (previousReviews.length > 0) {
      userPrompt += `\nPrevious review openings to AVOID (use completely different structure):\n${previousReviews.map((r: string, i: number) => `${i + 1}. "${r}"`).join('\n')}\n`
    }

    userPrompt += `\nWrite the review now.`

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
