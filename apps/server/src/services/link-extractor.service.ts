import axios from "axios";
import * as cheerio from "cheerio";
import * as url from "node:url";
import * as xml2js from "xml2js";
import { logger } from "./logging.service";

interface SitemapPath {
	url: string;
}

interface PageLink {
	url: string;
	text?: string;
	source?: string;
	lastmod?: string;
	priority?: string;
	changefreq?: string;
}

const ROBOTS_TXT = "/robots.txt";
const SERVICE_NAME = "LinkExtractorService";

class LinkExtractorService {
	// Find the path to a sitemap.xml file
	async extractSitemapUrl(websiteUrl: string): Promise<SitemapPath | null> {
		try {
			const sitemapUrl = `${websiteUrl}/sitemap.xml`;
			// Just check if the sitemap exists
			await axios.head(sitemapUrl);
			logger.info(`Found standard sitemap at ${sitemapUrl}`, SERVICE_NAME);
			return { url: sitemapUrl };
		} catch (error) {
			logger.warn(
				`Sitemap not found at standard path: ${websiteUrl}/sitemap.xml`,
				SERVICE_NAME,
			);
			return null;
		}
	}

	// Extract sitemap URLs from robots.txt
	async extractSitemapsFromRobotsTxt(
		websiteUrl: string,
	): Promise<SitemapPath[]> {
		try {
			const robotsTxtUrl = url.resolve(websiteUrl, ROBOTS_TXT);
			logger.debug(`Checking robots.txt at ${robotsTxtUrl}`, SERVICE_NAME);
			const response = await axios.get(robotsTxtUrl);
			const sitemapPaths: SitemapPath[] = [];

			for (const line of response.data.split("\n")) {
				const match = line.match(/Sitemap: (.*)/i);
				if (match) {
					logger.debug(
						`Found sitemap in robots.txt: ${match[1].trim()}`,
						SERVICE_NAME,
					);
					sitemapPaths.push({ url: match[1].trim() });
				}
			}

			logger.info(
				`Found ${sitemapPaths.length} sitemaps in robots.txt`,
				SERVICE_NAME,
			);
			return sitemapPaths;
		} catch (error) {
			logger.error(
				`Error extracting sitemaps from robots.txt: ${websiteUrl}`,
				SERVICE_NAME,
				error,
			);
			return [];
		}
	}

	// Check if robots.txt mentions sitemaps
	async checkRobotsTxtForSitemapPath(websiteUrl: string): Promise<boolean> {
		try {
			const robotsTxtUrl = url.resolve(websiteUrl, ROBOTS_TXT);
			logger.debug(
				`Checking if robots.txt contains sitemap mentions: ${robotsTxtUrl}`,
				SERVICE_NAME,
			);
			const response = await axios.get(robotsTxtUrl);

			// Check if robots.txt mentions "sitemap" anywhere
			const hasSitemapMention = /sitemap/i.test(response.data);

			// More specific check for actual sitemap directives
			const hasSitemapDirective = /Sitemap: /i.test(response.data);

			const result = hasSitemapMention || hasSitemapDirective;
			logger.debug(
				`Robots.txt ${result ? "has" : "does not have"} sitemap mentions`,
				SERVICE_NAME,
			);
			return result;
		} catch (error) {
			logger.warn(
				`Error checking robots.txt for sitemap mentions: ${websiteUrl}`,
				SERVICE_NAME,
				error,
			);
			return false;
		}
	}

	// Find sitemap reference in HTML headers
	async findSitemapInHtmlHeader(
		websiteUrl: string,
	): Promise<SitemapPath | null> {
		try {
			logger.debug(
				`Checking HTML header for sitemap link: ${websiteUrl}`,
				SERVICE_NAME,
			);
			const response = await axios.get(websiteUrl);
			const $ = cheerio.load(response.data);
			const sitemapLink = $('link[rel="sitemap"]').attr("href");

			if (sitemapLink) {
				const absoluteUrl = url.resolve(websiteUrl, sitemapLink);
				logger.info(
					`Found sitemap in HTML header: ${absoluteUrl}`,
					SERVICE_NAME,
				);
				return { url: absoluteUrl };
			}
			logger.debug("No sitemap found in HTML header", SERVICE_NAME);
			return null;
		} catch (error) {
			logger.warn(
				`Error checking HTML header for sitemap: ${websiteUrl}`,
				SERVICE_NAME,
				error,
			);
			return null;
		}
	}

