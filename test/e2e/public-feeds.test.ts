import { beforeAll, describe, expect, it } from "vitest";
import { albumMedia, albums, categories, events, media, products } from "@src/db/schema";
import { api, db, readJson, seedBase } from "./helpers";

const day = 24 * 60 * 60 * 1000;
const now = Date.now();

let seed: Awaited<ReturnType<typeof seedBase>>;
let albumId: number;
let secondMediaId: number;

beforeAll(async () => {
  seed = await seedBase();

  await db.insert(categories).values({ slug: "budaya", name: "Budaya", sortOrder: 0 });

  const [secondMedia] = await db
    .insert(media)
    .values({
      key: "seed/second.jpg",
      filename: "second.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 2048,
      uploadedBy: seed.admin.id,
    })
    .returning();
  secondMediaId = secondMedia.id;

  await db.insert(events).values([
    {
      slug: "sedang-berlangsung",
      title: "Sedang Berlangsung",
      description: "Mulai kemarin, selesai besok.",
      startAt: new Date(now - 2 * day),
      endAt: new Date(now + day),
      status: "published",
    },
    {
      slug: "akan-datang",
      title: "Akan Datang",
      description: "Tiga hari lagi.",
      startAt: new Date(now + 3 * day),
      status: "published",
    },
    {
      slug: "sudah-lewat",
      title: "Sudah Lewat",
      description: "Tidak punya endAt dan sudah lewat.",
      startAt: new Date(now - 10 * day),
      status: "published",
    },
    {
      slug: "draft-festival",
      title: "Draft Festival",
      description: "Belum terbit.",
      startAt: new Date(now + 5 * day),
      status: "draft",
    },
  ]);

  await db.insert(products).values([
    {
      slug: "kopi-arabika",
      name: "Kopi Arabika",
      description: "Proses natural.",
      price: 45000,
      sellerName: "Kelompok Tani",
      status: "published",
      createdAt: new Date(now - day),
    },
    {
      slug: "madu-hutan",
      name: "Madu Hutan",
      description: "Panen warga.",
      price: 120000,
      sellerName: "Pak Asep",
      status: "published",
      createdAt: new Date(now - 2 * day),
    },
    {
      slug: "beras-organik",
      name: "Beras Organik",
      description: "Belum terbit.",
      price: 20000,
      sellerName: "Kelompok Tani",
      status: "draft",
    },
  ]);

  const insertedAlbums = await db
    .insert(albums)
    .values([
      {
        slug: "festival-panen-2025",
        title: "Festival Panen 2025",
        coverMediaId: seed.cover.id,
        status: "published",
        createdAt: new Date(now - day),
      },
      {
        slug: "keindahan-curug",
        title: "Keindahan Curug",
        status: "published",
        createdAt: new Date(now - 2 * day),
      },
      {
        slug: "dapur-umkm",
        title: "Dapur UMKM",
        status: "draft",
      },
    ])
    .returning();
  albumId = insertedAlbums.find((album) => album.slug === "festival-panen-2025")!.id;

  await db.insert(albumMedia).values([
    { albumId, mediaId: secondMediaId, sortOrder: 1 },
    { albumId, mediaId: seed.cover.id, sortOrder: 0 },
  ]);
});

describe("GET /api/events", () => {
  it("returns published events that have not ended, ordered by start", async () => {
    const body = await readJson<{ data: Array<Record<string, unknown>> }>(await api("/api/events"));

    expect(body.data.map((event) => event.slug)).toEqual(["sedang-berlangsung", "akan-datang"]);
    expect(body.data[0]).not.toHaveProperty("status");
  });
});

describe("GET /api/products", () => {
  it("returns published products newest first", async () => {
    const body = await readJson<{ data: Array<Record<string, unknown>> }>(
      await api("/api/products"),
    );

    expect(body.data.map((product) => product.slug)).toEqual(["kopi-arabika", "madu-hutan"]);
    expect(body.data[0]).not.toHaveProperty("status");
  });
});

describe("GET /api/categories", () => {
  it("returns every category ordered by sortOrder then name", async () => {
    const body = await readJson<{ data: Array<{ slug: string }> }>(await api("/api/categories"));

    expect(body.data.map((category) => category.slug)).toEqual([
      "budaya",
      "wisata-alam",
      "kuliner",
    ]);
  });
});

describe("GET /api/albums", () => {
  it("returns published albums with their media ordered by sort order", async () => {
    const body = await readJson<{
      data: Array<Record<string, any>>;
      pagination: Record<string, number>;
    }>(await api("/api/albums"));

    expect(body.pagination).toMatchObject({ total: 2 });
    expect(body.data.map((album) => album.slug)).toEqual([
      "festival-panen-2025",
      "keindahan-curug",
    ]);
    expect(body.data[0].items.map((item: { key: string }) => item.key)).toEqual([
      "seed/cover.jpg",
      "seed/second.jpg",
    ]);
    expect(body.data[0].items[0]).not.toHaveProperty("uploadedBy");
    expect(body.data[1].items).toEqual([]);
  });
});
