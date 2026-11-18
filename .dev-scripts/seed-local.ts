/**
 * Seeds the local D1 database with sample data for manual API testing.
 *
 * Usage: pnpm db:seed:local
 *
 * Every table is cleared before seeding, so only run this against local development.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import {
  albumMedia,
  albums,
  categories,
  contactMessages,
  events,
  media,
  postTags,
  posts,
  products,
  settings,
  tags,
  users,
} from "../src/db/schema.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const now = new Date();
const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

function keyed<T>(rows: T[], getKey: (row: T) => string) {
  return new Map(rows.map((row) => [getKey(row), row]));
}

function pick<T>(map: Map<string, T>, key: string): T {
  const value = map.get(key);
  if (!value) throw new Error(`Seed data not found: ${key}`);
  return value;
}

console.log(`[seed] Seeding local D1 at ${root}.wrangler/state/v3`);

const { env, dispose } = await getPlatformProxy({
  configPath: `${root}wrangler.jsonc`,
  persist: { path: `${root}.wrangler/state/v3` },
});

try {
  const db = drizzle(env.DB);

  // Clear children before parents so foreign keys stay valid.
  await db.delete(postTags);
  await db.delete(albumMedia);
  await db.delete(posts);
  await db.delete(albums);
  await db.delete(events);
  await db.delete(products);
  await db.delete(media);
  await db.delete(categories);
  await db.delete(tags);
  await db.delete(users);
  await db.delete(settings);
  await db.delete(contactMessages);

  // Keeps seeded ids predictable across runs (1, 2, 3, ...).
  await db.run(sql`DELETE FROM sqlite_sequence`);

  // No auth endpoint exists yet, so passwordHash is only a placeholder.
  const userRows = await db
    .insert(users)
    .values([
      {
        email: "admin@karangpakuan.local",
        name: "Admin Desa",
        passwordHash: "seed:admin123",
        role: "admin",
      },
      {
        email: "editor@karangpakuan.local",
        name: "Editor Konten",
        passwordHash: "seed:editor123",
        role: "editor",
      },
      {
        email: "penulis@karangpakuan.local",
        name: "Penulis Desa",
        passwordHash: "seed:penulis123",
        role: "author",
      },
    ])
    .returning();

  const [admin, editor, author] = userRows;

  // Media rows point at R2 keys that do not exist yet; they are for relation testing only.
  const mediaRows = await db
    .insert(media)
    .values([
      {
        key: "seed/curug-cimuncang.jpg",
        filename: "curug-cimuncang.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 842112,
        width: 1600,
        height: 1067,
        alt: "Curug Cimuncang di Desa Karang Pakuan",
        uploadedBy: admin.id,
      },
      {
        key: "seed/sawah-terasering.jpg",
        filename: "sawah-terasering.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 731880,
        width: 1600,
        height: 1067,
        alt: "Sawah terasering di pagi hari",
        uploadedBy: admin.id,
      },
      {
        key: "seed/sisingaan.jpg",
        filename: "sisingaan.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 654301,
        width: 1200,
        height: 1600,
        alt: "Pertunjukan sisingaan khas Sunda",
        uploadedBy: editor.id,
      },
      {
        key: "seed/kopi-arabika.jpg",
        filename: "kopi-arabika.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 512009,
        width: 1600,
        height: 1067,
        alt: "Biji kopi arabika hasil panen warga",
        uploadedBy: editor.id,
      },
      {
        key: "seed/homestay.jpg",
        filename: "homestay.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 498221,
        width: 1600,
        height: 1067,
        alt: "Homestay warga di Desa Karang Pakuan",
        uploadedBy: admin.id,
      },
      {
        key: "seed/anyaman-bambu.jpg",
        filename: "anyaman-bambu.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 387654,
        width: 1200,
        height: 1200,
        alt: "Kerajinan anyaman bambu",
        uploadedBy: author.id,
      },
    ])
    .returning();

  const mediaByKey = keyed(mediaRows, (row) => row.key);
  const coverId = (key: string) => pick(mediaByKey, key).id;

  const categoryRows = await db
    .insert(categories)
    .values([
      {
        slug: "wisata-alam",
        name: "Wisata Alam",
        description: "Curug, sawah terasering, dan jalur trekking di sekitar desa.",
        sortOrder: 1,
      },
      {
        slug: "budaya",
        name: "Budaya & Tradisi",
        description: "Kesenian, festival, dan kearifan lokal warga Karang Pakuan.",
        sortOrder: 2,
      },
      {
        slug: "kuliner",
        name: "Kuliner",
        description: "Kopi, madu, dan olahan pangan khas desa.",
        sortOrder: 3,
      },
      {
        slug: "penginapan",
        name: "Penginapan",
        description: "Homestay dan penginapan warga.",
        sortOrder: 4,
      },
      {
        slug: "umkm",
        name: "UMKM",
        description: "Produk dan usaha mikro warga desa.",
        sortOrder: 5,
      },
    ])
    .returning();

  const tagRows = await db
    .insert(tags)
    .values([
      { slug: "alam", name: "Alam" },
      { slug: "keluarga", name: "Keluarga" },
      { slug: "edukasi", name: "Edukasi" },
      { slug: "event", name: "Event" },
      { slug: "kuliner-khas", name: "Kuliner Khas" },
      { slug: "budaya", name: "Budaya" },
      { slug: "umkm", name: "UMKM" },
    ])
    .returning();

  const categoryBySlug = keyed(categoryRows, (row) => row.slug);
  const tagBySlug = keyed(tagRows, (row) => row.slug);

  const postRows = await db
    .insert(posts)
    .values([
      {
        slug: "menjelajah-curug-cimuncang",
        title: "Menjelajah Curug Cimuncang di Karang Pakuan",
        excerpt: "Jalur trekking ringan dengan pemandangan air terjun setinggi 15 meter.",
        content:
          "Curug Cimuncang dapat ditempuh sekitar 30 menit dari balai desa. Jalurnya cukup landai dan cocok untuk keluarga.\n\nWarga setempat membuka pos jaga serta menyediakan pemandu lokal setiap akhir pekan.",
        coverMediaId: coverId("seed/curug-cimuncang.jpg"),
        categoryId: pick(categoryBySlug, "wisata-alam").id,
        authorId: editor.id,
        status: "published",
        publishedAt: daysFromNow(-6),
        isFeatured: true,
        metaTitle: "Curug Cimuncang Karang Pakuan",
        metaDescription:
          "Panduan singkat berkunjung ke Curug Cimuncang, destinasi andalan Desa Karang Pakuan.",
        createdAt: daysFromNow(-6),
      },
      {
        slug: "tradisi-sisingaan-di-desa-karang-pakuan",
        title: "Tradisi Sisingaan di Desa Karang Pakuan",
        excerpt: "Kesenian tandu singa yang biasa digelar saat khitanan dan festival desa.",
        content:
          "Sisingaan adalah seni pertunjukan khas Sunda yang menampilkan boneka singa sebagai tandu. Di Karang Pakuan, grup sisingaan warga rutin tampil pada acara khitanan dan festival panen.\n\nLatihan digelar di balai RW setiap malam Jumat.",
        coverMediaId: coverId("seed/sisingaan.jpg"),
        categoryId: pick(categoryBySlug, "budaya").id,
        authorId: author.id,
        status: "published",
        publishedAt: daysFromNow(-12),
        isFeatured: false,
        createdAt: daysFromNow(-12),
      },
      {
        slug: "kopi-arabika-dari-lereng-bukit-karang-pakuan",
        title: "Kopi Arabika dari Lereng Bukit Karang Pakuan",
        excerpt: "Kelompok tani warga mengolah kopi arabika dengan proses natural.",
        content:
          "Kebun kopi warga berada di ketinggian sekitar 900 meter di atas permukaan laut. Proses natural dipakai agar rasa buahnya lebih menonjol.\n\nKopi dijual dalam kemasan 250 gram melalui kedai desa dan pasar tani mingguan.",
        coverMediaId: coverId("seed/kopi-arabika.jpg"),
        categoryId: pick(categoryBySlug, "kuliner").id,
        authorId: editor.id,
        status: "published",
        publishedAt: daysFromNow(-3),
        isFeatured: true,
        createdAt: daysFromNow(-3),
      },
      {
        slug: "panduan-menginap-di-homestay-warga",
        title: "Panduan Menginap di Homestay Warga",
        excerpt: "Hal yang perlu disiapkan sebelum menginap di rumah warga.",
        content:
          "Homestay dikelola langsung oleh keluarga warga dengan kapasitas 2 sampai 4 orang per kamar. Bawa jaket karena suhu malam cukup dingin.\n\nPemesanan dilakukan melalui pengelola desa wisata.",
        coverMediaId: coverId("seed/homestay.jpg"),
        categoryId: pick(categoryBySlug, "penginapan").id,
        authorId: author.id,
        status: "draft",
        isFeatured: false,
        createdAt: daysFromNow(-2),
      },
      {
        slug: "festival-panen-2026-segera-digelar",
        title: "Festival Panen 2026 Segera Digelar",
        excerpt: "Rangkaian acara panen raya, pasar tani, dan pentas seni desa.",
        content:
          "Festival Panen 2026 akan digelar selama tiga hari di balai desa. Acara meliputi pasar tani, lomba memasak, dan pentas sisingaan.\n\nPendaftaran stan UMKM dibuka sampai satu minggu sebelum acara.",
        categoryId: pick(categoryBySlug, "budaya").id,
        authorId: editor.id,
        status: "review",
        isFeatured: true,
        createdAt: daysFromNow(-1),
      },
      {
        slug: "menikmati-pagi-di-sawah-terasering",
        title: "Menikmati Pagi di Sawah Terasering",
        excerpt: "Spot foto dan jalur jalan kaki favorit warga saat pagi hari.",
        content:
          "Sawah terasering berada di sisi utara desa dan paling ramai dikunjungi sebelum pukul delapan pagi. Kabut tipis dan cahaya matahari membuatnya cocok untuk fotografi.\n\nPengunjung diimbau tidak melintasi pematang yang sedang ditanami.",
        coverMediaId: coverId("seed/sawah-terasering.jpg"),
        categoryId: pick(categoryBySlug, "wisata-alam").id,
        authorId: author.id,
        status: "archived",
        publishedAt: daysFromNow(-20),
        isFeatured: false,
        createdAt: daysFromNow(-20),
      },
    ])
    .returning();

  const postBySlug = keyed(postRows, (row) => row.slug);
  const linkPostTag = (postSlug: string, tagSlug: string) => ({
    postId: pick(postBySlug, postSlug).id,
    tagId: pick(tagBySlug, tagSlug).id,
  });

  const postTagRows = await db
    .insert(postTags)
    .values([
      linkPostTag("menjelajah-curug-cimuncang", "alam"),
      linkPostTag("menjelajah-curug-cimuncang", "keluarga"),
      linkPostTag("tradisi-sisingaan-di-desa-karang-pakuan", "budaya"),
      linkPostTag("kopi-arabika-dari-lereng-bukit-karang-pakuan", "kuliner-khas"),
      linkPostTag("kopi-arabika-dari-lereng-bukit-karang-pakuan", "umkm"),
      linkPostTag("panduan-menginap-di-homestay-warga", "keluarga"),
      linkPostTag("festival-panen-2026-segera-digelar", "event"),
      linkPostTag("festival-panen-2026-segera-digelar", "budaya"),
      linkPostTag("menikmati-pagi-di-sawah-terasering", "alam"),
      linkPostTag("menikmati-pagi-di-sawah-terasering", "edukasi"),
    ])
    .returning();

  const eventRows = await db
    .insert(events)
    .values([
      {
        slug: "festival-panen-karang-pakuan",
        title: "Festival Panen Karang Pakuan",
        description: "Pasar tani, pentas seni, dan lomba memasak selama tiga hari.",
        coverMediaId: coverId("seed/sisingaan.jpg"),
        startAt: daysFromNow(14),
        endAt: daysFromNow(16),
        location: "Balai Desa Karang Pakuan",
        status: "published",
        isFeatured: true,
        metaTitle: "Festival Panen Karang Pakuan 2026",
        metaDescription: "Jadwal dan lokasi Festival Panen Karang Pakuan.",
      },
      {
        slug: "pasar-tani-mingguan",
        title: "Pasar Tani Mingguan",
        description: "Warga menjual hasil panen dan produk UMKM setiap Minggu pagi.",
        startAt: daysFromNow(3),
        endAt: daysFromNow(3),
        location: "Lapangan Desa Karang Pakuan",
        status: "published",
        isFeatured: false,
      },
      {
        slug: "workshop-anyaman-bambu",
        title: "Workshop Anyaman Bambu",
        description: "Kelas singkat membuat anyaman bambu bersama perajin desa.",
        coverMediaId: coverId("seed/anyaman-bambu.jpg"),
        startAt: daysFromNow(21),
        endAt: daysFromNow(21),
        location: "Sanggar UMKM Karang Pakuan",
        status: "draft",
        isFeatured: false,
      },
      {
        slug: "kerja-bakti-bersih-curug",
        title: "Kerja Bakti Bersih Curug",
        description: "Gotong royong membersihkan jalur dan area Curug Cimuncang.",
        startAt: daysFromNow(-9),
        endAt: daysFromNow(-9),
        location: "Curug Cimuncang",
        status: "published",
        isFeatured: false,
      },
    ])
    .returning();

  const productRows = await db
    .insert(products)
    .values([
      {
        slug: "kopi-arabika-karang-pakuan",
        name: "Kopi Arabika Karang Pakuan",
        description: "Biji kopi arabika proses natural dari kebun warga lereng bukit.",
        price: 45000,
        unit: "250 gram",
        sellerName: "Kelompok Tani Bukit Hijau",
        sellerPhone: "0812-3456-7890",
        sellerAddress: "Dusun Cikahuripan, Desa Karang Pakuan",
        coverMediaId: coverId("seed/kopi-arabika.jpg"),
        status: "published",
        isFeatured: true,
      },
      {
        slug: "madu-hutan-liar",
        name: "Madu Hutan Liar",
        description: "Madu hutan hasil panen warga, tanpa campuran gula.",
        price: 120000,
        unit: "botol 500 ml",
        sellerName: "Pak Asep",
        sellerPhone: "0813-9876-5432",
        status: "published",
        isFeatured: false,
      },
      {
        slug: "anyaman-bambu",
        name: "Anyaman Bambu",
        description: "Keranjang dan tempat buah dari bambu buatan perajin desa.",
        price: 75000,
        unit: "pcs",
        sellerName: "Ibu Nengsih",
        sellerPhone: "0857-1122-3344",
        sellerAddress: "Kampung Babakan, Desa Karang Pakuan",
        coverMediaId: coverId("seed/anyaman-bambu.jpg"),
        status: "published",
        isFeatured: false,
      },
      {
        slug: "beras-organik-pandan-wangi",
        name: "Beras Organik Pandan Wangi",
        description: "Beras pandan wangi dari sawah terasering desa.",
        price: 20000,
        unit: "kg",
        sellerName: "Kelompok Tani Bukit Hijau",
        status: "draft",
        isFeatured: false,
      },
    ])
    .returning();

  const albumRows = await db
    .insert(albums)
    .values([
      {
        slug: "festival-panen-2025",
        title: "Festival Panen 2025",
        description: "Dokumentasi rangkaian Festival Panen tahun lalu.",
        coverMediaId: coverId("seed/sisingaan.jpg"),
        status: "published",
      },
      {
        slug: "keindahan-curug-cimuncang",
        title: "Keindahan Curug Cimuncang",
        description: "Foto suasana curug dan jalur trekking menuju lokasi.",
        coverMediaId: coverId("seed/curug-cimuncang.jpg"),
        status: "published",
      },
      {
        slug: "dapur-umkm-desa",
        title: "Dapur UMKM Desa",
        description: "Persiapan album, foto sedang dikurasi.",
        status: "draft",
      },
    ])
    .returning();

  const albumBySlug = keyed(albumRows, (row) => row.slug);

  const albumMediaRows = await db
    .insert(albumMedia)
    .values([
      {
        albumId: pick(albumBySlug, "festival-panen-2025").id,
        mediaId: coverId("seed/sisingaan.jpg"),
        sortOrder: 0,
      },
      {
        albumId: pick(albumBySlug, "festival-panen-2025").id,
        mediaId: coverId("seed/sawah-terasering.jpg"),
        sortOrder: 1,
      },
      {
        albumId: pick(albumBySlug, "festival-panen-2025").id,
        mediaId: coverId("seed/anyaman-bambu.jpg"),
        sortOrder: 2,
      },
      {
        albumId: pick(albumBySlug, "keindahan-curug-cimuncang").id,
        mediaId: coverId("seed/curug-cimuncang.jpg"),
        sortOrder: 0,
      },
      {
        albumId: pick(albumBySlug, "keindahan-curug-cimuncang").id,
        mediaId: coverId("seed/sawah-terasering.jpg"),
        sortOrder: 1,
      },
    ])
    .returning();

  await db.insert(settings).values([
    {
      key: "site",
      value: {
        name: "Desa Wisata Karang Pakuan",
        tagline: "Alam, budaya, dan kuliner dari lereng bukit",
        description:
          "Desa wisata di Kabupaten Sumedang dengan curug, sawah terasering, dan homestay warga.",
        contact: {
          email: "halo@karangpakuan.desa.id",
          phone: "+62 812-0000-0000",
          address: "Jalan Raya Karang Pakuan, Sumedang, Jawa Barat",
        },
      },
    },
    {
      key: "social_links",
      value: {
        instagram: "https://instagram.com/desawisatakarangpakuan",
        facebook: "https://facebook.com/desawisatakarangpakuan",
        youtube: "https://youtube.com/@desawisatakarangpakuan",
      },
    },
  ]);

  const contactRows = await db
    .insert(contactMessages)
    .values([
      {
        name: "Budi Santoso",
        email: "budi@example.com",
        phone: "0812-0000-1111",
        subject: "Tanya paket wisata keluarga",
        message: "Apakah ada paket wisata untuk keluarga dengan anak kecil?",
        status: "new",
      },
      {
        name: "Rina Marlina",
        email: "rina@example.com",
        phone: "0813-0000-2222",
        subject: "Ketersediaan homestay akhir pekan",
        message: "Apakah homestay masih tersedia untuk akhir pekan depan?",
        status: "read",
      },
    ])
    .returning();

  console.log(
    `[seed] Done: ${userRows.length} users, ${mediaRows.length} media, ` +
      `${categoryRows.length} categories, ${tagRows.length} tags, ${postRows.length} posts, ` +
      `${postTagRows.length} post tags, ${eventRows.length} events, ` +
      `${productRows.length} products, ${albumRows.length} albums, ` +
      `${albumMediaRows.length} album media, 2 settings, ${contactRows.length} contact messages.`,
  );
} finally {
  await dispose();
}
