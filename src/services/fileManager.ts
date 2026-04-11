import JSZip from "jszip";

const CSV_HEADER = "Front,Back";

export type AppendCardInput = {
  questionImage: Blob;
  answerImage: Blob;
};

function extractMaxIndexFromText(text: string): number {
  const imageFilePattern = /(?:^|["'>])(q|a)_(\d+)\.png(?:["'<]|$)/g;
  let max = 0;
  let match = imageFilePattern.exec(text);
  while (match) {
    const parsed = Number.parseInt(match[2], 10);
    if (!Number.isNaN(parsed)) {
      max = Math.max(max, parsed);
    }
    match = imageFilePattern.exec(text);
  }
  return max;
}

function formatCardNumber(num: number): string {
  return String(num).padStart(3, "0");
}

function buildCsvRow(cardNumber: number): string {
  const n = formatCardNumber(cardNumber);
  return `<img src="q_${n}.png">,<img src="a_${n}.png">`;
}

function normalizeCsv(existingCsv: string): string[] {
  const lines = existingCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [CSV_HEADER];
  }

  if (lines[0] !== CSV_HEADER) {
    return [CSV_HEADER, ...lines];
  }

  return lines;
}

export async function appendCardsToExistingDeck(
  deckZipFile: Blob,
  newCards: AppendCardInput[]
): Promise<Blob> {
  const zip = await JSZip.loadAsync(await deckZipFile.arrayBuffer());
  const existingCsv = await zip.file("deck.csv")?.async("text");
  const csvLines = normalizeCsv(existingCsv ?? "");

  let maxIndex = extractMaxIndexFromText(csvLines.join("\n"));

  Object.keys(zip.files).forEach((filename) => {
    maxIndex = Math.max(maxIndex, extractMaxIndexFromText(filename));
  });

  for (const card of newCards) {
    maxIndex += 1;
    const n = formatCardNumber(maxIndex);
    zip.file(`q_${n}.png`, await card.questionImage.arrayBuffer());
    zip.file(`a_${n}.png`, await card.answerImage.arrayBuffer());
    csvLines.push(buildCsvRow(maxIndex));
  }

  zip.file("deck.csv", `${csvLines.join("\n")}\n`);
  return zip.generateAsync({ type: "blob" });
}
