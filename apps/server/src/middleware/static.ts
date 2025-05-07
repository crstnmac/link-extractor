import type { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";

export const setupStaticFiles = (app: Hono) => {
	// Create public directory if it doesn't exist
	const publicDir = path.join(process.cwd(), "public");
	if (!fs.existsSync(publicDir)) {
		fs.mkdirSync(publicDir, { recursive: true });
	}

	// Serve static files from public directory
	app.use("/public/*", serveStatic({ root: "./" }));

	// Serve index.html at the root
	app.get("/", async (c) => {
		const indexPath = path.join(publicDir, "index.html");
		if (fs.existsSync(indexPath)) {
			return c.html(fs.readFileSync(indexPath, "utf-8"));
		}
		return c.json({
			message: "Sitemap Link Extractor API is running",
			apiDocs: "/api",
			endpoints: {
				"/api/sitemap-links": "Extract links from a specific sitemap URL",
				"/api/website-links":
					"Extract all links from a website using available sitemaps",
				"/api/find-sitemaps": "Find all sitemap paths for a website",
			},
		});
	});

	return app;
};