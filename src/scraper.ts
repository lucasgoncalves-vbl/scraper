import { config } from "dotenv";
import { createPool, Pool } from "mysql";
import { schedule } from "node-cron";
import Puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import axios from "axios";

config();

const downloadDir = "./editais";

// Função para verificar se o arquivo já foi baixado
function arquivoJaBaixado(fileName: string): boolean {
  const filePath = path.join(downloadDir, fileName);
  return fs.existsSync(filePath);
}

/* Baixa os editais da Finep com situação atual aberta */
async function scrapeFinep() {
  const url = "http://www.finep.gov.br/chamadas-publicas?situacao=aberta";

  const browser = await Puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
    timeout: 0,
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "load" });

  const todasPaginas = await page.evaluate(() => {
    const counter = document.querySelector("p.counter")?.textContent;
    const total = counter?.replace(/\s/g, "").match(/\d+$/)?.[0];
    const totalPaginas = total ? parseInt(total, 10) : 0;

    const baseUrl = "http://www.finep.gov.br/chamadas-publicas?situacao=aberta&start=";
    const href: string[] = [];

    href.push("http://www.finep.gov.br/chamadas-publicas?situacao=aberta");

    for (let i = 10; i <= totalPaginas * 10 - 10; i += 10) {
      href.push(`${baseUrl}${i}`);
    }

    return {
      totalPaginas,
      href,
    };
  });

  let todosLinks: { href: string; text: string }[] = [];

  for (const pagina of todasPaginas.href) {
    await page.goto(pagina, { waitUntil: "load" });

    const pagesLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));

      return links
        .map((link) => ({
          href: link.href,
          text: link.innerText,
        }))
        .filter((link) => link.href.includes("chamadapublica"));
    });

    todosLinks = todosLinks.concat(pagesLinks);
  }

  console.log("Páginas encontradas:", todosLinks);

  // Criando o diretório de download, se não existir
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
  }

  let pdfLinks: { href: string; text: string }[] = [];

  for (const nova of todosLinks) {
    await page.goto(nova.href, { waitUntil: "load" });

    // Extraindo os links dos editais em PDF
    const links = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      return links
        .map((link) => ({
          href: link.href,
          text: link.innerText,
        }))
        .filter((link) => link.href.includes("Edital") && link.href.endsWith(".pdf"));
    });

    pdfLinks = pdfLinks.concat(links);
  }

  console.log("Editais encontrados:", pdfLinks);

  // Baixando os PDFs
  for (const { href, text } of pdfLinks) {
    const fileName = path.basename(href);
    const filePath = path.join(downloadDir, fileName);

    // Verifica se o arquivo já foi baixado
    if (arquivoJaBaixado(fileName)) {
      console.log(`Arquivo já baixado: ${fileName}`);
      continue; // Pula para o próximo arquivo
    }

    try {
      const response = await axios.get(href, { responseType: "stream" });
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

  await browser.close();
}

// Agendando o scraper para rodar conforme necessário
const interval = process.env.production ? "*/30 * * * *" : "* * * * *";
console.log(
  `Scraping a cada ${process.env.production ? "30 minutos" : "minuto"}.`
);

if (!process.env.production) {
  scrapeFinep();
}

schedule(interval, () => scrapeFinep());