import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || ""
);

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
          fallbackResult("No image provided")
        ),
      });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
Analyze this comic book cover.

Return ONLY valid JSON.

{
  "title": "",
  "issue": "",
  "publisher": "",
  "year": "",
  "variant": "",
  "keyInfo": "",
  "importantCharacters": "",
  "confidence": "",
  "condition": "",
  "conditionReason": "",
  "ebaySearchQuery": ""
}

Rules:
- Identify comic title and issue number.
- Identify publisher and year.
- Detect key issue info.
- Estimate comic condition from visible front cover.
- Condition must be:
Near Mint, Very Fine, Fine, Very Good, Good, Fair, Poor, Unknown
- ebaySearchQuery should contain title + issue + publisher + year.
`;

    const result =
      await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: image.split(",")[1],
          },
        },
      ]);

    const response = result.response;

    let text = response.text();

    if (!text) {
      return Response.json({
        result: JSON.stringify(
          fallbackResult(
            "Gemini returned empty response"
          )
        ),
      });
    }

    // CLEAN RESPONSE
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      const parsed = JSON.parse(text);

      return Response.json({
        result: JSON.stringify(parsed),
      });
    } catch (jsonError) {
      console.error(
        "JSON Parse Error:",
        text
      );

      return Response.json({
        result: JSON.stringify(
          fallbackResult(
            "Gemini returned invalid JSON"
          )
        ),
      });
    }
  } catch (error) {
    console.error(
      "Analyze Route Error:",
      error
    );

    return Response.json({
      result: JSON.stringify(
        fallbackResult(
          "AI could not analyze image"
        )
      ),
    });
  }
}