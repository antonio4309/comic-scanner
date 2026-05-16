import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const image = body.image;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    const result = await model.generateContent([
      `
Identify this comic book cover.

Do NOT include the original cover price.

Return ONLY valid JSON in this exact format:

{
  "title": "",
  "issue": "",
  "publisher": "",
  "year": "",
  "variant": "",
  "keyInfo": "",
  "ebaySearchQuery": ""
}

For ebaySearchQuery, use only:
title + issue number + publisher + year if known.
Example:
"Amazing Spider-Man 300 Marvel 1988"
      `,
      {
        inlineData: {
          mimeType: "image/jpeg",
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
    console.error(error);

    return Response.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
