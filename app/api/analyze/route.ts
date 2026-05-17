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
        result: JSON.stringify(
          fallbackResult("No image was received by the AI scanner.")
        ),
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
No extra text.

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
- Always return JSON even if unsure.
- Never throw an error because the image is unclear.
- Estimate condition from the visible front cover only.
- Condition must be one of:
  Near Mint, Very Fine, Fine, Very Good, Good, Fair, Poor, Unknown
- Do not use the cover price as value.
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

    const response = await result.response;
    const text = response.text();

    if (!text) {
      return Response.json({
        result: JSON.stringify(
          fallbackResult("AI returned no text for this image.")
        ),
      });
    }

    return Response.json({
      result: text,
    });
  } catch (error) {
    console.error("Gemini error:", error);

    return Response.json({
      result: JSON.stringify(
        fallbackResult("AI could not analyze this image. Try a clearer photo.")
      ),
    });
  }
}