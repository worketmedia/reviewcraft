import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { businessName, overallRating, categoryRatings, selectedTags, additionalComment, location, businessDescription } = body

    if (!businessName) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }

    const systemPrompt = "You are a review writing assistant helping customers write detailed Google reviews. Write a genuine, natural-sounding review based on their feedback.\n\nRules:\n- Write in first person as the customer\n- Keep it 3-5 sentences\n- IMPORTANT: Naturally include the business name, location/area, and specific dish or service names in the review text. These are SEO keywords.\n- Mention the type of cuisine or business category naturally\n- Sound like a real person, not a template\n- Vary sentence structure and vocabulary every time\n- Never start with 'I recently visited' or 'I had the pleasure'\n- Never end with 'I highly recommend' or 'I can't wait to come back'\n- Use casual, warm language like a real Google review\n\nExample good review: 'The butter chicken at The Green Leaf Cafe in Navrangpura was hands down the best I've had in Ahmedabad. Staff was super friendly and the cozy vibe made it perfect for our family dinner. Great portions and very fairly priced — we'll be back for the biryani next time.'\n\nNotice how it includes: business name, area, city, specific dish names, ambiance description, and value mention — all naturally."

    let userPrompt = `Business: ${businessName}\nLocation: ${location || 'Not specified'}\nOverall Rating: ${overallRating} out of 5 stars\n`
    
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: 200,
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
