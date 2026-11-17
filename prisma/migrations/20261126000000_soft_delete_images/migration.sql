-- Soft delete for images removed through PATCH /properties/:propertyId and PATCH /rooms/:roomId (removeImageIds).
-- The row is kept and marked with deletedAt instead of being hard deleted.
ALTER TABLE "property_images" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "room_images" ADD COLUMN "deletedAt" TIMESTAMP(3);
