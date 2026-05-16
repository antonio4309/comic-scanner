import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || ""
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const image = body.image;

    if (!image || !image.includes(",")) {
      return Response.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    const result = await model.generateContent([
      `
Analyze this comic book cover.

Return ONLY valid JSON.
No markdown.
No code blocks.

Use this exact format:

{
  "title": "Unknown",
  "issue": "Unknown",
  "publisher": "Unknown",
  "year": "Unknown",
  "variant": "",
  "keyInfo": "Unknown",
  "importantCharacters": "Unknown",
  "confidence": "High, Medium, or Low",
  "condition": "Unknown",
  "conditionReason": "Unknown",
  "ebaySearchQuery": "Unknown"
}

Condition options:
- Near Mint
- Very Fine
- Fine
- Very Good
- Good
- Fair
- Poor
- Unknown

Rules:
- Estimate condition from visible cover only.
- Mention visible defects: spine ticks, creases, tears, stains, rounded corners, fading, writing, missing pieces.
- Do NOT use cover price as value.
- If unsure, use "Unknown".
- ebaySearchQuery should be short and clean.
Example:
"Amazing Spider-Man 300 Marvel 1988"
      `,
      {
        inlineData: {
          mimeType: image.startsWith("data:image/png")
            ? "image/png"
            : "image/jpeg",
          data: image.split(",")[1],
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    return Response.json({
      result: text,
    });
  } catch (error) {
    console.error("Gemini error:", error);

    return Response.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}