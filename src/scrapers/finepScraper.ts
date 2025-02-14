import path from "path";
import puppeteer, { Browser, Page } from "puppeteer";
import { ensureDownloadDirectoryExists, downloadPdfFile } from "../utils/utils";

const DOWNLOAD_DIR = "./editais/editaisFinep";

// Função para extrair links das páginas de editais
async function extractPageLinks(page: Page, baseUrl: string): Promise<string[]> {
    const totalPages = await page.evaluate(() => {
        const counter = document.querySelector("p.counter")?.textContent;
        const total = counter?.replace(/\s/g, "").match(/\d+$/)?.[0];
        return total ? parseInt(total, 10) : 0;
    });

    const pageLinks: string[] = [baseUrl];

    for (let i = 10; i <= totalPages * 10 - 10; i += 10) {
        pageLinks.push(`${baseUrl}&start=${i}`);
    }

    return pageLinks;
}

// Função para extrair links de chamadas públicas
async function extractChamadaPublicaLinks(page: Page, url: string): Promise<{ href: string; text: string }[]> {
    await page.goto(url, { waitUntil: "networkidle2" }); // Espera até que a rede esteja ociosa
    console.log(`Acessando página de listagem: ${url}`);

    return page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a"));
        return links
            .map((link) => ({
                href: link.href,
                text: link.innerText.trim(),
            }))
            .filter((link) => link.href.includes("chamadapublica"));
    });
}

// Função para extrair links de PDFs dentro de uma página de chamada pública
async function extractPdfLinks(page: Page, url: string): Promise<{ href: string, numeroChamada: string; }[]> {
    await page.goto(url, { waitUntil: "networkidle2" }); // Espera até que a rede esteja ociosa
    console.log(`Acessando página de chamada pública: ${url}`);

    return page.evaluate((currentUrl) => {
        const links = Array.from(document.querySelectorAll("a"));

        const match = currentUrl.match(/\/(\d+)$/);
        const numeroChamada = match ? match[1] : "";

        return links
            .map((link) => ({
                href: link.href,
                numeroChamada
            }))
            .filter((link) => (link.href.includes("Edital") || link.href.includes("Final")) && link.href.endsWith(".pdf"));
    }, url);
}

// Função principal para realizar o scraping
export async function scrapeFinep(situacao: string): Promise<void> {
    const baseUrl = `http://www.finep.gov.br/chamadas-publicas?situacao=${situacao}`;

    console.log(`Scrape finep - Situacao=${situacao}`)

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

        // Passo 2: Extrair links de chamadas públicas em cada página de listagem
        const allChamadaPublicaLinks: { href: string; text: string }[] = [];

        for (const pageLink of pageLinks) {
            const chamadaPublicaLinks = await extractChamadaPublicaLinks(page, pageLink);
            allChamadaPublicaLinks.push(...chamadaPublicaLinks);
        }

        console.log("Links de chamadas públicas abertas encontrados:", allChamadaPublicaLinks.length);

        // Passo 3: Extrair links de PDFs em cada página de chamada pública
        const allPdfLinks: { href: string; numeroChamada: string }[] = [];

        for (const { href } of allChamadaPublicaLinks) {
            const pdfLinks = await extractPdfLinks(page, href);
            allPdfLinks.push(...pdfLinks);
        }

        console.log("Links de PDFs encontrados:", allPdfLinks);

        // Passo 4: Baixar os PDFs
        ensureDownloadDirectoryExists(DOWNLOAD_DIR);

        for (const { href, numeroChamada } of allPdfLinks) {
            const fileName = path.basename(href + "-" + numeroChamada);
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