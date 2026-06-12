export default async function handler(req: any, res: any) {
  try {
    // @ts-ignore
    const serverModule = await import("../dist/server.cjs");
    const app = serverModule.default || serverModule;
    return app(req, res);
  } catch (error: any) {
    console.error("Vercel Serverless Function Startup Exception:", error);
    res.status(500).json({
      error: "Vercel Serverless Function Startup Exception",
      message: error.message || String(error),
      stack: error.stack || ""
    });
  }
}
