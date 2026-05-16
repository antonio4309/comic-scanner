"use client";

import { useState } from "react";

type ComicResult = {
  image: string;
  comic: any;
  price: string;
  ebayDebug: any;
  searchQuery: string;
};

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (!reader.result) {
        reject(new Error("Could not read image"));
        return;
      }

      resolve(reader.result as string);
    };

    reader.onerror = () => reject(new Error("File reader failed"));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [results, setResults] = useState<ComicResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Choose a photo to begin.");

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = event.target.files;

    if (!selectedFiles || selectedFiles.length === 0) {
      setStatus("No photo selected.");
      return;
    }

    const fileArray = Array.from(selectedFiles);

    setFiles(fileArray);
    setPreviews(fileArray.map((file) => URL.createObjectURL(file)));
    setResults([]);
    setLoading(false);
    setStatus(`${fileArray.length} photo selected. Press Analyze.`);
  }

  async function analyzeComics() {
    try {
      if (files.length === 0) {
        setStatus("Please choose a photo first.");
        return;
      }

      setLoading(true);
      setStatus("Scanning...");
      setResults([]);

      const finalResults: ComicResult[] = [];

      for (let i = 0; i < files.length; i++) {
        setStatus(`Scanning comic ${i + 1} of ${files.length}...`);

        const imageBase64 = await fileToBase64(files[i]);

        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image: imageBase64,
          }),
        });

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        const cleanJson = data.result
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

        const price =
          ebayData.averagePrice && ebayData.averagePrice > 0
            ? `£${ebayData.averagePrice.toFixed(2)}`
            : "No price found";

        finalResults.push({
          image: previews[i],
          comic: comicData,
          price,
          ebayDebug: ebayData,
          searchQuery,
        });

        setResults([...finalResults]);
      }

      setStatus("Scan complete.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-5">
      <section className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Comic Scanner AI</h1>

        <p className="text-zinc-400 mb-6">
          Upload comic covers and get UK market data.
        </p>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="block w-full bg-white text-black p-4 rounded-xl"
          />

          <p className="mt-4 text-zinc-300">{status}</p>

          <button
            type="button"
            onClick={analyzeComics}
            className="mt-5 w-full bg-green-600 text-white font-bold py-4 rounded-xl text-xl"
          >
            {loading ? "Scanning..." : "Analyze"}
          </button>

          {previews.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mt-6">
              {previews.map((src, index) => (
                <img
                  key={index}
                  src={src}
                  alt={`Comic ${index + 1}`}
                  className="rounded-xl border border-zinc-700"
                />
              ))}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-8">
          {results.map((item, index) => (
            <div
              key={index}
              className="bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt="Comic"
                  className="w-full h-[420px] object-cover"
                />
              )}

              <div className="p-5">
                <h2 className="text-2xl font-bold mb-4">
                  {item.comic.title} #{item.comic.issue}
                </h2>

                <p>
                  <strong>Publisher:</strong>{" "}
                  {item.comic.publisher || "Unknown"}
                </p>

                <p>
                  <strong>Year:</strong> {item.comic.year || "Unknown"}
                </p>

                <p>
                  <strong>Key Info:</strong>{" "}
                  {item.comic.keyInfo || item.comic.keyReason || "Unknown"}
                </p>

                <p>
                  <strong>Characters:</strong>{" "}
                  {item.comic.importantCharacters || "Unknown"}
                </p>

                <p>
                  <strong>Confidence:</strong>{" "}
                  {item.comic.confidence || "Unknown"}
                </p>

                <p>
                  <strong>eBay Query:</strong> {item.searchQuery}
                </p>

                <div className="mt-5 bg-green-900 border border-green-700 rounded-xl p-4 text-2xl font-bold">
                  {item.price}
                </div>

                <details className="mt-5 bg-black border border-zinc-800 rounded-xl p-4">
                  <summary className="cursor-pointer font-bold">
                    eBay Debug
                  </summary>

                  <pre className="mt-4 text-xs whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(item.ebayDebug, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}