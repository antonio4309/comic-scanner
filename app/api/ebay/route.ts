export async function POST(req: Request) {
  try {
    const body = await req.json();

    const query = body.query;

    if (!query) {
      return Response.json({
        error: "No search query",
      });
    }

    // Better balanced filters
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
          "Mozilla/5.0",
      },
    });

    const html = await response.text();

    // Extract GBP sold prices
    const matches = [
      ...html.matchAll(
        /"price":"GBP ([0-9.,]+)"/g
      ),
    ];

    let prices = matches
      .map((m) =>
        Number(
          m[1]
            .replace(/,/g, "")
            .trim()
        )
      )
      .filter(
        (p) =>
          !isNaN(p) &&
          p > 1 &&
          p < 100000
      );

    // Remove extreme outliers
    prices = prices.sort((a, b) => a - b);

    if (prices.length > 6) {
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