import path from "path";
import puppeteer, { Browser, Page } from "puppeteer";
import { ensureDownloadDirectoryExists, downloadPdfFile } from "../utils/utils";

const DOWNLOAD_DIR = "./editais/editaisEmbrapii";

// Função para extrair links de chamadas públicas
async function extractChamadaPublicaLinks(page: Page, url: string): Promise<{ href: string; }[]> {
    await page.goto(url, { waitUntil: "networkidle2" }); // Espera até que a rede esteja ociosa
    console.log(`Acessando página de listagem: ${url}`);

    return page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a"));
        return links
            .map((link) => {

                return {
                    href: link.href,
                };
            })
            .filter((link) =>
                (link.href.includes("chamadas-publicas")));
    });
}

// Função para extrair links de PDFs dentro de uma página de chamada pública
async function extractPdfLinks(page: Page, url: string): Promise<{ href: string }[]> {
    await page.goto(url, { waitUntil: "networkidle2" }); // Espera até que a rede esteja ociosa
    console.log(`Acessando página de chamada pública: ${url}`);

    return page.evaluate((currentText) => {
        const links = Array.from(document.querySelectorAll("a"));

        return links
            .map((link) => ({
                href: link.href,
            }))
            .filter((link) => (link.href.includes("CHAMADA-PUBLICA") || link.href.includes("Final")) && link.href.endsWith(".pdf"));
    });
}

// Função principal para realizar o scraping
export async function embrapiiScraper(): Promise<void> {
    const baseUrl = `https://embrapii.org.br/transparencia/#chamadas-publicas`;

    console.log(`Scrape Embrapii`)

    let browser: Browser | null = null;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-gpu"],
            timeout: 0,
        });

        const page = await browser.newPage();
        await page.goto(baseUrl, { waitUntil: "networkidle2" });

        // Passo 1: Extrair links de chamadas públicas em cada página de listagem
        const chamadaPublicaLinks = await extractChamadaPublicaLinks(page, baseUrl);

        console.log("Links de chamadas públicas encontrados:", chamadaPublicaLinks);

        // Passo 3: Extrair links de PDFs em cada página de chamada pública
        const allPdfLinks: { href: string;  }[] = [];

        for (const { href } of chamadaPublicaLinks) {
            const pdfLinks = await extractPdfLinks(page, href);
            allPdfLinks.push(...pdfLinks);
        }

        console.log("Links de PDFs encontrados:", allPdfLinks);

        // Passo 4: Baixar os PDFs
        ensureDownloadDirectoryExists(DOWNLOAD_DIR);

        for (const { href } of allPdfLinks) {
            const fileName = path.basename(href);
            await downloadPdfFile(href, fileName, DOWNLOAD_DIR);
        }

    } catch (err) {
        console.error("Erro durante o scraping:", err);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}