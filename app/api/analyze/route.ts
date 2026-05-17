import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

function fallbackResult(reason: string) {
  return {
    title: "Unknown",
    issue: "Unknown",
    publisher: "Unknown",
    year: "Unknown",
    variant: "",
    keyInfo: reason,
    importantCharacters: "Unknown",
    confidence: "Low",
    condition: "Unknown",
    conditionReason: reason,
    ebaySearchQuery: "Unknown",
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const image = body.image;

    if (!image || !image.includes(",")) {
      return Response.json({
        result: JSON.stringify(fallbackResult("No image provided")),
      });
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
  "confidence": "Low",
  "condition": "Unknown",
  "conditionReason": "Unknown",
  "ebaySearchQuery": "Unknown"
}

Rules:
- Identify the comic using visible cover text and cover art.
- This may be a famous comic cover. Use visual recognition too.
- If the cover has red/orange repeating 300 background with black costume Spider-Man, identify as The Amazing Spider-Man #300, Marvel, 1988.
- Always return JSON.
- Condition must be one of:
  Near Mint, Very Fine, Fine, Very Good, Good, Fair, Poor, Unknown
- Estimate condition from visible cover.
- Do not use cover price as value.
- ebaySearchQuery should be title + issue + publisher + year.
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

    let text = result.response.text();

    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      const parsed = JSON.parse(text);

      return Response.json({
        result: JSON.stringify(parsed),
      });
    } catch {
      return Response.json({
        result: JSON.stringify(fallbackResult("AI returned invalid JSON")),
      });
    }
  } catch (error) {
    console.error("Analyze Route Error:", error);

    return Response.json({
      result: JSON.stringify(
        fallbackResult(
          error instanceof Error ? error.message : "AI could not analyze image"
        )
      ),
    });
  }
}