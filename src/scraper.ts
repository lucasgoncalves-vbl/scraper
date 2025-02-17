// /scrapers/index.ts
import { embrapiiScraper } from "./scrapers/embrapiiScraper";
import { scrapeFaperj } from "./scrapers/faperjScraper";
import { scrapeFinep } from "./scrapers/finepScraper";

async function runScrapers() {
  try {
    // await scrapeFinep("aberta");
    // await scrapeFinep("encerrada");
    // await embrapiiScraper();
    await scrapeFaperj();
    console.log("Todos os scrapers foram executados com sucesso.");
  } catch (err) {
    console.error("Erro durante a execução dos scrapers:", err);
  }
}

runScrapers();