import { storage } from "./storage";

export async function seedDatabase() {
  const existing = await storage.getAllSellers();
  if (existing.length > 0) return;

  const sellers = [
    {
      name: "Ahmed Hassan",
      phone: "+20 100 123 4567",
      facebookLink: "https://facebook.com/ahmed.hassan",
      sellerCode: "AH-2024-001",
      duration: "1_year",
      startDate: "2025-01-15",
      expiryDate: "2026-01-15",
    },
    {
      name: "Sara Ali",
      phone: "+20 111 987 6543",
      facebookLink: "https://facebook.com/sara.ali",
      sellerCode: "SA-2024-002",
      duration: "6_months",
      startDate: "2025-12-01",
      expiryDate: "2026-06-01",
    },
    {
      name: "Mohamed Khaled",
      phone: "+20 122 555 1234",
      facebookLink: "https://facebook.com/mohamed.khaled",
      sellerCode: "MK-2024-003",
      duration: "1_month",
      startDate: "2026-02-10",
      expiryDate: "2026-03-10",
    },
    {
      name: "Fatma Ibrahim",
      phone: "+20 155 444 7890",
      facebookLink: "https://facebook.com/fatma.ibrahim",
      sellerCode: "FI-2024-004",
      duration: "1_month",
      startDate: "2026-01-01",
      expiryDate: "2026-02-01",
    },
    {
      name: "Omar Youssef",
      phone: "+20 106 333 2222",
      facebookLink: "https://facebook.com/omar.youssef",
      sellerCode: "OY-2024-005",
      duration: "6_months",
      startDate: "2025-10-15",
      expiryDate: "2026-04-15",
    },
  ];

  for (const seller of sellers) {
    await storage.createSeller(seller);
  }

  console.log("Seeded database with 5 sample sellers");
}
