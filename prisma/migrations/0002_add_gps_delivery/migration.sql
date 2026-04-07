-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveryMode" TEXT,
                    ADD COLUMN "deliveryLat"  DOUBLE PRECISION,
                    ADD COLUMN "deliveryLng"  DOUBLE PRECISION;
