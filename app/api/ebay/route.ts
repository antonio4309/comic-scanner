export async function POST(req: Request) {
  try {
    const body = await req.json();

    const query = body.query;

    if (!query) {
      return Response.json({
        error: "No search query",
      });
    }

    const finalQuery = `
${query}
-facsimile
-reprint
-poster
-print
-shirt
-figure
-funkopop
`.trim();

    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
      finalQuery
    )}&LH_Sold=1&LH_Complete=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    const html = await response.text();

    // Better regex
    const regex =
      /£\s?([0-9]+(?:\.[0-9]{1,2})?)/g;

    const matches = [
      ...html.matchAll(regex),
    ];

    let prices = matches
      .map((m) => Number(m[1]))
      .filter(
        (p) =>
          !isNaN(p) &&
          p > 1 &&
          p < 100000
      );

    // Remove duplicates
    prices = [...new Set(prices)];

    // Remove outliers
    prices = prices.sort((a, b) => a - b);

    if (prices.length > 8) {
      prices = prices.slice(
        1,
        prices.length - 1
      );
    }

    let averagePrice = null;

    if (prices.length > 0) {
      averagePrice =
        prices.reduce(
          (sum, p) => sum + p,
          0
        ) / prices.length;
    }

    return Response.json({
      query: finalQuery,
      soldCount: prices.length,
      prices,
      averagePrice,
    });
  } catch (error) {
    console.error(
      "eBay route error:",
      error
    );

    return Response.json({
      error:
        error instanceof Error
          ? error.message
          : "eBay lookup failed",
    });
  }
}