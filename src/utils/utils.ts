// /scrapers/shared/utils.ts
import fs from "fs";
import path from "path";
import axios from "axios";

export function isFileAlreadyDownloaded(fileName: string, downloadDir: string): boolean {
  const filePath = path.join(downloadDir, fileName);
  return fs.existsSync(filePath);
}

export function ensureDownloadDirectoryExists(downloadDir: string): void {
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }
}

export async function downloadPdfFile(url: string, fileName: string, downloadDir: string): Promise<void> {
  const filePath = path.join(downloadDir, fileName);

  if (isFileAlreadyDownloaded(fileName, downloadDir)) {
    console.log(`Arquivo já baixado: ${fileName}`);
    return;
  }

  try {
    const response = await axios.get(url, { responseType: "stream" });
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    console.log(`Download concluído: ${fileName}`);
  } catch (err) {
    console.error(`Erro ao baixar ${fileName}:`, err);
  }
}