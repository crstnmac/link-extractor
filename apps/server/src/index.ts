import "dotenv/config";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createContext } from "./lib/context";
import { prettyJSON } from "hono/pretty-json";
import { setupStaticFiles } from "./middleware/static";
import { ApiError, isError } from "./lib/errors";
import { linkExtractorService } from "./services/link-extractor.service";

const app = new Hono();


app.use(logger());
app.use("*", prettyJSON());
app.use(
	"/*",
	cors({
		origin: process.env.CORS_ORIGIN || "",
		allowMethods: ["GET", "POST", "OPTIONS"],
	}),
);

setupStaticFiles(app);

// API routes
app.get('/sitemap-links', async (c) => {
  const url = c.req.query('url');
  
  if (!url) {
    throw new ApiError('Missing required parameter: url', 400);
  }
  
  try {
    const links = await linkExtractorService.extractLinksFromSitemap(url);
    return c.json({
      sitemapUrl: url,
      totalLinks: links.length,
      links
    });
  } catch (error: unknown) {
    if (isError(error)) {
      throw new ApiError(`Failed to extract links: ${error.message}`, 500);
    }
    throw new ApiError('Failed to extract links', 500);
  }
});

app.get('/website-links', async (c) => {
  const url = c.req.query('url');
  
  if (!url) {
    throw new ApiError('Missing required parameter: url', 400);
  }
  
  try {
    const links = await linkExtractorService.extractAllLinks(url);
    return c.json({
      websiteUrl: url,
      totalLinks: links.length,
      links
    });
  } catch (error: unknown) {
    if (isError(error)) {
      throw new ApiError(`Failed to extract links: ${error.message}`, 500);
    }
    throw new ApiError('Failed to extract links', 500);
  }
});

app.get('/find-sitemaps', async (c) => {
  const url = c.req.query('url');
  
  if (!url) {
    throw new ApiError('Missing required parameter: url', 400);
  }
  
  try {
    const sitemapPaths = await linkExtractorService.getAllSitemapPaths(url);
    return c.json({
      websiteUrl: url,
      totalSitemaps: sitemapPaths.length,
      sitemaps: sitemapPaths
    });
  } catch (error: unknown) {
    if (isError(error)) {
      throw new ApiError(`Failed to find sitemaps: ${error.message}`, 500);
    }
    throw new ApiError('Failed to find sitemaps', 500);
  }
});

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});


// Root endpoint
app.get("/", (c) => {
	return c.text("Sitemap Link Extractor API");
});

export default app;
