const fs = require("fs");
const path = require("path");
const https = require("https");

const dishes = require("./recipe-images.json");
const outDir = path.resolve(__dirname, "..", "..", "api", "Store", "art", "recipes");
fs.mkdirSync(outDir, { recursive: true });

function fetchToFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(
      url,
      {
        headers: { "User-Agent": "AgamiPathaEbookBuilder/1.0" },
        timeout: 90000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
          fetchToFile(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      },
    );
    req.on("error", (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  const start = Number(process.argv[2] || 0);
  const end = Number(process.argv[3] || dishes.length);
  for (let i = start; i < end; i += 1) {
    const [slug, scene] = dishes[i];
    const dest = path.join(outDir, `${slug}.png`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 8000) {
      console.log(`skip ${slug}`);
      continue;
    }
    const prompt = `Appetizing food photography, NO text, NO letters, NO watermark, NO logos. ${scene}. Shot on a steel plate or simple ceramic in an Indian bachelor kitchen, golden hour, vivid color, shallow depth of field, cookbook quality.`;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=720&nologo=true&model=flux`;
    process.stdout.write(`fetch ${i + 1}/${dishes.length} ${slug} ... `);
    try {
      await fetchToFile(url, dest);
      console.log("ok", fs.statSync(dest).size);
    } catch (err) {
      console.log("fail", err.message);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
