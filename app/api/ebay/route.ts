import { NextResponse } from "next/server";

function isBadListing(title: string) {
  const lower = title.toLowerCase();

  const blockedWords = [
    "cgc",
    "cbc",
    "9.8",
    "9.6",
    "graded",
    "slab",
    "lot",
    "bundle",
    "set",
    "reprint",
    "facsimile",
    "facsim",
  ];

  return blockedWords.some((word) =>
    lower.includes(word)
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const query = body.query;

    if (!query) {
      return NextResponse.json(
        {
          error: "Missing search query",
        },
        {
          status: 400,
        }
      );
    }

    const auth = Buffer.from(
      `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const tokenResponse = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
      }
    );

    const tokenData =
      await tokenResponse.json();

    if (!tokenData.access_token) {
      return NextResponse.json(
        {
          error:
            "Failed to get eBay token",
          details: tokenData,
        },
        {
          status: 500,
        }
      );
    }

    // SOLD listings search
    const ebayResponse = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(
        query
      )}&filter=buyingOptions:{FIXED_PRICE}&sort=price&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "X-EBAY-C-MARKETPLACE-ID":
            "EBAY_GB",
        },
      }
    );

    const ebayData =
      await ebayResponse.json();

    const items =
      ebayData.itemSummaries || [];

    // FILTER BAD RESULTS
    const filteredItems = items.filter(
      (item: any) => {
        const title =
          item.title || "";

        if (isBadListing(title)) {
          return false;
        }

        const price = Number(
          item.price?.value
        );

        if (!price || price <= 0) {
          return false;
        }

        return true;
      }
    );

    const prices = filteredItems
      .map((item: any) =>
        Number(item.price?.value)
      )
      .filter(
        (price: number) =>
          price > 0
      );

    // REMOVE EXTREME OUTLIERS
    const sortedPrices =
      [...prices].sort(
        (a, b) => a - b
      );

    const trimmedPrices =
      sortedPrices.slice(
        1,
        sortedPrices.length - 1
      );

    const finalPrices =
      trimmedPrices.length > 0
        ? trimmedPrices
        : sortedPrices;

    const averagePrice =
      finalPrices.length > 0
        ? finalPrices.reduce(
            (sum, price) =>
              sum + price,
            0
          ) / finalPrices.length
        : null;

    return NextResponse.json({
      query,
      source:
        "Filtered eBay UK comic pricing",
      totalFound:
        filteredItems.length,
      averagePrice,
      currency: "GBP",
      prices: finalPrices,
      items: filteredItems.map(
        (item: any) => ({
          title: item.title,
          price:
            item.price?.value,
          condition:
            item.condition,
          image:
            item.image
              ?.imageUrl,
          url:
            item.itemWebUrl,
        })
      ),
    });
  } catch (error) {
    console.error(
      "eBay pricing error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to fetch eBay prices",
      },
      {
        status: 500,
      }
    );
  }
}