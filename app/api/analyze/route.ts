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
      model: "gemini-2.5-flash-lite",
    });

    const result =
      await model.generateContent([
        `
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

Special case:
If you see a red/orange repeating 300 background with black suit Spider-Man, identify:
Title: The Amazing Spider-Man
Issue: 300
Publisher: Marvel
Year: 1988
`,
        {
          inlineData: {
            mimeType: "image/jpeg",
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
        result: JSON.stringify(
          fallbackResult(
            "AI returned invalid data"
          )
        ),
      });
    }
  } catch (error: any) {
    console.error(
      "Analyze Route Error:",
      error
    );

    let cleanMessage =
      "AI could not analyze image";

    if (
      error?.status === 429 ||
      String(error).includes(
        "Too Many Requests"
      )
    ) {
      cleanMessage =
        "AI quota reached. Please wait 1 minute and try again.";
    }

    return Response.json({
      result: JSON.stringify(
        fallbackResult(cleanMessage)
      ),
    });
  }
}