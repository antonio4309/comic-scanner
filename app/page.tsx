"use client";

import { useState } from "react";

type ComicResult = {
  image: string;
  imageUrl: string;
  comic: any;
  ebayAverage: number | null;
  whatnotPrice: number | null;
  ebayDebug: any;
  searchQuery: string;
};

async function compressImage(
  file: File
): Promise<{
  file: Blob;
  dataUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const img = new Image();

    reader.onload = () => {
      img.src = reader.result as string;
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxWidth = 1200;
      const scale = maxWidth / img.width;

      canvas.width = maxWidth;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas failed"));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }

          resolve({
            file: blob,
            dataUrl,
          });
        },
        "image/jpeg",
        0.75
      );
    };

    reader.onerror = () => reject(new Error("Reader failed"));
    img.onerror = () => reject(new Error("Image failed"));

    reader.readAsDataURL(file);
  });
}

function calculateWhatnotPrice(ebayAverage: number | null) {
  if (!ebayAverage || ebayAverage <= 0) return null;

  return Math.ceil(ebayAverage * 1.15);
}

function getSubcategory(year: string) {
  const numericYear = Number(year);

  if (!numericYear || Number.isNaN(numericYear)) {
    return "Modern Comics";
  }

  return numericYear < 1985 ? "Vintage Comics" : "Modern Comics";
}

function cleanCSVValue(value: any) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/"/g, '""')
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