	// Check common paths where sitemaps might be located
	async checkCommonSitemapPaths(websiteUrl: string): Promise<SitemapPath[]> {
		const commonPaths = [
			"/sitemap.xml",
			"/sitemap_index.xml",
			"/sitemap-index.xml",
			"/sitemapindex.xml",
			"/sitemap/",
			"/sitemaps/",
			"/sitemap/sitemap.xml",
			"/wp-sitemap.xml", // WordPress
			"/news-sitemap.xml", // News sites
			"/image-sitemap.xml", // Image sitemaps
			"/video-sitemap.xml", // Video sitemaps
			"/post-sitemap.xml", // Common for blogs
		];

		const foundSitemaps: SitemapPath[] = [];

		logger.info(
			`Checking ${commonPaths.length} common sitemap paths`,
			SERVICE_NAME,
		);

		for (const path of commonPaths) {
			try {
				const sitemapUrl = url.resolve(websiteUrl, path);
				await axios.head(sitemapUrl);
				logger.debug(
					`Found sitemap at common path: ${sitemapUrl}`,
					SERVICE_NAME,
				);
				foundSitemaps.push({ url: sitemapUrl });
			} catch (error) {
				// Skip if not found
			}
		}

		logger.info(
			`Found ${foundSitemaps.length} sitemaps at common paths`,
			SERVICE_NAME,
		);
		return foundSitemaps;
	}

	// Get all sitemap paths for a website
	async getAllSitemapPaths(websiteUrl: string): Promise<SitemapPath[]> {
		logger.info(`Searching for all sitemaps at: ${websiteUrl}`, SERVICE_NAME);

		// First check robots.txt for sitemap mentions
		const hasSitemapInRobotsTxt =
			await this.checkRobotsTxtForSitemapPath(websiteUrl);

		// Try to collect sitemap paths from different sources
		const robotsSitemaps = await this.extractSitemapsFromRobotsTxt(websiteUrl);
		const standardSitemap = await this.extractSitemapUrl(websiteUrl);
		const htmlSitemap = await this.findSitemapInHtmlHeader(websiteUrl);

		// Only check common paths if we haven't found sitemaps in robots.txt
		let commonSitemaps: SitemapPath[] = [];
		if (!hasSitemapInRobotsTxt || robotsSitemaps.length === 0) {
			logger.debug(
				"No sitemaps found in robots.txt, checking common paths",
				SERVICE_NAME,
			);
			commonSitemaps = await this.checkCommonSitemapPaths(websiteUrl);
		}

		// Combine all found sitemap paths
		const allSitemapPaths: SitemapPath[] = [
			...robotsSitemaps,
			...(standardSitemap ? [standardSitemap] : []),
			...(htmlSitemap ? [htmlSitemap] : []),
			...commonSitemaps,
		];

		// Deduplicate sitemap URLs
		const uniqueUrls = new Set(
			allSitemapPaths
				.map((s) => s.url)
				.filter((sitemapUrl) => sitemapUrl.toLowerCase().endsWith(".xml")),
		);

		const result = Array.from(uniqueUrls).map((sitemapUrl) => ({
			url: sitemapUrl,
		}));
		logger.info(`Found ${result.length} unique sitemap URLs`, SERVICE_NAME);
		return result;
	}

