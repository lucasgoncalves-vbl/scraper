// /scrapers/index.ts
import { embrapiiScraper } from "./scrapers/embrapiiScraper";
import { scrapeFinep } from "./scrapers/finepScraper";

async function runScrapers() {
  try {
    await scrapeFinep("aberta");
    await scrapeFinep("encerrada");
    await embrapiiScraper();
    console.log("Todos os scrapers foram executados com sucesso.");
  } catch (err) {
    console.error("Erro durante a execução dos scrapers:", err);
  }
}

runScrapers();