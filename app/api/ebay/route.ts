import { NextResponse } from "next/server";

function isBadListing(title: string) {
  const lower = title.toLowerCase();

  const badWords = [
    "facsimile",
    "reprint",
    "poster",
    "print",
    "shirt",
    "figure",
    "funko",
    "pop",
    "dvd",
    "blu-ray",
    "sticker",
    "card",
  ];

  return badWords.some((word) => lower.includes(word));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = body.query;

    if (!query || query === "Unknown") {
      return NextResponse.json({
        query,
        soldCount: 0,
        prices: [],
        averagePrice: null,
        items: [],
      });
    }

    const credentials = Buffer.from(
      `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const tokenRes = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
      }
    );

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.json({
        error: "No eBay token",
        tokenData,
      });
    }

    const searchRes = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(
        query
      )}&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
        },
      }
    );

    const data = await searchRes.json();
    const items = data.itemSummaries || [];

    const filteredItems = items.filter((item: any) => {
      const title = item.title || "";
      const price = Number(item.price?.value);

      if (!price || price <= 0) return false;
      if (isBadListing(title)) return false;

      return true;
    });

    let prices = filteredItems
      .map((item: any) => Number(item.price?.value))
      .filter((price: number) => price > 1 && price < 100000);

    prices = prices.sort((a: number, b: number) => a - b);

    let averagePrice = null;

    if (prices.length > 0) {
      const index = Math.floor(prices.length * 0.3);
      averagePrice = prices[index];
    }

    return NextResponse.json({
      query,
      source: "eBay UK active listings conservative price",
      soldCount: prices.length,
      prices,
      averagePrice,
      items: filteredItems.slice(0, 10).map((item: any) => ({
        title: item.title,
        price: item.price,
        condition: item.condition,
        url: item.itemWebUrl,
        image: item.image?.imageUrl,
      })),
    });
  } catch (error) {
    console.error("eBay API Error:", error);

    return NextResponse.json({
      error: "eBay API failed",
    });
  }
}