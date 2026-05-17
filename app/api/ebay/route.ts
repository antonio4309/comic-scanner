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
        totalFound: 0,
        count: 0,
        averagePrice: null,
        currency: "GBP",
        items: [],
      });
    }

    const auth = Buffer.from(
      `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const tokenRes = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return NextResponse.json({
        error: "Could not get eBay token",
        details: tokenData,
      });
    }

    const ebayRes = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(
        query
      )}&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
        },
      }
    );

    const ebayData = await ebayRes.json();

    const items = ebayData.itemSummaries || [];

    const filteredItems = items.filter((item: any) => {
      const title = item.title || "";
      const price = Number(item.price?.value);

      if (!price || price <= 0) return false;
      if (isBadListing(title)) return false;

      return true;
    });

    let prices = filteredItems
      .map((item: any) => Number(item.price?.value))
      .filter((price: number) => price > 0);

    prices = prices.sort((a: number, b: number) => a - b);

    if (prices.length > 6) {
      prices = prices.slice(1, prices.length - 1);
    }

    const averagePrice =
      prices.length > 0
        ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length
        : null;

    return NextResponse.json({
      query,
      source: "eBay UK active listings average",
      totalFound: ebayData.total || 0,
      count: filteredItems.length,
      averagePrice,
      currency: "GBP",
      prices,
      items: filteredItems.slice(0, 10).map((item: any) => ({
        title: item.title,
        price: item.price,
        condition: item.condition,
        url: item.itemWebUrl,
        image: item.image?.imageUrl,
      })),
    });
  } catch (error) {
    console.error("eBay API error:", error);

    return NextResponse.json(
      { error: "eBay request failed" },
      { status: 500 }
    );
  }
}