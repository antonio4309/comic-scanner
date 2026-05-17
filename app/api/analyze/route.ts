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

function cleanJsonText(text: string) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

async function tryAnalyzeWithModel(modelName: string, image: string) {
  const model = genAI.getGenerativeModel({
    model: modelName,
  });

  const prompt = `
Analyze this comic book cover.

Return ONLY valid JSON. No markdown. No explanation.

Use this exact JSON shape:

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

Important:
- Identify the comic title and issue number from the cover.
- Estimate condition from visible front cover.
- Condition must be one of: Near Mint, Very Fine, Fine, Very Good, Good, Fair, Poor, Unknown.
- Do not use cover price as value.
- ebaySearchQuery should be title + issue + publisher + year.
`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: image.startsWith("data:image/png")
          ? "image/png"
          : "image/jpeg",
        data: image.split(",")[1],
      },
    },
  ]);

  const text = cleanJsonText(result.response.text());

  const parsed = JSON.parse(text);

  return parsed;
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

    const models = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ];

    let lastError = "";

    for (const modelName of models) {
      try {
        const parsed = await tryAnalyzeWithModel(modelName, image);

        return Response.json({
          result: JSON.stringify(parsed),
          modelUsed: modelName,
        });
      } catch (error) {
        console.error(`Model failed: ${modelName}`, error);
        lastError =
          error instanceof Error ? error.message : "Unknown Gemini error";
      }
    }

    return Response.json({
      result: JSON.stringify(
        fallbackResult(`All Gemini models failed: ${lastError}`)
      ),
    });
  } catch (error) {
    console.error("Analyze route failed:", error);

    return Response.json({
      result: JSON.stringify(
        fallbackResult(
          error instanceof Error ? error.message : "Analyze route failed"
        )
      ),
    });
  }
}