function csvCell(value: any) {
  return `"${cleanCSVValue(value)}"`;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [results, setResults] = useState<ComicResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Choose comics to scan.");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;

    if (!selectedFiles || selectedFiles.length === 0) {
      setStatus("No image selected.");
      return;
    }

    const fileArray = Array.from(selectedFiles);

    setFiles(fileArray);
    setPreviews(fileArray.map((file) => URL.createObjectURL(file)));
    setResults([]);

    setStatus(`${fileArray.length} image selected.`);
  }

  async function uploadImageToBlob(file: Blob, filename: string) {
    const response = await fetch("/api/upload-image", {
      method: "POST",
      headers: {
        "x-filename": filename,
      },
      body: file,
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data.url as string;
  }

  async function analyzeComics() {
    if (files.length === 0) {
      setStatus("Please choose at least one image.");
      return;
    }

    setLoading(true);
    setResults([]);

    const finalResults: ComicResult[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        setStatus(`Scanning comic ${i + 1} of ${files.length}...`);

        const compressed = await compressImage(files[i]);

        const imageUrl = await uploadImageToBlob(
          compressed.file,
          `comic-${Date.now()}-${i + 1}.jpg`
        );

        const analyzeResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image: compressed.dataUrl,
          }),
        });

        const analyzeData = await analyzeResponse.json();

        if (analyzeData.error) {
          throw new Error(analyzeData.error);
        }

        const cleanJson = analyzeData.result
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const comicData = JSON.parse(cleanJson);

        const searchQuery =
          comicData.ebaySearchQuery && comicData.ebaySearchQuery !== "Unknown"
            ? comicData.ebaySearchQuery
            : `${comicData.title} ${comicData.issue}`;

        const ebayResponse = await fetch("/api/ebay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: searchQuery,
          }),
        });

        const ebayData = await ebayResponse.json();

        const ebayAverage =
          ebayData.averagePrice && ebayData.averagePrice > 0
            ? Number(ebayData.averagePrice)
            : null;

        const whatnotPrice = calculateWhatnotPrice(ebayAverage);

        finalResults.push({
          image: previews[i],
          imageUrl,
          comic: comicData,
          ebayAverage,
          whatnotPrice,
          ebayDebug: ebayData,
          searchQuery,
        });

        setResults([...finalResults]);
      }

      setStatus("Finished scanning.");
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "Something went wrong");
    }

    setLoading(false);
  }

  function exportWhatnotCSV() {
    if (results.length === 0) {
      setStatus("No comics available to export.");
      return;
    }

    const headers = [
      "Category",
      "Subcategory",
      "Title",
      "Description",
      "Quantity",
      "Type",
      "Price",
      "Shipping Profile",
      "Offerable",
      "Hazmat",
      "Condition",
      "Cost Per Item",
      "Sku",
      "Image URL 1",
      "Image URL 2",
      "Image URL 3",
      "Image URL 4",
      "Image URL 5",
      "Image URL 6",
      "Image URL 7",
      "Image URL 8",
    ];

    const rows = results.map((item) => {
      const title = `${item.comic.title || "Unknown"} #${
        item.comic.issue || ""
      }`.trim();

      const description =
        item.comic.keyInfo ||
        item.comic.keyReason ||
        "Comic book listing";

      return [
        "Comics & Manga",
        getSubcategory(item.comic.year),
        title,
        description,
        "1",
        "Buy it Now",
        item.whatnotPrice || "",
        "Bagged and boarded raw comic",
        "Yes",
        "Not Hazmat",
        item.comic.condition || "Very Fine",
        "",
        "",
        item.imageUrl || "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ];
    });

    const csvRows = [
      headers.map(csvCell).join(","),
      ...rows.map((row) => row.map(csvCell).join(",")),
    ];

    const csvContent = csvRows.join("\r\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "whatnot-comics.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setStatus("Whatnot CSV exported.");
  }

  return (
    <main className="min-h-screen bg-black text-white p-5">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold mb-3">Comic Scanner AI</h1>

        <p className="text-zinc-400 mb-8">
          AI comic scanner for Whatnot UK sellers.
        </p>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="w-full bg-white text-black p-4 rounded-xl"
          />

          <button
            onClick={analyzeComics}
            disabled={loading}
            className="w-full mt-5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-xl"
          >
            {loading ? "Scanning..." : "Analyze"}
          </button>

          {results.length > 0 && (
            <button
              onClick={exportWhatnotCSV}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-xl"
            >
              Export Whatnot CSV
            </button>
          )}

          <p className="mt-5 text-zinc-300">{status}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-8">
          {results.map((item, index) => (
            <div
              key={index}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden"
            >
              <img
                src={item.image}
                alt="Comic"
                className="w-full h-[500px] object-cover"
              />

              <div className="p-5">
                <h2 className="text-3xl font-bold mb-4">
                  {item.comic.title} #{item.comic.issue}
                </h2>

                <p>
                  <strong>Category:</strong> Comics & Manga
                </p>

                <p>
                  <strong>Subcategory:</strong>{" "}
                  {getSubcategory(item.comic.year)}
                </p>

                <p>
                  <strong>Publisher:</strong>{" "}
                  {item.comic.publisher || "Unknown"}
                </p>

                <p>
                  <strong>Year:</strong> {item.comic.year || "Unknown"}
                </p>

                <p>
                  <strong>Condition:</strong>{" "}
                  {item.comic.condition || "Unknown"}
                </p>

                <p>
                  <strong>Condition Reason:</strong>{" "}
                  {item.comic.conditionReason || "Unknown"}
                </p>

                <p>
                  <strong>Key Info:</strong>{" "}
                  {item.comic.keyInfo || item.comic.keyReason || "Unknown"}
                </p>

                <p>
                  <strong>Image URL:</strong>{" "}
                  {item.imageUrl ? (
                    <a
                      href={item.imageUrl}
                      target="_blank"
                      className="text-blue-400 underline"
                    >
                      Open image
                    </a>
                  ) : (
                    "Missing"
                  )}
                </p>

                <div className="mt-5 bg-zinc-800 rounded-2xl p-5">
                  <p className="text-xl">
                    <strong>eBay Average:</strong>{" "}
                    {item.ebayAverage
                      ? `£${Number(item.ebayAverage).toFixed(2)}`
                      : "No price found"}
                  </p>

                  <p className="text-4xl text-green-400 font-bold mt-3">
                    Whatnot Price:{" "}
                    {item.whatnotPrice
                      ? `£${item.whatnotPrice}`
                      : "No price found"}
                  </p>
                </div>

                <details className="mt-5 bg-black border border-zinc-800 rounded-xl p-4">
                  <summary className="cursor-pointer font-bold">
                    eBay Debug
                  </summary>

                  <pre className="mt-4 text-xs whitespace-pre-wrap">
                    {JSON.stringify(item.ebayDebug, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}