	// Extract links from a sitemap
	async extractLinksFromSitemap(sitemapUrl: string): Promise<PageLink[]> {
		try {
			logger.info(`Extracting links from sitemap: ${sitemapUrl}`, SERVICE_NAME);
			const response = await axios.get(sitemapUrl);
			const links: PageLink[] = [];

			// Try to parse as XML
			try {
				const parser = new xml2js.Parser();
				const result = await parser.parseStringPromise(response.data);

				// Handle sitemap index (contains other sitemaps)
				if (result.sitemapindex?.sitemap) {
					logger.info("Found sitemap index with nested sitemaps", SERVICE_NAME);
					const nestedSitemapUrls = result.sitemapindex.sitemap.map(
						(sitemap: { loc: string[] }) => sitemap.loc[0],
					);
					logger.debug(
						`Processing ${nestedSitemapUrls.length} nested sitemaps`,
						SERVICE_NAME,
					);

					// Process each nested sitemap
					for (const nestedUrl of nestedSitemapUrls) {
						logger.debug(
							`Processing nested sitemap: ${nestedUrl}`,
							SERVICE_NAME,
						);
						const nestedLinks = await this.extractLinksFromSitemap(nestedUrl);
						links.push(...nestedLinks);
					}
				}
				// Handle regular sitemap
				else if (result.urlset?.url) {
					logger.info(
						`Processing standard sitemap with ${result.urlset.url.length} URLs`,
						SERVICE_NAME,
					);
					for (const urlObj of result.urlset.url) {
						const link: PageLink = { url: urlObj.loc[0], source: sitemapUrl };

						// Add optional fields if available
						if (urlObj.lastmod) link.lastmod = urlObj.lastmod[0];
						if (urlObj.priority) link.priority = urlObj.priority[0];
						if (urlObj.changefreq) link.changefreq = urlObj.changefreq[0];

						links.push(link);
					}
				}
				// Handle news sitemap
				else if (result["news:news"]) {
					logger.info("Found news sitemap format", SERVICE_NAME);
					// Process news sitemap format
					// Implementation depends on specific news sitemap structure
				}

				return links;
			} catch (xmlError) {
				// If XML parsing fails, try processing as text
				logger.warn(
					`XML parsing failed for ${sitemapUrl}, trying text processing`,
					SERVICE_NAME,
					xmlError,
				);

				// Simple regex-based extraction as fallback
				const urlMatches = response.data.match(/<loc>(.*?)<\/loc>/g);
				if (urlMatches) {
					logger.info(
						`Extracted ${urlMatches.length} URLs using regex fallback`,
						SERVICE_NAME,
					);
					for (const match of urlMatches) {
						const url = match.replace(/<loc>|<\/loc>/g, "").trim();
						links.push({ url, source: sitemapUrl });
					}
				}

				return links;
			}
		} catch (error) {
			logger.error(
				`Error extracting links from sitemap: ${sitemapUrl}`,
				SERVICE_NAME,
				error,
			);
			return [];
		}
	}

	// Extract links from any webpage
	async extractLinksFromPage(pageUrl: string): Promise<PageLink[]> {
		try {
			logger.info(`Extracting links from page: ${pageUrl}`, SERVICE_NAME);
			const response = await axios.get(pageUrl);
			const $ = cheerio.load(response.data);
			const links: PageLink[] = [];

			$("a").each((index, element) => {
				const href = $(element).attr("href");
				if (href) {
					// Skip anchors and javascript links
					if (href.startsWith("#") || href.startsWith("javascript:")) {
						return;
					}

					const absoluteUrl = url.resolve(pageUrl, href);
					const text = $(element).text().trim();
					links.push({
						url: absoluteUrl,
						text: text || undefined,
						source: pageUrl,
					});
				}
			});

			logger.info(`Extracted ${links.length} links from page`, SERVICE_NAME);
			return links;
		} catch (error) {
			logger.error(
				`Error extracting links from page: ${pageUrl}`,
				SERVICE_NAME,
				error,
			);
			return [];
		}
	}

	// Extract all links from a website using available sitemaps
	async extractAllLinks(websiteUrl: string): Promise<PageLink[]> {
		logger.info(
			`Extracting all links from website: ${websiteUrl}`,
			SERVICE_NAME,
		);

		// First, find all sitemaps
		const sitemapPaths = await this.getAllSitemapPaths(websiteUrl);
		const allLinks: PageLink[] = [];

		// If sitemaps were found, extract links from them
		if (sitemapPaths.length > 0) {
			logger.info(
				`Found ${sitemapPaths.length} sitemaps, extracting links from each`,
				SERVICE_NAME,
			);
			for (const sitemap of sitemapPaths) {
				logger.debug(`Processing sitemap: ${sitemap.url}`, SERVICE_NAME);
				const links = await this.extractLinksFromSitemap(sitemap.url);
				allLinks.push(...links);
			}
		} else {
			// Fallback to homepage if no sitemaps found
			logger.warn(
				`No sitemaps found for ${websiteUrl}, falling back to homepage extraction`,
				SERVICE_NAME,
			);
			const homepageLinks = await this.extractLinksFromPage(websiteUrl);
			allLinks.push(...homepageLinks);
		}

		// Deduplicate links
		const uniqueUrls = new Map<string, PageLink>();
		for (const link of allLinks) {
			if (!uniqueUrls.has(link.url)) {
				uniqueUrls.set(link.url, link);
			}
		}

		const result = Array.from(uniqueUrls.values());
		logger.info(
			`Extracted ${result.length} unique links in total`,
			SERVICE_NAME,
		);
		return result;
	}
}

export const linkExtractorService = new LinkExtractorService();
