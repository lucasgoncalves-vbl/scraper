import path from "path";
import puppeteer, { Browser, Page } from "puppeteer";
import { ensureDownloadDirectoryExists, downloadPdfFile } from "../utils/utils";

const DOWNLOAD_DIR = "./editais/editaisFaperj";

// Função para extrair links das páginas de editais?
async function extractPageLinks(page: Page, baseUrl: string): Promise<string[]> {

    return page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a")) // Seleciona todos os <a>
        .filter(a => a.href.includes("/?id=") && a.textContent?.includes("Editais lançados")); // Filtra os que têm o texto no formato desejado

        const linkHrefs = links.map(a => a.href);

        return linkHrefs;
    }) 
}


// Função para extrair links de PDFs dentro de uma página de chamada pública
async function extractPdfLinks(page: Page, url: string): Promise<{ href: string }[]> {
    await page.goto(url, { waitUntil: "networkidle2" }); // Espera até que a rede esteja ociosa
    console.log(`Acessando página de editais: ${url}`);

    return page.evaluate((currentUrl) => {
        const links = Array.from(document.querySelectorAll("a"));


        return links
            .map((link) => ({
                href: link.href
            }))
            .filter((link) => link.href.includes("Edital") && link.href.endsWith(".pdf"));
    }, url);
}

// Função principal para realizar o scraping
export async function scrapeFaperj(): Promise<void> {
    const baseUrl = `https://www.faperj.br/?id=28.5.7`;

    console.log(`Scrape Faperj`)

    let browser: Browser | null = null;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-gpu"],
            timeout: 0,
        });

        const page = await browser.newPage();
        await page.goto(baseUrl, { waitUntil: "networkidle2" });

        // Passo 1: Extrair links de todas as páginas de listagem (&start=10, &start=20, etc.)
        const pageLinks = await extractPageLinks(page, baseUrl);
        console.log("Páginas de listagem encontradas:", pageLinks);


        // Passo 2: Extrair links de PDFs em cada página de chamada pública
        const allPdfLinks: { href: string; }[] = [];

        for (const href of pageLinks) {
            const pdfLinks = await extractPdfLinks(page, href);
            allPdfLinks.push(...pdfLinks);
        }

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