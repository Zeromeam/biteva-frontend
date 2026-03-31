BITEVA LOCAL ORDER MVP

Put these files into your existing Next.js app.

1) Replace / create:
- prisma/schema.prisma
- prisma/seed.ts
- prisma.config.ts
- lib/prisma.ts
- lib/money.ts
- lib/order-number.ts
- app/api/orders/route.ts
- app/order/page.tsx
- app/admin/orders/page.tsx
- app/orders/[orderNumber]/page.tsx

2) Install the needed packages:
npm install @prisma/client @prisma/adapter-pg dotenv pg zod
npm install -D prisma tsx @types/pg

3) In .env set:
DATABASE_URL="postgresql://postgres:password@localhost:5432/biteva"

4) Run:
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed
npm run dev

5) Open:
http://localhost:3000/order
http://localhost:3000/admin/orders

Expected test:
- submit the order form
- see a success box with order number
- open /admin/orders and confirm the row exists
- open the receipt page for the order
